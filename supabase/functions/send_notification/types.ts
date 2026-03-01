/** Testi multilingua: chiave = codice ISO 639-1, valore = testo */
export type LocalizedText = Record<string, string>;

/** Richiesta di invio notifica push */
export interface NotificationRequest {
  /** ID utenti Supabase a cui inviare (auth.uid) tramite include_aliases */
  include_external_user_ids?: string[];
  /** Segmenti OneSignal (es. "All", "Active Users") */
  included_segments?: string[];
  /** Titolo multilingua: {"en": "Title", "it": "Titolo"} */
  headings: LocalizedText;
  /** Corpo multilingua: {"en": "Body", "it": "Corpo"} */
  contents: LocalizedText;
  /** Dati custom allegati alla notifica */
  data?: Record<string, string>;
  /** URL o deep link da aprire al tap */
  url?: string;
}

/** Risultato dell'invio notifica */
export interface NotificationResult {
  id: string;
}
