import type { CoverageStationRepository } from "../../_shared/repository/coverage-station-repository.ts";
import type { CreateSyncRunUseCase } from "../usecase/create-sync-run.ts";
import type { EnqueueGridsUseCase } from "../usecase/enqueue-grids.ts";

interface DispatchResult {
  run_id: string;
  total_stations: number;
  dry_run: boolean;
}

export class DispatchController {
  constructor(
    private coverageStationRepo: CoverageStationRepository,
    private createSyncRunUseCase: CreateSyncRunUseCase,
    private enqueueGridsUseCase: EnqueueGridsUseCase,
  ) {}

  async handle(dryRun: boolean): Promise<DispatchResult> {
    const stations = await this.coverageStationRepo.findAll();
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
