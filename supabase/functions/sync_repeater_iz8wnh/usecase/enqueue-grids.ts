import { locatorToLatLon } from "../utils.ts";
import type { GridMessage } from "../types.ts";
import type { QueueRepository } from "../repository/queue-repository.ts";

export class EnqueueGridsUseCase {
  constructor(private queueRepo: QueueRepository) {}

  async execute(
    grids: string[],
    runId: string,
    dryRun: boolean,
  ): Promise<number> {
    const messages: GridMessage[] = [];

    for (const grid of grids) {
      const coords = locatorToLatLon(grid);
      if (!coords) {
        console.warn(`[Enqueue] Grid ${grid}: invalid locator, skipped`);
        continue;
      }
      messages.push({
        run_id: runId,
        grid,
        lat: coords.lat,
        lon: coords.lon,
        dry_run: dryRun,
      });
    }

    console.log(
      `[Enqueue] Sending ${messages.length} messages to queue`,
    );
    await this.queueRepo.sendBatch(messages);
    console.log(`[Enqueue] Batch sent successfully`);

    return messages.length;
  }
}
