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
  mode: string;
  network_id: string | null;
  ctcss_hz: number | null;
  color_code: number | null;
  dmr_id: number | null;
  notes: string | null;
}

/** Risultato del mapping di un singolo record API */
export interface MappedRecord {
  repeater: MappedRepeater;
  access: MappedAccess | null;
}

/** Risultato del fetch da tutte le grid */
export interface FetchResult {
  records: Map<string, HamQRGRecord>;
  errors: number;
}

/** Esito sync di un singolo record */
export interface SyncRecordResult {
  repeaterOk: boolean;
  accessOk: boolean;
}

/** Statistiche restituite al termine della sync */
export interface SyncStats {
  dry_run: boolean;
  grids_queried: number;
  fetch_errors: number;
  api_records: number;
  repeaters_processed: number;
  access_processed: number;
  sync_errors: number;
  unknown_networks: string[];
  missing_networks: string[];
  elapsed_seconds: number;
}
