import { getSupabaseServiceClient } from "../_shared/supabase-client.ts";
import { QueueRepository } from "../_shared/repository/queue-repository.ts";
import { SyncRunRepository } from "../_shared/repository/sync-run-repository.ts";
import { jsonError, jsonSuccess } from "../_shared/response.ts";
import { CreateSyncRunUseCase } from "./usecase/create-sync-run.ts";
import { EnqueueGridsUseCase } from "./usecase/enqueue-grids.ts";
import { DispatchController } from "./controller/dispatch-controller.ts";

Deno.serve(async (req) => {
  try {
    const { dry_run } = await req.json();
    const dryRun = dry_run === true;
    console.log("[Index] dry_run:", dryRun);

    const supabaseClient = getSupabaseServiceClient();
    const queueRepo = new QueueRepository(supabaseClient);
    const syncRunRepo = new SyncRunRepository(supabaseClient);

    const createSyncRunUseCase = new CreateSyncRunUseCase(syncRunRepo);
    const enqueueGridsUseCase = new EnqueueGridsUseCase(queueRepo);

    const controller = new DispatchController(
      createSyncRunUseCase,
      enqueueGridsUseCase,
    );
    const result = await controller.handle(dryRun);

    return jsonSuccess(result);
  } catch (error) {
    console.error("Dispatch failed:", error);
    return jsonError(error);
  }
});
