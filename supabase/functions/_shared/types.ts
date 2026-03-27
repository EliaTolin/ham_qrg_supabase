import type { Database } from "./database.types.ts";

/** Record restituito dall'API HamQRG */
export interface HamQRGRecord {
  ID: string;
  Ripetitore: string;
  Frequenza: string;
  Shift: string;
  Tono: string;
  ColorCode: string | null;
  Stanza: string | null;
  Rete: string | null;
  Lat: string;
  Long: string;
  Localita: string;
  Locator: string;
  Identificativo: string | null;
  Tipologia: string;
  Ultima_Modifica: string;
  QRB: string;
}

/** Dati repeater mappati pronti per l'upsert */
export interface MappedRepeater {
  external_id: string;
  name: string | null;
  callsign: string | null;
  frequency_hz: number;
  shift_hz: number;
  shift_raw: string;
  locality: string | null;
  locator: string;
  lat: number | null;
  lon: number | null;
}

/** Dati access mappati (senza repeater_id, assegnato in fase di sync) */
export interface MappedAccess {
  external_id: string;
  mode: Database["public"]["Enums"]["access_mode"];
  network_id: string | null;
  ctcss_tx_hz: number | null;
  color_code: number | null;
  node_id: number | null;
}

/** Risultato del mapping di un singolo record API */
export interface MappedRecord {
  repeater: MappedRepeater;
  access: MappedAccess | null;
}

/** Esito sync di un singolo record */
export interface SyncRecordResult {
  repeaterOk: boolean;
  accessOk: boolean;
}

/** Record dall'API lastUpdatesOutgoing (estende HamQRGRecord con campi attivazione) */
export interface HamQRGUpdateRecord extends HamQRGRecord {
  AutoON: string;   // "0" or "1"
  ManualON: string; // "0" or "1"
}

/** Dati per una pending change da inserire */
export interface PendingChangeInsert {
  repeater_id: string | null;
  external_id: string;
  change_type: "update" | "new" | "deactivate" | "reactivate";
  remote_data: HamQRGUpdateRecord;
  diff: Record<string, { local: unknown; remote: unknown }>;
  remote_updated_at: string | null;
  local_updated_at: string | null;
  suggested_winner: "remote" | "local" | "unknown";
}

/** Payload messaggio coda */
export interface GridMessage {
  run_id: string;
  lat: number;
  lon: number;
  radius_km: number;
  dry_run: boolean;
  area?: string;
}
