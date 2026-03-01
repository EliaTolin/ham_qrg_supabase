import { OneSignalClient } from "../_shared/api/onesignal-client.ts";
import { getAuthToken } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { jsonError, jsonSuccess } from "../_shared/response.ts";
import { SendPushNotificationUseCase } from "./usecase/send-push-notification.ts";
import { NotificationController } from "./controller/notification-controller.ts";

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("[send_notification] Request received, method:", req.method);

    // Solo chiamate interne con service_role key
    const token = getAuthToken(req);
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    console.log(`[send_notification] token: ${token}`);
    console.log(`[send_notification] env:   ${serviceRoleKey}`);
    if (token !== serviceRoleKey) {
      console.warn("[send_notification] Unauthorized: token mismatch");
      return jsonError("Unauthorized", 401);
    }

    const body = await req.json();
    console.log("[send_notification] Body parsed:", JSON.stringify(body));

    const appId = Deno.env.get("ONESIGNAL_APP_ID");
    const restApiKey = Deno.env.get("ONESIGNAL_REST_API_KEY");

    if (!appId || !restApiKey) {
      throw new Error("Missing OneSignal configuration (ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY)");
    }

    const oneSignalClient = new OneSignalClient(appId, restApiKey);
    const sendPushNotificationUseCase = new SendPushNotificationUseCase(
      oneSignalClient,
    );
    const controller = new NotificationController(sendPushNotificationUseCase);

    const result = await controller.handle(body);

    return jsonSuccess(result);
  } catch (error) {
    console.error("[send_notification] Failed:", error);

    const status = error instanceof Error &&
        error.message.startsWith("Missing")
      ? 400
      : 500;

    return jsonError(error, status);
  }
});
