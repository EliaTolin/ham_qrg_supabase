import { OneSignalClient } from "../_shared/api/onesignal-client.ts";
import { getAuthToken, verifySupabaseJWT } from "../_shared/auth.ts";
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
    // Verify auth: accept service_role key (internal/trigger calls) or user JWT
    const token = getAuthToken(req);
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (token !== serviceRoleKey) {
      await verifySupabaseJWT(token);
    }

    const body = await req.json();

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
