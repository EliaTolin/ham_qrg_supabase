import type { CreateSyncRunUseCase } from "../usecase/create-sync-run.ts";
import type { EnqueueGridsUseCase } from "../usecase/enqueue-grids.ts";
import type { CoverageStation } from "../usecase/enqueue-grids.ts";

interface DispatchResult {
  run_id: string;
  total_stations: number;
  dry_run: boolean;
}

export class DispatchController {
  constructor(
    private createSyncRunUseCase: CreateSyncRunUseCase,
    private enqueueGridsUseCase: EnqueueGridsUseCase,
  ) {}

  async handle(dryRun: boolean): Promise<DispatchResult> {
    const stations = await loadCoverageStations();
    console.log(
      `[Dispatch] Starting dispatch for ${stations.length} stations (dry_run=${dryRun})`,
    );

    const runId = await this.createSyncRunUseCase.execute(
      stations.length,
      dryRun,
    );

    const totalStations = await this.enqueueGridsUseCase.execute(
      stations,
      runId,
      dryRun,
    );

    console.log(
      `[Dispatch] Done: run_id=${runId}, total_stations=${totalStations}`,
    );

    return {
      run_id: runId,
      total_stations: totalStations,
      dry_run: dryRun,
    };
  }
}

async function loadCoverageStations(): Promise<CoverageStation[]> {
  const csv = await Deno.readTextFile(
    new URL("../points_to_sync.csv", import.meta.url),
  );
  const lines = csv.trim().split("\n");
  // Skip header: area,id,lat,lon,radius_km
  return lines.slice(1).map((line) => {
    const [, , lat, lon, radius_km] = line.split(",");
    return {
      lat: parseFloat(lat),
      lon: parseFloat(lon),
      radius_km: parseInt(radius_km),
    };
  });
}
