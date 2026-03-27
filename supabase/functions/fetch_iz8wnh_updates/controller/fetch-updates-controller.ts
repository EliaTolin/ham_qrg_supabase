import type { RepeaterRepository } from "../../_shared/repository/repeater-repository.ts";
import type { FetchLatestUpdatesUseCase } from "../usecase/fetch-latest-updates.ts";
import type { CompareWithLocalUseCase } from "../usecase/compare-with-local.ts";
import type { EvaluateActivationStatusUseCase } from "../usecase/evaluate-activation-status.ts";
import type { StorePendingChangeUseCase } from "../usecase/store-pending-change.ts";

interface FetchUpdatesResult {
  total_fetched: number;
  new_repeaters: number;
  updates: number;
  deactivations: number;
  reactivations: number;
  skipped_no_diff: number;
  already_pending: number;
  errors: number;
}

export class FetchUpdatesController {
  constructor(
    private repeaterRepo: RepeaterRepository,
    private fetchLatestUpdatesUseCase: FetchLatestUpdatesUseCase,
    private compareWithLocalUseCase: CompareWithLocalUseCase,
    private evaluateActivationStatusUseCase: EvaluateActivationStatusUseCase,
    private storePendingChangeUseCase: StorePendingChangeUseCase,
  ) {}

  async handle(): Promise<FetchUpdatesResult> {
    const result: FetchUpdatesResult = {
      total_fetched: 0,
      new_repeaters: 0,
      updates: 0,
      deactivations: 0,
      reactivations: 0,
      skipped_no_diff: 0,
      already_pending: 0,
      errors: 0,
    };

    const records = await this.fetchLatestUpdatesUseCase.execute();
    result.total_fetched = records.length;

    for (const record of records) {
      try {
        // Lookup strategy:
        // 1) By repeater_access.external_id (iz8wnh ID is per-access, not per-repeater)
        // 2) By repeaters.external_id in old composite format {freqHz}_{locator}
        // 3) By frequency_hz + locator directly
        // 4) By callsign (handles frequency changes for same repeater)
        let localRepeater = await this.repeaterRepo.findByAccessExternalId(
          record.ID,
        );

        if (!localRepeater) {
          const freqHz = Math.round(parseFloat(record.Frequenza) * 1_000_000);
          const oldExternalId = `${freqHz}_${record.Locator}`;

          localRepeater = await this.repeaterRepo.findByExternalId(oldExternalId);

          if (!localRepeater) {
            localRepeater = await this.repeaterRepo.findByFreqLocator(
              freqHz,
              record.Locator,
            );
          }

          // 4a) Callsign + locator (handles freq changes, no ambiguity)
          if (!localRepeater && record.Identificativo) {
            localRepeater = await this.repeaterRepo.findByCallsignAndLocator(
              record.Identificativo,
              record.Locator,
            );
          }

          // 4b) Callsign only (last resort, skips if ambiguous)
          if (!localRepeater && record.Identificativo) {
            localRepeater = await this.repeaterRepo.findByCallsign(
              record.Identificativo,
            );
          }

          if (localRepeater) {
            console.log(
              `[FetchUpdates] ${record.ID}: matched via fallback (repeater=${localRepeater.id})`,
            );
          }
        }

        // 1) Evaluate activation status (always, regardless of timestamps)
        const activationChange = await this.evaluateActivationStatusUseCase
          .execute(record, localRepeater);

        if (activationChange) {
          const stored = await this.storePendingChangeUseCase.execute(
            activationChange,
          );
          if (stored) {
            if (activationChange.change_type === "deactivate") {
              result.deactivations++;
            } else {
              result.reactivations++;
            }
          } else {
            result.already_pending++;
          }
        }

        // 2) Compare data fields (respects timestamp logic)
        const dataChange = await this.compareWithLocalUseCase.execute(
          record,
          localRepeater,
        );

        if (dataChange) {
          const stored = await this.storePendingChangeUseCase.execute(
            dataChange,
          );
          if (stored) {
            if (dataChange.change_type === "new") {
              result.new_repeaters++;
            } else {
              result.updates++;
            }
          } else {
            result.already_pending++;
          }
        } else if (!activationChange) {
          result.skipped_no_diff++;
        }
      } catch (error) {
        console.error(
          `[FetchUpdates] Error processing record ${record.ID}:`,
          error,
        );
        result.errors++;
      }
    }

    console.log("[FetchUpdates] Result:", JSON.stringify(result));
    return result;
  }
}
