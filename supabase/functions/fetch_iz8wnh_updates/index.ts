import { getSupabaseServiceClient } from "../_shared/supabase-client.ts";
import { HamQRGClient } from "../_shared/api/hamqrg-client.ts";
import { RepeaterRepository } from "../_shared/repository/repeater-repository.ts";
import { AccessRepository } from "../_shared/repository/access-repository.ts";
import { NetworkRepository } from "../_shared/repository/network-repository.ts";
import { PendingChangeRepository } from "../_shared/repository/pending-change-repository.ts";
import { MapApiRecordToRepeaterUseCase } from "../_shared/usecase/map-api-record-to-repeater.ts";
import { jsonError, jsonSuccess } from "../_shared/response.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { FetchLatestUpdatesUseCase } from "./usecase/fetch-latest-updates.ts";
import { CompareWithLocalUseCase } from "./usecase/compare-with-local.ts";
import { EvaluateActivationStatusUseCase } from "./usecase/evaluate-activation-status.ts";
import { StorePendingChangeUseCase } from "./usecase/store-pending-change.ts";
import { FetchUpdatesController } from "./controller/fetch-updates-controller.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    let autoApply = false;
    try {
      const body = await req.json();
      autoApply = body.auto_apply ?? false;
    } catch {
      // No body or invalid JSON — defaults
    }

    console.log("[Index] auto_apply:", autoApply);

    const supabaseClient = getSupabaseServiceClient();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const apiClient = new HamQRGClient(
      Deno.env.get("HAMQRG_USR")!,
      Deno.env.get("HAMQRG_PSW")!,
      Deno.env.get("HAMQRG_TOKEN")!,
    );

    const repeaterRepo = new RepeaterRepository(supabaseClient);
    const accessRepo = new AccessRepository(supabaseClient);
    const networkRepo = new NetworkRepository(supabaseClient);
    const pendingChangeRepo = new PendingChangeRepository(supabaseClient);

    const fetchLatestUpdatesUseCase = new FetchLatestUpdatesUseCase(apiClient);
    const mapApiRecordUseCase = new MapApiRecordToRepeaterUseCase(networkRepo);
    const compareWithLocalUseCase = new CompareWithLocalUseCase(
      mapApiRecordUseCase,
    );
    const evaluateActivationStatusUseCase =
      new EvaluateActivationStatusUseCase(accessRepo);
    const storePendingChangeUseCase = new StorePendingChangeUseCase(
      pendingChangeRepo,
    );

    const controller = new FetchUpdatesController(
      repeaterRepo,
      fetchLatestUpdatesUseCase,
      compareWithLocalUseCase,
      evaluateActivationStatusUseCase,
      storePendingChangeUseCase,
      supabaseUrl,
      serviceRoleKey,
    );

    const result = await controller.handle(autoApply);
    return jsonSuccess(result);
  } catch (error) {
    console.error("fetch_iz8wnh_updates failed:", error);
    return jsonError(error);
  }
});
