import type { CreateSyncRunUseCase } from "../usecase/create-sync-run.ts";
import type { EnqueueGridsUseCase } from "../usecase/enqueue-grids.ts";
import { EU_GRIDS_UNIQUE } from "../locators.ts";

interface DispatchResult {
  run_id: string;
  total_grids: number;
  dry_run: boolean;
}

export class DispatchController {
  constructor(
    private createSyncRunUseCase: CreateSyncRunUseCase,
    private enqueueGridsUseCase: EnqueueGridsUseCase,
  ) {}

  async handle(dryRun: boolean): Promise<DispatchResult> {
    const grids = EU_GRIDS_UNIQUE;
    console.log(
      `[Dispatch] Starting dispatch for ${grids.length} grids (dry_run=${dryRun})`,
    );

    const runId = await this.createSyncRunUseCase.execute(
      grids.length,
      dryRun,
    );

    const totalGrids = await this.enqueueGridsUseCase.execute(
      grids,
      runId,
      dryRun,
    );

    console.log(
      `[Dispatch] Done: run_id=${runId}, total_grids=${totalGrids}`,
    );

    return {
      run_id: runId,
      total_grids: totalGrids,
      dry_run: dryRun,
    };
  }
}
