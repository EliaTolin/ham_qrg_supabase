import { getAuthToken } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { jsonError, jsonSuccess } from "../_shared/response.ts";

const TELEGRAM_CHAT_ID = "-1003880485089";

interface ReportPayload {
  id: string;
  repeater_id: string;
  user_id: string;
  description: string;
  status: string;
  created_at: string;
  repeater_label: string;
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

    const body: ReportPayload = await req.json();

    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!botToken) {
      throw new Error("Missing TELEGRAM_BOT_TOKEN environment variable");
    }

    const message =
      `<b>🚨 Nuovo report</b>\n\n` +
      `<b>Ripetitore:</b> ${body.repeater_label}\n` +
      `<b>Descrizione:</b> ${body.description}\n` +
      `<b>Stato:</b> ${body.status}\n` +
      `<b>Data:</b> ${new Date(body.created_at).toLocaleString("it-IT")}`;

    await sendTelegramMessage(botToken, TELEGRAM_CHAT_ID, message);

    return jsonSuccess({ sent: true });
  } catch (error) {
    console.error("[notify_telegram_report] Failed:", error);
    return jsonError(error, 500);
  }
});
