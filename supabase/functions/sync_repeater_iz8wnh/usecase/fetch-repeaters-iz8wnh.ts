import type { FetchResult, HamQRGRecord } from "../types.ts";
import type { HamQRGClient } from "../api/hamqrg-client.ts";

export class FetchRepeatersFromIZ8WNHUseCase {
  constructor(private apiClient: HamQRGClient) {}

  async execute(grids: string[]): Promise<FetchResult> {
    console.log(`[Fetch] Starting fetch from ${grids.length} grids`);
    const records = new Map<string, HamQRGRecord>();
    let errors = 0;

    for (const grid of grids) {
      try {
        const batch = await this.apiClient.fetchFromGrid(grid);
        const before = records.size;
        for (const rec of batch) {
          if (!records.has(rec.ID)) {
            records.set(rec.ID, rec);
          }
        }
        const newRecords = records.size - before;
        console.log(
          `[Fetch] Grid ${grid}: +${newRecords} new (${
            batch.length - newRecords
          } duplicates)`,
        );
      } catch (error) {
        console.error(`[Fetch] Grid ${grid}: FAILED`, error);
        errors++;
      }
    }

    console.log(
      `[Fetch] Done: ${records.size} unique records, ${errors} errors`,
    );
    return { records, errors };
  }
}
