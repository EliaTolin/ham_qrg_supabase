import type { MapApiRecordToRepeaterUseCase } from "../../_shared/usecase/map-api-record-to-repeater.ts";
import type { HamQRGUpdateRecord, PendingChangeInsert } from "../../_shared/types.ts";

// deno-lint-ignore no-explicit-any
type LocalRepeater = Record<string, any>;
// deno-lint-ignore no-explicit-any
type LocalAccess = Record<string, any>;

const REPEATER_COMPARE_FIELDS = [
  "name",
  "callsign",
  "frequency_hz",
  "shift_hz",
  "locality",
  "locator",
  "lat",
  "lon",
] as const;

const ACCESS_COMPARE_FIELDS = [
  "ctcss_tx_hz",
  "color_code",
  "node_id",
] as const;

function isRemoteVisible(record: HamQRGUpdateRecord): boolean {
  // AutoON/ManualON arrivano come numeri (1/0): confronto via String().
  return String(record.AutoON) === "1" && String(record.ManualON) === "1";
}

export class CompareWithLocalUseCase {
  constructor(
    private mapApiRecordUseCase: MapApiRecordToRepeaterUseCase,
  ) {}

  /**
   * Compare a remote record with local data.
   * @param accesses - preloaded accesses for this repeater (avoids DB query)
   */
  async execute(
    record: HamQRGUpdateRecord,
    localRepeater: LocalRepeater | null,
    accesses: LocalAccess[] = [],
    skipTimestampCheck = false,
  ): Promise<PendingChangeInsert | null> {
    const remoteVisible = isRemoteVisible(record);

    // New repeater: not in our DB yet. Only create if remote is visible
    // (AutoON=ManualON=1); otherwise the upstream considers it hidden.
    if (!localRepeater) {
      if (!remoteVisible) return null;
      const mapped = await this.mapApiRecordUseCase.execute(record);
      if (!mapped) return null;

      const remoteUpdatedAt = this.parseUltimaModifica(record.Ultima_Modifica);

      return {
        repeater_id: null,
        external_id: record.ID,
        change_type: "new",
        remote_data: record,
        diff: {},
        remote_updated_at: remoteUpdatedAt,
        local_updated_at: null,
        suggested_winner: "remote",
      };
    }

    const remoteUpdatedAt = this.parseUltimaModifica(record.Ultima_Modifica);
    const localUpdatedAt = localRepeater.updated_at;

    // If local is more recent, skip (unless forced by activation change)
    if (!skipTimestampCheck && remoteUpdatedAt && localUpdatedAt) {
      const remoteDate = new Date(remoteUpdatedAt);
      const localDate = new Date(localUpdatedAt);
      if (localDate > remoteDate) {
        return null;
      }
    }

    // Map the remote record to our format
    const mapped = await this.mapApiRecordUseCase.execute(record);
    if (!mapped) return null;

    // --- Repeater field diff ---
    const diff: Record<string, { local: unknown; remote: unknown }> = {};
    for (const field of REPEATER_COMPARE_FIELDS) {
      const localVal = localRepeater[field];
      const remoteVal = mapped.repeater[field];

      if (!this.valuesEqual(localVal, remoteVal)) {
        diff[field] = { local: localVal, remote: remoteVal };
      }
    }

    // --- Access diff (using preloaded accesses) ---
    if (mapped.access) {
      const remoteMode = mapped.access.mode;

      // Find matching local access: by external_id first, then by mode
      let localAccess: LocalAccess | null =
        accesses.find((a) => a.external_id === record.ID) ?? null;

      if (!localAccess) {
        localAccess = accesses.find((a) => a.mode === remoteMode) ?? null;
      }

      if (!localAccess) {
        // New access mode for this repeater — only enroll if remote is visible
        // (AutoON=ManualON=1). Hidden remote records must not create accesses:
        // evaluate-activation-status handles removal of existing accesses when
        // the remote flips to hidden; there is nothing to enroll here.
        if (remoteVisible) {
          diff[`access_${remoteMode}`] = {
            local: null,
            remote: {
              mode: remoteMode,
              ctcss_tx_hz: mapped.access.ctcss_tx_hz,
              color_code: mapped.access.color_code,
              node_id: mapped.access.node_id,
              network_id: mapped.access.network_id,
            },
          };
        }
      } else {
        // Compare access fields
        for (const field of ACCESS_COMPARE_FIELDS) {
          const localVal = localAccess[field];
          const remoteVal = mapped.access[field as keyof typeof mapped.access];
          if (!this.valuesEqual(localVal, remoteVal)) {
            diff[`access.${field}`] = { local: localVal, remote: remoteVal };
          }
        }

        if (localAccess.mode !== remoteMode) {
          diff["access.mode"] = { local: localAccess.mode, remote: remoteMode };
        }
      }
    }

    // No effective differences
    if (Object.keys(diff).length === 0) {
      return null;
    }

    const suggestedWinner = remoteUpdatedAt && localUpdatedAt
      ? (new Date(remoteUpdatedAt) > new Date(localUpdatedAt)
        ? "remote"
        : "unknown")
      : "unknown";

    return {
      repeater_id: localRepeater.id,
      external_id: record.ID,
      change_type: "update",
      remote_data: record,
      diff,
      remote_updated_at: remoteUpdatedAt,
      local_updated_at: localUpdatedAt,
      suggested_winner: suggestedWinner as "remote" | "local" | "unknown",
    };
  }

  private parseUltimaModifica(value: string): string | null {
    if (!value) return null;
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date.toISOString();
  }

  private valuesEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a == null && b == null) return true;
    if (typeof a === "number" && typeof b === "number") {
      return Math.abs(a - b) < 0.0001;
    }
    return false;
  }
}
