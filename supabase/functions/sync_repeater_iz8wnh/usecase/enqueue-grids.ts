import type { GridMessage } from "../../_shared/types.ts";
import type { QueueRepository } from "../../_shared/repository/queue-repository.ts";

export interface CoverageStation {
  lat: number;
  lon: number;
  radius_km: number;
}

export class EnqueueGridsUseCase {
  constructor(private queueRepo: QueueRepository) {}

  async execute(
    stations: CoverageStation[],
    runId: string,
    dryRun: boolean,
  ): Promise<number> {
    const messages: GridMessage[] = stations.map((s) => ({
      run_id: runId,
      lat: s.lat,
      lon: s.lon,
      radius_km: s.radius_km,
      dry_run: dryRun,
    }));

    console.log(
      `[Enqueue] Sending ${messages.length} messages to queue`,
    );
    await this.queueRepo.sendBatch(messages);
    console.log(`[Enqueue] Batch sent successfully`);

    return messages.length;
  }
}
