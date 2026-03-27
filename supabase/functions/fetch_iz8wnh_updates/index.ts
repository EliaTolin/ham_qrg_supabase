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
    const supabaseClient = getSupabaseServiceClient();

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
      accessRepo,
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
    );

    const result = await controller.handle();
    return jsonSuccess(result);
  } catch (error) {
    console.error("fetch_iz8wnh_updates failed:", error);
    return jsonError(error);
  }
});
