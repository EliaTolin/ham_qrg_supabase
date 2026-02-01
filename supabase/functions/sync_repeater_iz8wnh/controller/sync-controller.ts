import { ITALY_GRID_SQUARES } from "../constants.ts";
import type { SyncStats } from "../types.ts";
import type { FetchRepeatersFromIZ8WNHUseCase } from "../usecase/fetch-repeaters-iz8wnh.ts";
import type { MapApiRecordToRepeaterUseCase } from "../usecase/map-api-record-to-repeater.ts";
import type { PersistRepeaterToDatabaseUseCase } from "../usecase/persist-repeater-to-database.ts";

export class SyncController {
  constructor(
    private fetchRepeatersUseCase: FetchRepeatersFromIZ8WNHUseCase,
    private mapApiRecordUseCase: MapApiRecordToRepeaterUseCase,
    private persistRepeaterUseCase: PersistRepeaterToDatabaseUseCase,
  ) {}

  async handle(dryRun: boolean): Promise<SyncStats> {
    console.log(`[Sync] Starting sync${dryRun ? " [DRY RUN]" : ""}`);
    const startTime = Date.now();

    const { records, errors: fetchErrors } =
      await this.fetchRepeatersUseCase.execute(ITALY_GRID_SQUARES);

    console.log(`[Sync] Fetch complete: ${records.size} unique records, ${fetchErrors} errors`);
    console.log(`[Sync] Processing ${records.size} records...`);

    let repeatersOk = 0;
    let accessOk = 0;
    let syncErrors = 0;
    let processed = 0;

    for (const [id, apiRecord] of records) {
      processed++;
      try {
        const repeater = await this.mapApiRecordUseCase.execute(apiRecord);
        if (!repeater) {
          console.warn(`[Sync] Record ${id}: mapping returned null`);
          syncErrors++;
          continue;
        }

        if (dryRun) {
          repeatersOk++;
          if (repeater.access) accessOk++;
          continue;
        }

        const result = await this.persistRepeaterUseCase.execute(repeater);
        if (result.repeaterOk) repeatersOk++;
        if (result.accessOk) accessOk++;
        if (!result.repeaterOk || !result.accessOk) syncErrors++;
      } catch (error) {
        console.error(`[Sync] Record ${id}: FAILED`, error);
        syncErrors++;
      }

      if (processed % 100 === 0) {
        console.log(`[Sync] Progress: ${processed}/${records.size} (repeaters=${repeatersOk}, access=${accessOk}, errors=${syncErrors})`);
      }
    }

    const elapsed = (Date.now() - startTime) / 1000;

    console.log(`[Sync] Complete in ${Math.round(elapsed * 10) / 10}s: repeaters=${repeatersOk}, access=${accessOk}, errors=${syncErrors}`);

    return {
      dry_run: dryRun,
      grids_queried: ITALY_GRID_SQUARES.length,
      fetch_errors: fetchErrors,
      api_records: records.size,
      repeaters_processed: repeatersOk,
      access_processed: accessOk,
      sync_errors: syncErrors,
      elapsed_seconds: Math.round(elapsed * 10) / 10,
    };
  }
}
