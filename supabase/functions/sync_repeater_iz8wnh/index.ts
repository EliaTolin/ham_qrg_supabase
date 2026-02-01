import { getSupabaseServiceClient } from "../_shared/supabase-client.ts";
import { QueueRepository } from "./repository/queue-repository.ts";
import { SyncRunRepository } from "./repository/sync-run-repository.ts";
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

    return new Response(
      JSON.stringify({
        success: true,
        ...result,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    console.error("Dispatch failed:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});
