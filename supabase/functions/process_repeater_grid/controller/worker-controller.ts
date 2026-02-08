import type { HamQRGClient } from "../../_shared/api/hamqrg-client.ts";
import type { MapApiRecordToRepeaterUseCase } from "../../_shared/usecase/map-api-record-to-repeater.ts";
import type { PersistRepeaterToDatabaseUseCase } from "../../_shared/usecase/persist-repeater-to-database.ts";
import type { QueueRepository } from "../../_shared/repository/queue-repository.ts";
import type { SyncRunRepository } from "../../_shared/repository/sync-run-repository.ts";
import type { NetworkRepository } from "../../_shared/repository/network-repository.ts";

const MAX_READ_CT = 3;

export class WorkerController {
  constructor(
    private apiClient: HamQRGClient,
    private mapApiRecordUseCase: MapApiRecordToRepeaterUseCase,
    private persistRepeaterUseCase: PersistRepeaterToDatabaseUseCase,
    private queueRepo: QueueRepository,
    private syncRunRepo: SyncRunRepository,
    private networkRepo: NetworkRepository,
  ) {}

  async handle(batchSize: number): Promise<{
    messages_read: number;
    messages_processed: number;
    messages_poisoned: number;
    repeaters_processed: number;
    access_processed: number;
    fetch_errors: number;
    sync_errors: number;
  }> {
    console.log(`[Worker] Reading ${batchSize} messages from queue`);

    const messages = await this.queueRepo.read(batchSize, 120);
    console.log(`[Worker] Got ${messages.length} messages`);

    if (messages.length === 0) {
      return {
        messages_read: 0,
        messages_processed: 0,
        messages_poisoned: 0,
        repeaters_processed: 0,
        access_processed: 0,
        fetch_errors: 0,
        sync_errors: 0,
      };
    }

    let messagesProcessed = 0;
    let messagesPoisoned = 0;
    let totalRepeatersProcessed = 0;
    let totalAccessProcessed = 0;
    let totalFetchErrors = 0;
    let totalSyncErrors = 0;

    for (const { msg_id, read_ct, message } of messages) {
      const { run_id, lat, lon, radius_km, dry_run } = message;

      // Poison message: too many retries
      if (read_ct > MAX_READ_CT) {
        console.warn(
          `[Worker] Poison message ${msg_id} (lat=${lat}, lon=${lon}, read_ct=${read_ct}), deleting`,
        );
        await this.queueRepo.delete(msg_id);
        await this.syncRunRepo.incrementStats(run_id, { fetch_errors: 1 });
        messagesPoisoned++;
        continue;
      }

      let repeatersProcessed = 0;
      let accessProcessed = 0;
      let fetchErrors = 0;
      let syncErrors = 0;

      try {
        console.log(`[Worker] Processing (lat=${lat}, lon=${lon})`);

        const records = await this.apiClient.fetchFromCoords(lat, lon, radius_km);
        console.log(`[Worker] (lat=${lat}, lon=${lon}): ${records.length} records from API`);

        for (const apiRecord of records) {
          try {
            const mapped = await this.mapApiRecordUseCase.execute(apiRecord);
            if (!mapped) {
              console.warn(
                `[Worker] Record ${apiRecord.ID}: mapping returned null`,
              );
              syncErrors++;
              continue;
            }

            if (dry_run) {
              repeatersProcessed++;
              if (mapped.access) accessProcessed++;
              continue;
            }

            const result = await this.persistRepeaterUseCase.execute(mapped);
            if (result.repeaterOk) repeatersProcessed++;
            if (result.accessOk) accessProcessed++;
            if (!result.repeaterOk || !result.accessOk) syncErrors++;
          } catch (error) {
            console.error(
              `[Worker] Record ${apiRecord.ID}: FAILED`,
              error,
            );
            syncErrors++;
          }
        }
      } catch (error) {
        console.error(`[Worker] (lat=${lat}, lon=${lon}): fetch FAILED`, error);
        fetchErrors = 1;
      }

      // Update stats and delete message
      await this.syncRunRepo.incrementStats(run_id, {
        repeaters_processed: repeatersProcessed,
        access_processed: accessProcessed,
        fetch_errors: fetchErrors,
        sync_errors: syncErrors,
      });

      await this.queueRepo.delete(msg_id);
      messagesProcessed++;

      totalRepeatersProcessed += repeatersProcessed;
      totalAccessProcessed += accessProcessed;
      totalFetchErrors += fetchErrors;
      totalSyncErrors += syncErrors;

      console.log(
        `[Worker] (lat=${lat}, lon=${lon}): done (repeaters=${repeatersProcessed}, access=${accessProcessed})`,
      );
    }

    console.log(
      `[Worker] Batch complete: processed=${messagesProcessed}, poisoned=${messagesPoisoned}`,
    );

    // Log unknown networks at the end of the batch
    if (this.networkRepo.unknownRete.length > 0) {
      console.warn(
        `[Worker] Unknown rete values: ${this.networkRepo.unknownRete.join(", ")}`,
      );
    }
    if (this.networkRepo.missingNetworks.length > 0) {
      console.warn(
        `[Worker] Missing networks: ${this.networkRepo.missingNetworks.join(", ")}`,
      );
    }

    return {
      messages_read: messages.length,
      messages_processed: messagesProcessed,
      messages_poisoned: messagesPoisoned,
      repeaters_processed: totalRepeatersProcessed,
      access_processed: totalAccessProcessed,
      fetch_errors: totalFetchErrors,
      sync_errors: totalSyncErrors,
    };
  }
}
