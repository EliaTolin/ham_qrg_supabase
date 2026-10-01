import type { RepeaterRepository } from "../../_shared/repository/repeater-repository.ts";
import type { ApplyChangeUseCase } from "../../_shared/usecase/apply-change.ts";
import type { PendingChangeRepository } from "../../_shared/repository/pending-change-repository.ts";
import type { FetchLatestUpdatesUseCase } from "../usecase/fetch-latest-updates.ts";
import type { CompareWithLocalUseCase } from "../usecase/compare-with-local.ts";
import type { EvaluateActivationStatusUseCase } from "../usecase/evaluate-activation-status.ts";
import type { StorePendingChangeUseCase } from "../usecase/store-pending-change.ts";
import type {
  HamQRGUpdateRecord,
  PendingChangeInsert,
} from "../../_shared/types.ts";

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
  /** update trattenuti per review umana: conflitto con modifiche locali */
  held_for_review: number;
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
    private pendingChangeRepo: PendingChangeRepository,
    private applyChangeUseCase: ApplyChangeUseCase,
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
      held_for_review: 0,
      errors: 0,
    };

    console.log("[Sync] Step 1/4: Fetching updates from iz8wnh...");
    const records = await this.fetchLatestUpdatesUseCase.execute();
    result.total_fetched = records.length;
    console.log(`[Sync] Fetched ${records.length} records`);

    if (records.length === 0) return result;

    console.log("[Sync] Step 2/4: Building local cache...");
    const index = await this.buildIndex();
    console.log(
      `[Sync] Cache ready: ${index.byExtId.size} repeaters, ${index.byAccessExtId.size} accesses`,
    );

    console.log(`[Sync] Step 3/4: Comparing ${records.length} records...`);
    for (const record of records) {
      try {
        const localRepeater = this.findLocalRepeater(record, index);
        const accesses = localRepeater
          ? index.accessesByRepeaterId.get(localRepeater.id) ?? []
          : [];

        const activationChange = this.evaluateActivationStatusUseCase
          .executeInMemory(record, localRepeater, accesses);

        const dataChange = await this.compareWithLocalUseCase.execute(
          record,
          localRepeater,
          accesses,
        );

        if (activationChange && dataChange) {
          const merged: PendingChangeInsert = {
            ...activationChange,
            diff: { ...activationChange.diff, ...dataChange.diff },
          };
          await this.processChange(merged, autoApply, result, true);
        } else if (activationChange) {
          await this.processChange(activationChange, autoApply, result, false);
        } else if (dataChange) {
          await this.processChange(dataChange, autoApply, result, false);
        } else {
          result.skipped_no_diff++;
        }
      } catch (error) {
        console.error(`[Sync] Error on record ${record.ID}:`, error);
        result.errors++;
      }
    }

    console.log(
      `[Sync] Step 4/4: Done — new=${result.new_repeaters} updates=${result.updates} deact=${result.deactivations} react=${result.reactivations} skip=${result.skipped_no_diff} applied=${result.auto_applied} review=${result.held_for_review} errors=${result.errors}`,
    );
    return result;
  }

  /**
   * @param carriesDataDiff - true quando il change e' il merge di un cambio di
   *   attivazione e di un diff sui dati: i campi dati non vanno auto-applicati.
   */
  private async processChange(
    change: PendingChangeInsert,
    autoApply: boolean,
    result: FetchUpdatesResult,
    carriesDataDiff: boolean,
  ): Promise<void> {
    const stored = await this.storePendingChangeUseCase.execute(change);

    if (!stored) {
      result.already_pending++;
      return;
    }

    this.incrementResultCounter(change, result);

    // Un update che tocca campi modificati da noi non si applica da solo:
    // resta 'pending' e lo decide un umano dalla dashboard. new, deactivate e
    // reactivate restano automatici: sono fatti dichiarati dalla fonte, non
    // conflitti di merito.
    if (this.needsHumanReview(change, carriesDataDiff)) {
      result.held_for_review++;
      console.log(
        `[Sync] ${change.external_id}: conflitto con modifiche locali, tenuto in review (winner=${change.suggested_winner})`,
      );
      return;
    }

    if (autoApply) {
      const changeId = this.storePendingChangeUseCase.getLastInsertedId();
      if (!changeId) return;

      try {
        const pc = {
          id: changeId,
          repeater_id: change.repeater_id,
          external_id: change.external_id,
          change_type: change.change_type,
          remote_data: change.remote_data,
          diff: change.diff,
        };

        const ok = await this.applyChangeUseCase.execute(pc);

        if (ok) {
          await this.pendingChangeRepo.markApproved(changeId);
          result.auto_applied++;
        } else {
          result.errors++;
        }
      } catch (error) {
        console.error(
          `[Sync] Auto-apply failed for ${change.external_id}:`,
          error,
        );
        result.errors++;
      }
    }
  }

  /**
   * true se il change non va applicato in automatico.
   *
   * Due casi, entrambi update sui dati:
   *   - suggested_winner='local': il record locale e' stato toccato dopo
   *     l'export remoto, quindi c'e' una correzione nostra da non perdere;
   *   - carriesDataDiff: il change unisce attivazione e dati, e prima il flag
   *     skipTimestampCheck disattivava ogni protezione sui campi dati.
   *
   * Un 'new' non ha nulla di locale da sovrascrivere; deactivate e reactivate
   * riflettono lo stato dichiarato dalla fonte, autorevole su quello.
   */
  private needsHumanReview(
    change: PendingChangeInsert,
    carriesDataDiff: boolean,
  ): boolean {
    if (carriesDataDiff) return true;
    return change.change_type === "update" &&
      change.suggested_winner === "local";
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

    return (
      index.byExtId.get(key) ??
        index.byFreqLocator.get(key) ??
        (record.Identificativo
          ? index.byCallsignLocator.get(
            `${record.Identificativo}_${record.Locator}`,
          ) ?? index.byCallsign.get(record.Identificativo) ?? null
          : null)
    );
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
}
