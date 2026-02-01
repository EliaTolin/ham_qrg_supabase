import type { SyncStats } from "../types.ts";
import type { NetworkRepository } from "../repository/network-repository.ts";
import type { FetchRepeatersFromIZ8WNHUseCase } from "../usecase/fetch-repeaters-iz8wnh.ts";
import type { MapApiRecordToRepeaterUseCase } from "../usecase/map-api-record-to-repeater.ts";
import type { PersistRepeaterToDatabaseUseCase } from "../usecase/persist-repeater-to-database.ts";
import { EU_GRIDS_UNIQUE } from "../locators.ts";

export class SyncController {
  constructor(
    private fetchRepeatersUseCase: FetchRepeatersFromIZ8WNHUseCase,
    private mapApiRecordUseCase: MapApiRecordToRepeaterUseCase,
    private persistRepeaterUseCase: PersistRepeaterToDatabaseUseCase,
    private networkRepo: NetworkRepository,
  ) {}

  async handle(dryRun: boolean): Promise<SyncStats> {
    console.log(`[Sync] Starting sync${dryRun ? " [DRY RUN]" : ""}`);
    const startTime = Date.now();

    const { records, errors: fetchErrors } = await this.fetchRepeatersUseCase
      .execute(EU_GRIDS_UNIQUE);

    console.log(
      `[Sync] Fetch complete: ${records.size} unique records, ${fetchErrors} errors`,
    );
    console.log(`[Sync] Processing ${records.size} records...`);

    let repeatersProcessed = 0;
    let accessOk = 0;
    let syncErrors = 0;
    let processed = 0;
    const seenRepeaters = new Set<string>();

    for (const [id, apiRecord] of records) {
      processed++;
      try {
        const mapped = await this.mapApiRecordUseCase.execute(apiRecord);
        if (!mapped) {
          console.warn(`[Sync] Record ${id}: mapping returned null`);
          syncErrors++;
          continue;
        }

        const extId = mapped.repeater.external_id;

        if (dryRun) {
          if (!seenRepeaters.has(extId)) {
            seenRepeaters.add(extId);
            repeatersProcessed++;
          }
          if (mapped.access) accessOk++;
          continue;
        }

        const result = await this.persistRepeaterUseCase.execute(mapped);
        if (result.repeaterOk && !seenRepeaters.has(extId)) {
          seenRepeaters.add(extId);
          repeatersProcessed++;
        }
        if (result.accessOk) accessOk++;
        if (!result.repeaterOk || !result.accessOk) syncErrors++;
      } catch (error) {
        console.error(`[Sync] Record ${id}: FAILED`, error);
        syncErrors++;
      }

      if (processed % 100 === 0) {
        console.log(
          `[Sync] Progress: ${processed}/${records.size} (repeaters=${repeatersProcessed}, access=${accessOk}, errors=${syncErrors})`,
        );
      }
    }

    const elapsed = (Date.now() - startTime) / 1000;

    console.log(
      `[Sync] Complete in ${
        Math.round(elapsed * 10) / 10
      }s: repeaters=${repeatersProcessed}, access=${accessOk}, errors=${syncErrors}`,
    );

    return {
      dry_run: dryRun,
      grids_queried: EU_GRIDS_UNIQUE.length,
      fetch_errors: fetchErrors,
      api_records: records.size,
      repeaters_processed: repeatersProcessed,
      access_processed: accessOk,
      sync_errors: syncErrors,
      unknown_networks: this.networkRepo.unknownRete,
      missing_networks: this.networkRepo.missingNetworks,
      elapsed_seconds: Math.round(elapsed * 10) / 10,
    };
  }
}
