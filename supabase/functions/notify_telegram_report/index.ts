import { getAuthToken } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { jsonError, jsonSuccess } from "../_shared/response.ts";

const TELEGRAM_CHAT_ID = "-1003880485089";

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: Record<string, unknown>;
  old_record: Record<string, unknown> | null;
}

async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
): Promise<void> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram API error ${res.status}: ${body}`);
  }
}

function formatReportMessage(record: Record<string, unknown>): string {
  const label = record.repeater_label as string ?? "Ripetitore";
  const description = record.description as string ?? "";
  const status = record.status as string ?? "pending";
  const createdAt = record.created_at
    ? new Date(record.created_at as string).toLocaleString("it-IT", {
      timeZone: "Europe/Rome",
    })
    : "";

  return (
    `<b>🚨 Nuovo report</b>\n\n` +
    `<b>Ripetitore:</b> ${label}\n` +
    `<b>Descrizione:</b> ${description}\n` +
    `<b>Stato:</b> ${status}\n` +
    `<b>Data:</b> ${createdAt}`
  );
}

function formatSubmissionMessage(record: Record<string, unknown>): string {
  const label = (record.callsign as string) ??
    (record.name as string) ?? "Sconosciuto";
  const frequencyHz = record.frequency_hz as number;
  const frequency = frequencyHz
    ? `${(frequencyHz / 1_000_000).toFixed(4)} MHz`
    : "N/D";
  const locality = record.locality as string ?? "";
  const region = record.region as string ?? "";
  const location = [locality, region].filter(Boolean).join(", ") || "N/D";
  const accesses = Array.isArray(record.accesses) ? record.accesses : [];
  const modes = accesses.map((a: Record<string, unknown>) => a.mode).join(
    ", ",
  ) || "N/D";
  const notes = record.notes as string ?? "";
  const createdAt = record.created_at
    ? new Date(record.created_at as string).toLocaleString("it-IT", {
      timeZone: "Europe/Rome",
    })
    : "";

  let message =
    `<b>📡 Nuovo ripetitore segnalato</b>\n\n` +
    `<b>Nome/Callsign:</b> ${label}\n` +
    `<b>Frequenza:</b> ${frequency}\n` +
    `<b>Località:</b> ${location}\n` +
    `<b>Accessi:</b> ${modes}\n` +
    `<b>Data:</b> ${createdAt}`;

  if (notes) {
    message += `\n<b>Note:</b> ${notes}`;
  }

  return message;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Solo chiamate interne con service_role key
    const token = getAuthToken(req);
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (token !== serviceRoleKey) {
      return jsonError("Unauthorized", 401);
    }

    const body: WebhookPayload = await req.json();

    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!botToken) {
      throw new Error("Missing TELEGRAM_BOT_TOKEN environment variable");
    }

    let message: string;

    switch (body.table) {
      case "repeater_reports":
        message = formatReportMessage(body.record);
        break;
      case "repeater_submissions":
        message = formatSubmissionMessage(body.record);
        break;
      default:
        throw new Error(`Unknown table: ${body.table}`);
    }

    await sendTelegramMessage(botToken, TELEGRAM_CHAT_ID, message);

    return jsonSuccess({ sent: true });
  } catch (error) {
    console.error("[notify_telegram_report] Failed:", error);
    return jsonError(error, 500);
  }
});
