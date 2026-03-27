import { getSupabaseServiceClient } from "../_shared/supabase-client.ts";
import { QueueRepository } from "../_shared/repository/queue-repository.ts";
import { SyncRunRepository } from "../_shared/repository/sync-run-repository.ts";
import { CoverageStationRepository } from "../_shared/repository/coverage-station-repository.ts";
import { jsonError, jsonSuccess } from "../_shared/response.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { CreateSyncRunUseCase } from "./usecase/create-sync-run.ts";
import { EnqueueGridsUseCase } from "./usecase/enqueue-grids.ts";
import { DispatchController } from "./controller/dispatch-controller.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    let dryRun = false;
    let area: string | undefined;
    try {
      const body = await req.json();
      dryRun = body.dry_run ?? false;
      area = body.area ?? undefined;
    } catch {
      // No body or invalid JSON — use defaults
    }
    console.log("[Index] dry_run:", dryRun, "area:", area ?? "all");

    const supabaseClient = getSupabaseServiceClient();
    const queueRepo = new QueueRepository(supabaseClient);
    const syncRunRepo = new SyncRunRepository(supabaseClient);
    const coverageStationRepo = new CoverageStationRepository(supabaseClient);

    const createSyncRunUseCase = new CreateSyncRunUseCase(syncRunRepo);
    const enqueueGridsUseCase = new EnqueueGridsUseCase(queueRepo);

    const controller = new DispatchController(
      coverageStationRepo,
      createSyncRunUseCase,
      enqueueGridsUseCase,
    );
    const result = await controller.handle(dryRun, area);

    return jsonSuccess(result);
  } catch (error) {
    console.error("Dispatch failed:", error);
    return jsonError(error);
  }
});
