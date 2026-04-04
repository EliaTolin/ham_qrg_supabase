import type { RepeaterRepository } from "../../_shared/repository/repeater-repository.ts";
import type { FetchLatestUpdatesUseCase } from "../usecase/fetch-latest-updates.ts";
import type { CompareWithLocalUseCase } from "../usecase/compare-with-local.ts";
import type { EvaluateActivationStatusUseCase } from "../usecase/evaluate-activation-status.ts";
import type { StorePendingChangeUseCase } from "../usecase/store-pending-change.ts";
import type { PendingChangeInsert } from "../../_shared/types.ts";

interface FetchUpdatesResult {
  total_fetched: number;
  new_repeaters: number;
  updates: number;
  deactivations: number;
  reactivations: number;
  skipped_no_diff: number;
  already_pending: number;
  auto_applied: number;
  errors: number;
}

export class FetchUpdatesController {
  constructor(
    private repeaterRepo: RepeaterRepository,
    private fetchLatestUpdatesUseCase: FetchLatestUpdatesUseCase,
    private compareWithLocalUseCase: CompareWithLocalUseCase,
    private evaluateActivationStatusUseCase: EvaluateActivationStatusUseCase,
    private storePendingChangeUseCase: StorePendingChangeUseCase,
    private supabaseUrl: string,
    private serviceRoleKey: string,
  ) {}

  async handle(autoApply = false): Promise<FetchUpdatesResult> {
    const result: FetchUpdatesResult = {
      total_fetched: 0,
      new_repeaters: 0,
      updates: 0,
      deactivations: 0,
      reactivations: 0,
      skipped_no_diff: 0,
      already_pending: 0,
      auto_applied: 0,
      errors: 0,
    };

    const records = await this.fetchLatestUpdatesUseCase.execute();
    result.total_fetched = records.length;

    for (const record of records) {
      try {
        const localRepeater = await this.findLocalRepeater(record.ID, record);

        // 1) Evaluate activation status (always, regardless of timestamps)
        const activationChange = await this.evaluateActivationStatusUseCase
          .execute(record, localRepeater);

        if (activationChange) {
          await this.processChange(activationChange, autoApply, result);
        }

        // 2) Compare data fields (respects timestamp logic)
        const dataChange = await this.compareWithLocalUseCase.execute(
          record,
          localRepeater,
        );

        if (dataChange) {
          await this.processChange(dataChange, autoApply, result);
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

  private async processChange(
    change: PendingChangeInsert,
    autoApply: boolean,
    result: FetchUpdatesResult,
  ): Promise<void> {
    // Always log the change
    const stored = await this.storePendingChangeUseCase.execute(change);

    if (!stored) {
      result.already_pending++;
      return;
    }

    this.incrementResultCounter(change, result);

    if (autoApply) {
      const changeId = this.storePendingChangeUseCase.getLastInsertedId();
      if (changeId) {
        // Call apply immediately — this marks it as 'approved',
        // which frees the partial unique index for the next change
        // on the same external_id (e.g. activation + data change)
        const applied = await this.callApplyEdgeFunction(changeId);
        if (applied) {
          result.auto_applied++;
          console.log(
            `[AutoApply] ${change.change_type} ${change.external_id}: applied`,
          );
        } else {
          console.error(
            `[AutoApply] ${change.change_type} ${change.external_id}: apply failed`,
          );
          result.errors++;
        }
      }
    }
  }

  private incrementResultCounter(
    change: PendingChangeInsert,
    result: FetchUpdatesResult,
  ): void {
    switch (change.change_type) {
      case "new":
        result.new_repeaters++;
        break;
      case "update":
        result.updates++;
        break;
      case "deactivate":
        result.deactivations++;
        break;
      case "reactivate":
        result.reactivations++;
        break;
    }
  }

  private async callApplyEdgeFunction(changeId: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.supabaseUrl}/functions/v1/apply_pending_change`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.serviceRoleKey}`,
          },
          body: JSON.stringify({
            change_id: changeId,
            action: "approve",
          }),
        },
      );

      if (!response.ok) {
        const body = await response.text();
        console.error(`[AutoApply] HTTP ${response.status}: ${body}`);
        return false;
      }

      return true;
    } catch (error) {
      console.error("[AutoApply] Edge function call failed:", error);
      return false;
    }
  }

  // deno-lint-ignore no-explicit-any
  private async findLocalRepeater(apiId: string, record: any) {
    let localRepeater = await this.repeaterRepo.findByAccessExternalId(apiId);

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

      if (!localRepeater && record.Identificativo) {
        localRepeater = await this.repeaterRepo.findByCallsignAndLocator(
          record.Identificativo,
          record.Locator,
        );
      }

      if (!localRepeater && record.Identificativo) {
        localRepeater = await this.repeaterRepo.findByCallsign(
          record.Identificativo,
        );
      }

      if (localRepeater) {
        console.log(
          `[FetchUpdates] ${apiId}: matched via fallback (repeater=${localRepeater.id})`,
        );
      }
    }

    return localRepeater;
  }
}
