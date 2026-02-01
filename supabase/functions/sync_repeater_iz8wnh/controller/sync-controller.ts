import { ITALY_GRID_SQUARES } from "../constants.ts";
import type { SyncStats } from "../types.ts";
import type { NetworkRepository } from "../repository/network-repository.ts";
import type { RepeaterRepository } from "../repository/repeater-repository.ts";
import type { FetchRepeatersFromIZ8WNHUseCase } from "../usecase/fetch-repeaters-iz8wnh.ts";
import type { MapApiRecordToRepeaterUseCase } from "../usecase/map-api-record-to-repeater.ts";
import type { PersistRepeaterToDatabaseUseCase } from "../usecase/persist-repeater-to-database.ts";

export class SyncController {
  constructor(
    private fetchRepeatersUseCase: FetchRepeatersFromIZ8WNHUseCase,
    private mapApiRecordUseCase: MapApiRecordToRepeaterUseCase,
    private persistRepeaterUseCase: PersistRepeaterToDatabaseUseCase,
    private networkRepo: NetworkRepository,
    private repeaterRepo: RepeaterRepository,
  ) {}

  async handle(dryRun: boolean): Promise<SyncStats> {
    console.log(`[Sync] Starting sync${dryRun ? " [DRY RUN]" : ""}`);
    const startTime = Date.now();

    await this.repeaterRepo.loadExistingIds();

    const { records, errors: fetchErrors } =
      await this.fetchRepeatersUseCase.execute(ITALY_GRID_SQUARES);

    console.log(`[Sync] Fetch complete: ${records.size} unique records, ${fetchErrors} errors`);
    console.log(`[Sync] Processing ${records.size} records...`);

    let repeatersCreated = 0;
    let repeatersUpdated = 0;
    let accessOk = 0;
    let syncErrors = 0;
    let processed = 0;

    for (const [id, apiRecord] of records) {
      processed++;
      try {
        const mapped = await this.mapApiRecordUseCase.execute(apiRecord);
        if (!mapped) {
          console.warn(`[Sync] Record ${id}: mapping returned null`);
          syncErrors++;
          continue;
        }

        if (dryRun) {
          if (mapped.access) accessOk++;
          continue;
        }

        const result = await this.persistRepeaterUseCase.execute(mapped);
        if (result.repeaterOk) {
          if (result.repeaterCreated) repeatersCreated++;
          else repeatersUpdated++;
        }
        if (result.accessOk) accessOk++;
        if (!result.repeaterOk || !result.accessOk) syncErrors++;
      } catch (error) {
        console.error(`[Sync] Record ${id}: FAILED`, error);
        syncErrors++;
      }

      if (processed % 100 === 0) {
        console.log(`[Sync] Progress: ${processed}/${records.size} (created=${repeatersCreated}, updated=${repeatersUpdated}, access=${accessOk}, errors=${syncErrors})`);
      }
    }

    const elapsed = (Date.now() - startTime) / 1000;

    console.log(`[Sync] Complete in ${Math.round(elapsed * 10) / 10}s: created=${repeatersCreated}, updated=${repeatersUpdated}, access=${accessOk}, errors=${syncErrors}`);

    return {
      dry_run: dryRun,
      grids_queried: ITALY_GRID_SQUARES.length,
      fetch_errors: fetchErrors,
      api_records: records.size,
      repeaters_created: repeatersCreated,
      repeaters_updated: repeatersUpdated,
      access_processed: accessOk,
      sync_errors: syncErrors,
      unknown_networks: this.networkRepo.unknownRete,
      missing_networks: this.networkRepo.missingNetworks,
      elapsed_seconds: Math.round(elapsed * 10) / 10,
    };
  }
}
