import type { SyncRunRepository } from "../repository/sync-run-repository.ts";

export class CreateSyncRunUseCase {
  constructor(private syncRunRepo: SyncRunRepository) {}

  async execute(totalMessages: number, dryRun: boolean): Promise<string> {
    const runId = await this.syncRunRepo.create({
      total_messages: totalMessages,
      dry_run: dryRun,
    });

    console.log(
      `[CreateSyncRun] Created run ${runId} (total=${totalMessages}, dry_run=${dryRun})`,
    );
    return runId;
  }
}
