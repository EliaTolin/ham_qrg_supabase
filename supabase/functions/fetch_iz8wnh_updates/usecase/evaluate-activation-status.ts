import type { AccessRepository } from "../../_shared/repository/access-repository.ts";
import type { HamQRGUpdateRecord, PendingChangeInsert } from "../../_shared/types.ts";

// deno-lint-ignore no-explicit-any
type LocalRepeater = Record<string, any>;

export class EvaluateActivationStatusUseCase {
  constructor(private accessRepo: AccessRepository) {}

  async execute(
    record: HamQRGUpdateRecord,
    localRepeater: LocalRepeater | null,
  ): Promise<PendingChangeInsert | null> {
    if (!localRepeater) return null;

    const remoteActive = record.AutoON === "1" && record.ManualON === "1";
    const localActive = localRepeater.is_active !== false;

    // Check how many accesses this repeater has
    const accesses = await this.accessRepo.findByRepeaterId(localRepeater.id);
    const hasMultipleAccesses = accesses.length > 1;

    // No change in activation status
    if (remoteActive === localActive && !hasMultipleAccesses) return null;
    if (remoteActive && hasMultipleAccesses) return null; // all good

    // If deactivating and repeater has multiple accesses:
    // suggest deactivating only this access, not the whole repeater
    if (!remoteActive && hasMultipleAccesses) {
      const diff: Record<string, { local: unknown; remote: unknown }> = {
        is_active: { local: true, remote: false },
        AutoON: { local: null, remote: record.AutoON },
        ManualON: { local: null, remote: record.ManualON },
        scope: { local: null, remote: "access" },
      };

      console.log(
        `[EvaluateActivation] ${record.ID}: deactivate ACCESS (repeater has ${accesses.length} accesses)`,
      );

      return {
        repeater_id: localRepeater.id,
        external_id: record.ID,
        change_type: "deactivate",
        remote_data: record,
        diff,
        remote_updated_at: null,
        local_updated_at: localRepeater.updated_at,
        suggested_winner: "remote",
      };
    }

    // Single access or reactivation: affect the whole repeater
    if (remoteActive === localActive) return null;

    const changeType = remoteActive ? "reactivate" : "deactivate";
    const diff: Record<string, { local: unknown; remote: unknown }> = {
      is_active: { local: localActive, remote: remoteActive },
      scope: { local: null, remote: "repeater" },
    };

    if (!remoteActive) {
      diff.AutoON = { local: null, remote: record.AutoON };
      diff.ManualON = { local: null, remote: record.ManualON };
    }

    console.log(
      `[EvaluateActivation] ${record.ID}: ${changeType} REPEATER (AutoON=${record.AutoON}, ManualON=${record.ManualON})`,
    );

    return {
      repeater_id: localRepeater.id,
      external_id: record.ID,
      change_type: changeType,
      remote_data: record,
      diff,
      remote_updated_at: null,
      local_updated_at: localRepeater.updated_at,
      suggested_winner: "remote",
    };
  }
}
