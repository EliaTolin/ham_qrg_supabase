import { getSupabaseServiceClient } from "../_shared/supabase-client.ts";
import { HamQRGClient } from "../sync_repeater_iz8wnh/api/hamqrg-client.ts";
import { RepeaterRepository } from "../sync_repeater_iz8wnh/repository/repeater-repository.ts";
import { AccessRepository } from "../sync_repeater_iz8wnh/repository/access-repository.ts";
import { NetworkRepository } from "../sync_repeater_iz8wnh/repository/network-repository.ts";
import { QueueRepository } from "../sync_repeater_iz8wnh/repository/queue-repository.ts";
import { SyncRunRepository } from "../sync_repeater_iz8wnh/repository/sync-run-repository.ts";
import { MapApiRecordToRepeaterUseCase } from "../sync_repeater_iz8wnh/usecase/map-api-record-to-repeater.ts";
import { PersistRepeaterToDatabaseUseCase } from "../sync_repeater_iz8wnh/usecase/persist-repeater-to-database.ts";
import { WorkerController } from "./controller/worker-controller.ts";

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const batchSize = body.batch_size ?? 5;
    console.log("[Index] batch_size:", batchSize);

    const apiClient = new HamQRGClient(
      Deno.env.get("HAMQRG_USR")!,
      Deno.env.get("HAMQRG_PSW")!,
      Deno.env.get("HAMQRG_TOKEN")!,
    );

    const supabaseClient = getSupabaseServiceClient();
    const repeaterRepo = new RepeaterRepository(supabaseClient);
    const accessRepo = new AccessRepository(supabaseClient);
    const networkRepo = new NetworkRepository(supabaseClient);
    const queueRepo = new QueueRepository(supabaseClient);
    const syncRunRepo = new SyncRunRepository(supabaseClient);

    const mapApiRecordUseCase = new MapApiRecordToRepeaterUseCase(networkRepo);
    const persistRepeaterUseCase = new PersistRepeaterToDatabaseUseCase(
      repeaterRepo,
      accessRepo,
    );

    const controller = new WorkerController(
      apiClient,
      mapApiRecordUseCase,
      persistRepeaterUseCase,
      queueRepo,
      syncRunRepo,
      networkRepo,
    );
    const result = await controller.handle(batchSize);

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
    console.error("Worker failed:", error);

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
