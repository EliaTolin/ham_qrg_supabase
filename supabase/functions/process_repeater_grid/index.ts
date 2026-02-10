import { getSupabaseServiceClient } from "../_shared/supabase-client.ts";
import { HamQRGClient } from "../_shared/api/hamqrg-client.ts";
import { RepeaterRepository } from "../_shared/repository/repeater-repository.ts";
import { AccessRepository } from "../_shared/repository/access-repository.ts";
import { NetworkRepository } from "../_shared/repository/network-repository.ts";
import { QueueRepository } from "../_shared/repository/queue-repository.ts";
import { SyncRunRepository } from "../_shared/repository/sync-run-repository.ts";
import { MapApiRecordToRepeaterUseCase } from "../_shared/usecase/map-api-record-to-repeater.ts";
import { MigrateExternalIdUseCase } from "../_shared/usecase/migrate-external-id.ts";
import { PersistRepeaterToDatabaseUseCase } from "../_shared/usecase/persist-repeater-to-database.ts";
import { jsonError, jsonSuccess } from "../_shared/response.ts";
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
    // TODO: remove after first successful full sync
    const migrateExternalIdUseCase = new MigrateExternalIdUseCase(repeaterRepo);
    const persistRepeaterUseCase = new PersistRepeaterToDatabaseUseCase(
      repeaterRepo,
      accessRepo,
    );

    const controller = new WorkerController(
      apiClient,
      mapApiRecordUseCase,
      migrateExternalIdUseCase,
      persistRepeaterUseCase,
      queueRepo,
      syncRunRepo,
      networkRepo,
    );
    const result = await controller.handle(batchSize);

    return jsonSuccess(result);
  } catch (error) {
    console.error("Worker failed:", error);
    return jsonError(error);
  }
});
