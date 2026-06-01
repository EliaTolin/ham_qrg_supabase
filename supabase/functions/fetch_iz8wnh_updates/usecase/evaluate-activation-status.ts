import type { AccessRepository } from "../../_shared/repository/access-repository.ts";
import type { HamQRGUpdateRecord, PendingChangeInsert } from "../../_shared/types.ts";
import { TIPOLOGIA_MAP } from "../../_shared/constants.ts";

// deno-lint-ignore no-explicit-any
type LocalRepeater = Record<string, any>;
// deno-lint-ignore no-explicit-any
type LocalAccess = Record<string, any>;

export class EvaluateActivationStatusUseCase {
  constructor(private accessRepo: AccessRepository) {}

  /** DB-backed version (for single record processing) */
  async execute(
    record: HamQRGUpdateRecord,
    localRepeater: LocalRepeater | null,
  ): Promise<PendingChangeInsert | null> {
    if (!localRepeater) return null;
    const accesses = await this.accessRepo.findByRepeaterId(localRepeater.id);
    return this.evaluate(record, localRepeater, accesses);
  }

  /** In-memory version (accesses already preloaded) */
  executeInMemory(
    record: HamQRGUpdateRecord,
    localRepeater: LocalRepeater | null,
    accesses: LocalAccess[],
  ): PendingChangeInsert | null {
    if (!localRepeater) return null;
    return this.evaluate(record, localRepeater, accesses);
  }

  private evaluate(
    record: HamQRGUpdateRecord,
    localRepeater: LocalRepeater,
    accesses: LocalAccess[],
  ): PendingChangeInsert | null {
    // L'API restituisce AutoON/ManualON come numeri (1/0): confronto via String()
    // per evitare che `1 === "1"` sia sempre falso e generi falsi deactivate.
    const remoteActive = String(record.AutoON) === "1" &&
      String(record.ManualON) === "1";

    // Remote says active
    if (remoteActive) {
      if (localRepeater.is_active === false) {
        return {
          repeater_id: localRepeater.id,
          external_id: record.ID,
          change_type: "reactivate",
          remote_data: record,
          diff: {
            is_active: { local: false, remote: true },
            scope: { local: null, remote: "repeater" },
          },
          remote_updated_at: null,
          local_updated_at: localRepeater.updated_at,
          suggested_winner: "remote",
        };
      }
      return null;
    }

    // Remote says inactive — find matching access
    const remoteMode = TIPOLOGIA_MAP[record.Tipologia] ?? null;

    const hasThisAccess =
      accesses.some((a: LocalAccess) => a.external_id === record.ID) ||
      (remoteMode
        ? accesses.some((a: LocalAccess) => a.mode === remoteMode)
        : false);

    if (!hasThisAccess) {
      return null;
    }

    // Always deactivate at access level
    return {
      repeater_id: localRepeater.id,
      external_id: record.ID,
      change_type: "deactivate",
      remote_data: record,
      diff: {
        is_active: { local: true, remote: false },
        AutoON: { local: null, remote: record.AutoON },
        ManualON: { local: null, remote: record.ManualON },
        scope: { local: null, remote: "access" },
      },
      remote_updated_at: null,
      local_updated_at: localRepeater.updated_at,
      suggested_winner: "remote",
    };
  }
}
