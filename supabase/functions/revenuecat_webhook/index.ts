import { RevenueCatClient } from "../_shared/api/revenuecat-client.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { jsonError, jsonSuccess } from "../_shared/response.ts";
import { getSupabaseServiceClient } from "../_shared/supabase-client.ts";
import { SyncSubscriptionUseCase } from "./usecase/sync-subscription.ts";

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonError("Method not allowed", 405);
  }

  try {
    // RevenueCat sends the exact `Authorization` header value configured in the
    // webhook settings. Compare it against our shared secret.
    const expectedAuth = Deno.env.get("REVENUECAT_WEBHOOK_AUTH");
    const authHeader = req.headers.get("Authorization");
    if (!expectedAuth || authHeader !== expectedAuth) {
      console.warn("[revenuecat_webhook] Unauthorized: auth mismatch");
      return jsonError("Unauthorized", 401);
    }

    const apiKey = Deno.env.get("REVENUECAT_API_KEY");
    if (!apiKey) {
      throw new Error("Missing REVENUECAT_API_KEY configuration");
    }
    const entitlementId = Deno.env.get("REVENUECAT_ENTITLEMENT_ID") ?? "pro";

    const body = await req.json();
    const event = body?.event;
    if (!event) {
      return jsonError("Missing 'event' in payload", 400);
    }

    console.log(
      `[revenuecat_webhook] event type=${event.type} app_user_id=${event.app_user_id}`,
    );

    const usecase = new SyncSubscriptionUseCase(
      getSupabaseServiceClient(),
      new RevenueCatClient(apiKey),
      entitlementId,
    );

    const result = await usecase.execute(event);
    console.log("[revenuecat_webhook] Synced:", JSON.stringify(result));

    return jsonSuccess(result);
  } catch (error) {
    console.error("[revenuecat_webhook] Failed:", error);
    return jsonError(error, 500);
  }
});
