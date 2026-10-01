import type { MapApiRecordToRepeaterUseCase } from "../../_shared/usecase/map-api-record-to-repeater.ts";
import type {
  HamQRGUpdateRecord,
  PendingChangeInsert,
} from "../../_shared/types.ts";

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

/**
 * Marcatore di provenienza manuale in repeaters.source (es. "iz8wnh+manual").
 * Un record cosi' marcato contiene correzioni nostre, nate da segnalazioni
 * verificate: il dump quotidiano della fonte non le sovrascrive in automatico.
 */
const MANUAL_SOURCE_MARKER = "manual";

function hasManualProvenance(localRepeater: LocalRepeater): boolean {
  const source = localRepeater.source;
  return typeof source === "string" &&
    source.toLowerCase().includes(MANUAL_SOURCE_MARKER);
}

function isRemoteVisible(record: HamQRGUpdateRecord): boolean {
  // AutoON/ManualON arrivano come numeri (1/0): confronto via String().
  return String(record.AutoON) === "1" && String(record.ManualON) === "1";
}

export class CompareWithLocalUseCase {
  constructor(
    private mapApiRecordUseCase: MapApiRecordToRepeaterUseCase,
  ) {}

  /**
   * Confronta un record remoto con i dati locali.
   *
   * Si occupa SOLO dei campi dati (anagrafica, frequenze, posizione, accessi).
   * Lo stato di attivazione e' responsabilita' di
   * EvaluateActivationStatusUseCase, che produce un change separato.
   *
   * @param accesses - accessi gia' caricati per questo ripetitore (evita query)
   */
  async execute(
    record: HamQRGUpdateRecord,
    localRepeater: LocalRepeater | null,
    accesses: LocalAccess[] = [],
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

    // Il locale piu' recente del remoto non si tocca. Confronto per GIORNO:
    // Ultima_Modifica e' una data (arriva come mezzanotte), non un istante.
    if (this.localIsNewerByDay(localUpdatedAt, remoteUpdatedAt)) {
      return null;
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
      let localAccess: LocalAccess | null = accesses.find((a) =>
        a.external_id === record.ID
      ) ?? null;

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

    // suggested_winner guida la review in dashboard.
    // 'local' = su questo record ci sono correzioni nostre da non perdere:
    // il controller lo tiene 'pending' invece di auto-applicarlo.
    const suggestedWinner = this.decideWinner(
      localRepeater,
      localUpdatedAt,
      remoteUpdatedAt,
    );

    return {
      repeater_id: localRepeater.id,
      external_id: record.ID,
      change_type: "update",
      remote_data: record,
      diff,
      remote_updated_at: remoteUpdatedAt,
      local_updated_at: localUpdatedAt,
      suggested_winner: suggestedWinner,
    };
  }

  /**
   * Chi dovrebbe prevalere sul conflitto.
   *
   * La provenienza conta piu' della data: l'export remoto si rigenera ogni
   * notte con Ultima_Modifica aggiornata, quindi sul lungo periodo batte
   * qualsiasi timestamp locale. Un record con correzioni manuali va percio'
   * riconosciuto dal campo source, non dall'orologio — era la causa del caso
   * IR1UBC (coordinate corrette a mano il 28/09, riportate alla sede ARI dal
   * run del 30/09).
   */
  private decideWinner(
    localRepeater: LocalRepeater,
    localUpdatedAt: string | null,
    remoteUpdatedAt: string | null,
  ): "remote" | "local" | "unknown" {
    if (hasManualProvenance(localRepeater)) return "local";
    if (!localUpdatedAt || !remoteUpdatedAt) return "unknown";
    return this.sameDay(localUpdatedAt, remoteUpdatedAt) ? "local" : "remote";
  }

  /** true se la modifica locale e' di un giorno successivo all'export remoto. */
  private localIsNewerByDay(
    localUpdatedAt: string | null,
    remoteUpdatedAt: string | null,
  ): boolean {
    if (!localUpdatedAt || !remoteUpdatedAt) return false;
    return this.dayOf(localUpdatedAt) > this.dayOf(remoteUpdatedAt);
  }

  private sameDay(a: string, b: string): boolean {
    return this.dayOf(a) === this.dayOf(b);
  }

  /** YYYY-MM-DD in UTC. */
  private dayOf(iso: string): string {
    return new Date(iso).toISOString().slice(0, 10);
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
