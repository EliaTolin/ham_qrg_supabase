import { createSupabaseClient } from "../_shared/supabase-client.ts";
import { HamQRGClient } from "./api/hamqrg-client.ts";
import { RepeaterRepository } from "./repository/repeater-repository.ts";
import { AccessRepository } from "./repository/access-repository.ts";
import { NetworkRepository } from "./repository/network-repository.ts";
import { FetchRepeatersFromIZ8WNHUseCase } from "./usecase/fetch-repeaters-iz8wnh.ts";
import { MapApiRecordToRepeaterUseCase } from "./usecase/map-api-record-to-repeater.ts";
import { PersistRepeaterToDatabaseUseCase } from "./usecase/persist-repeater-to-database.ts";
import { SyncController } from "./controller/sync-controller.ts";

Deno.serve(async (req) => {
  try {
    const { dry_run } = await req.json();
    const dryRun = dry_run === true;
    console.log("[Index] dry_run:", dryRun);

    const apiClient = new HamQRGClient(
      Deno.env.get("HAMQRG_USR")!,
      Deno.env.get("HAMQRG_PSW")!,
      Deno.env.get("HAMQRG_TOKEN")!,
    );

    const supabaseClient = createSupabaseClient(
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const repeaterRepo = new RepeaterRepository(supabaseClient);
    const accessRepo = new AccessRepository(supabaseClient);
    const networkRepo = new NetworkRepository(supabaseClient);

    const fetchRepeatersUseCase = new FetchRepeatersFromIZ8WNHUseCase(
      apiClient,
    );
    const mapApiRecordUseCase = new MapApiRecordToRepeaterUseCase(networkRepo);
    const persistRepeaterUseCase = new PersistRepeaterToDatabaseUseCase(
      repeaterRepo,
      accessRepo,
    );

    const controller = new SyncController(
      fetchRepeatersUseCase,
      mapApiRecordUseCase,
      persistRepeaterUseCase,
      networkRepo,
    );
    const stats = await controller.handle(dryRun);

    return new Response(
      JSON.stringify({
        success: true,
        stats,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    console.error("Sync failed:", error);

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
