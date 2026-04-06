import type { RepeaterRepository } from "../../_shared/repository/repeater-repository.ts";
import type { FetchLatestUpdatesUseCase } from "../usecase/fetch-latest-updates.ts";
import type { CompareWithLocalUseCase } from "../usecase/compare-with-local.ts";
import type { EvaluateActivationStatusUseCase } from "../usecase/evaluate-activation-status.ts";
import type { StorePendingChangeUseCase } from "../usecase/store-pending-change.ts";
import type { PendingChangeInsert, HamQRGUpdateRecord } from "../../_shared/types.ts";

// deno-lint-ignore no-explicit-any
type RepeaterRow = Record<string, any>;
// deno-lint-ignore no-explicit-any
type AccessRow = Record<string, any>;

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

interface RepeaterIndex {
  byAccessExtId: Map<string, RepeaterRow>;
  byExtId: Map<string, RepeaterRow>;
  byFreqLocator: Map<string, RepeaterRow>;
  byCallsignLocator: Map<string, RepeaterRow>;
  byCallsign: Map<string, RepeaterRow | null>;
  accessesByRepeaterId: Map<string, AccessRow[]>;
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

    // Step 1: Fetch from iz8wnh API
    console.log("[Sync] Step 1/4: Fetching updates from iz8wnh...");
    const records = await this.fetchLatestUpdatesUseCase.execute();
    result.total_fetched = records.length;
    console.log(`[Sync] Fetched ${records.length} records`);

    if (records.length === 0) return result;

    // Step 2: Build in-memory index
    console.log("[Sync] Step 2/4: Building local cache...");
    const index = await this.buildIndex();
    console.log(
      `[Sync] Cache ready: ${index.byExtId.size} repeaters, ${index.byAccessExtId.size} accesses`,
    );

    // Step 3: Compare and create pending changes
    console.log(`[Sync] Step 3/4: Comparing ${records.length} records...`);
    for (const record of records) {
      try {
        const localRepeater = this.findLocalRepeater(record, index);
        const accesses = localRepeater
          ? index.accessesByRepeaterId.get(localRepeater.id) ?? []
          : [];

        const activationChange = this.evaluateActivationStatusUseCase
          .executeInMemory(record, localRepeater, accesses);

        // Always run data compare (skip timestamp check if activation changed)
        const dataChange = await this.compareWithLocalUseCase.execute(
          record,
          localRepeater,
          accesses,
          !!activationChange,
        );

        if (activationChange && dataChange) {
          // Merge data diff into the activation change so user sees everything
          const mergedDiff = { ...activationChange.diff, ...dataChange.diff };
          const merged: PendingChangeInsert = {
            ...activationChange,
            diff: mergedDiff,
          };
          await this.processChange(merged, autoApply, result);
        } else if (activationChange) {
          await this.processChange(activationChange, autoApply, result);
        } else if (dataChange) {
          await this.processChange(dataChange, autoApply, result);
        } else {
          result.skipped_no_diff++;
        }
      } catch (error) {
        console.error(`[Sync] Error on record ${record.ID}:`, error);
        result.errors++;
      }
    }

    // Step 4: Done
    console.log(
      `[Sync] Step 4/4: Done — new=${result.new_repeaters} updates=${result.updates} deact=${result.deactivations} react=${result.reactivations} skip=${result.skipped_no_diff} applied=${result.auto_applied} errors=${result.errors}`,
    );
    return result;
  }

  private async buildIndex(): Promise<RepeaterIndex> {
    const index: RepeaterIndex = {
      byAccessExtId: new Map(),
      byExtId: new Map(),
      byFreqLocator: new Map(),
      byCallsignLocator: new Map(),
      byCallsign: new Map(),
      accessesByRepeaterId: new Map(),
    };

    const repeaters = await this.repeaterRepo.fetchAll();
    for (const r of repeaters) {
      if (r.external_id) index.byExtId.set(r.external_id, r);
      if (r.frequency_hz && r.locator) {
        index.byFreqLocator.set(`${r.frequency_hz}_${r.locator}`, r);
      }
      if (r.callsign && r.locator) {
        index.byCallsignLocator.set(`${r.callsign}_${r.locator}`, r);
      }
      if (r.callsign) {
        if (index.byCallsign.has(r.callsign)) {
          index.byCallsign.set(r.callsign, null);
        } else {
          index.byCallsign.set(r.callsign, r);
        }
      }
    }

    const accesses = await this.repeaterRepo.fetchAllAccesses();
    const repeaterById = new Map(repeaters.map((r: RepeaterRow) => [r.id, r]));
    for (const a of accesses) {
      if (a.external_id) {
        const repeater = repeaterById.get(a.repeater_id);
        if (repeater) index.byAccessExtId.set(a.external_id, repeater);
      }
      const list = index.accessesByRepeaterId.get(a.repeater_id) ?? [];
      list.push(a);
      index.accessesByRepeaterId.set(a.repeater_id, list);
    }

    return index;
  }

  private findLocalRepeater(
    record: HamQRGUpdateRecord,
    index: RepeaterIndex,
  ): RepeaterRow | null {
    const byAccess = index.byAccessExtId.get(record.ID);
    if (byAccess) return byAccess;

    const freqHz = Math.round(parseFloat(record.Frequenza) * 1_000_000);
    const key = `${freqHz}_${record.Locator}`;

    const byExtId = index.byExtId.get(key);
    if (byExtId) return byExtId;

    const byFreqLoc = index.byFreqLocator.get(key);
    if (byFreqLoc) return byFreqLoc;

    if (record.Identificativo) {
      const byCallLoc = index.byCallsignLocator.get(
        `${record.Identificativo}_${record.Locator}`,
      );
      if (byCallLoc) return byCallLoc;

      const byCall = index.byCallsign.get(record.Identificativo);
      if (byCall) return byCall;
    }

    return null;
  }

  private async processChange(
    change: PendingChangeInsert,
    autoApply: boolean,
    result: FetchUpdatesResult,
  ): Promise<void> {
    const stored = await this.storePendingChangeUseCase.execute(change);

    if (!stored) {
      result.already_pending++;
      return;
    }

    this.incrementResultCounter(change, result);

    if (autoApply) {
      const changeId = this.storePendingChangeUseCase.getLastInsertedId();
      if (changeId) {
        const applied = await this.callApplyEdgeFunction(changeId);
        if (applied) {
          result.auto_applied++;
        } else {
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
      case "new": result.new_repeaters++; break;
      case "update": result.updates++; break;
      case "deactivate": result.deactivations++; break;
      case "reactivate": result.reactivations++; break;
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
          body: JSON.stringify({ change_id: changeId, action: "approve" }),
        },
      );

      if (!response.ok) {
        const body = await response.text();
        console.error(`[Sync] Auto-apply failed for ${changeId}: ${response.status} ${body}`);
        return false;
      }
      return true;
    } catch (error) {
      console.error(`[Sync] Auto-apply error for ${changeId}:`, error);
      return false;
    }
  }
}
