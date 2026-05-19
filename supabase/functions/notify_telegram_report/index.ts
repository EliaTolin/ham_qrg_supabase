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
  repeater?: Record<string, unknown> | null;
}

function formatFrequency(hz: unknown): string {
  if (typeof hz !== "number" || !Number.isFinite(hz) || hz <= 0) return "N/D";
  return `${(hz / 1_000_000).toFixed(4)} MHz`;
}

function formatShift(hz: unknown): string | null {
  if (typeof hz !== "number" || !Number.isFinite(hz) || hz === 0) return null;
  const mhz = hz / 1_000_000;
  const sign = mhz > 0 ? "+" : "";
  return `${sign}${mhz.toFixed(3)} MHz`;
}

function formatAccess(access: Record<string, unknown>): string {
  const parts: string[] = [];
  const mode = access.mode as string | undefined;
  if (mode) parts.push(mode);

  const ctcss = access.ctcss_hz;
  if (typeof ctcss === "number" && ctcss > 0) {
    parts.push(`CTCSS ${ctcss.toFixed(1)} Hz`);
  } else if (typeof ctcss === "string" && ctcss.length > 0) {
    parts.push(`CTCSS ${ctcss} Hz`);
  }

  const dcs = access.dcs_code;
  if (typeof dcs === "number") parts.push(`DCS ${dcs}`);

  const cc = access.color_code;
  if (typeof cc === "number") parts.push(`CC${cc}`);

  return parts.join(" · ");
}

function formatAccesses(accesses: unknown): string {
  if (!Array.isArray(accesses) || accesses.length === 0) return "N/D";
  return accesses
    .map((a) => formatAccess(a as Record<string, unknown>))
    .filter((s) => s.length > 0)
    .join("\n  • ");
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

function formatReportMessage(
  record: Record<string, unknown>,
  repeater: Record<string, unknown> | null | undefined,
): string {
  const callsign = (repeater?.callsign as string | null) ?? null;
  const name = (repeater?.name as string | null) ?? null;
  const label = callsign ?? name ?? "Sconosciuto";
  const frequency = formatFrequency(repeater?.frequency_hz);
  const shift = formatShift(repeater?.shift_hz);
  const locality = (repeater?.locality as string | null) ?? "";
  const region = (repeater?.region as string | null) ?? "";
  const location = [locality, region].filter(Boolean).join(", ");
  const accesses = formatAccesses(repeater?.accesses);

  const description = record.description as string ?? "";
  const status = record.status as string ?? "pending";
  const createdAt = record.created_at
    ? new Date(record.created_at as string).toLocaleString("it-IT", {
      timeZone: "Europe/Rome",
    })
    : "";

  const repeaterLines = [`<b>Nominativo:</b> ${label}`];
  if (callsign && name && callsign !== name) {
    repeaterLines.push(`<b>Nome:</b> ${name}`);
  }
  repeaterLines.push(`<b>Frequenza:</b> ${frequency}${shift ? ` (${shift})` : ""}`);
  if (location) repeaterLines.push(`<b>Località:</b> ${location}`);
  repeaterLines.push(
    `<b>Accessi:</b>${
      accesses === "N/D" ? ` ${accesses}` : `\n  • ${accesses}`
    }`,
  );

  return (
    `<b>🚨 Nuovo report</b>\n\n` +
    `<b>Ripetitore</b>\n${repeaterLines.join("\n")}\n\n` +
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
        message = formatReportMessage(body.record, body.repeater);
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
