# Repeater Submissions

Funzionalità che permette a chiunque (utenti autenticati o anonimi) di segnalare nuovi ripetitori non ancora presenti nel database. Per gli utenti anonimi, il `user_id` sarà quello dell'utente anonimo di Supabase. Le segnalazioni vengono revisionate dalla dashboard e, se approvate, convertite in ripetitori reali.

## Flusso

1. L'utente compila un form nell'app con i dati del ripetitore e i relativi accessi
2. Viene creata una riga in `repeater_submissions` con status `pending`
3. Un Database Webhook invia una notifica Telegram al canale admin
4. Dalla dashboard, l'admin/bridge_manager revisiona la segnalazione
5. Se approvata: l'admin crea il ripetitore in `repeaters` + `repeater_access` a partire dai dati della submission e aggiorna lo status a `approved`
6. Se rifiutata: l'admin aggiorna lo status a `rejected`

## Schema

### Tabella `repeater_submissions`

| Campo           | Tipo              | Nullable | Default         | Note                                          |
|-----------------|-------------------|----------|-----------------|-----------------------------------------------|
| id              | uuid              | NO       | gen_random_uuid | PK                                            |
| user_id         | uuid              | NO       |                 | FK → auth.users(id), FK → profiles(id)        |
| name            | text              | SI       |                 | Almeno uno tra `name` e `callsign` richiesto  |
| callsign        | text              | SI       |                 | Almeno uno tra `name` e `callsign` richiesto  |
| frequency_hz    | bigint            | NO       |                 | Frequenza in Hz, deve essere > 0              |
| shift_hz        | bigint            | SI       |                 | Shift in Hz                                   |
| region          | text              | SI       |                 |                                               |
| province_code   | text              | SI       |                 |                                               |
| locality        | text              | SI       |                 |                                               |
| lat             | double precision  | SI       |                 | Latitudine (-90, 90)                          |
| lon             | double precision  | SI       |                 | Longitudine (-180, 180)                       |
| locator         | text              | SI       |                 | Maidenhead locator                            |
| accesses        | jsonb             | NO       | '[]'            | Array di oggetti accesso                      |
| notes           | text              | SI       |                 | Note libere dell'utente                       |
| status          | submission_status | NO       | 'pending'       | pending / approved / rejected                 |
| created_at      | timestamptz       | NO       | now()           |                                               |

### Constraints

- `CHECK (name IS NOT NULL OR callsign IS NOT NULL)` — almeno uno dei due identificativi
- `CHECK (frequency_hz > 0)` — frequenza valida
- `CHECK (lat IS NULL OR (lat BETWEEN -90 AND 90))` — latitudine valida
- `CHECK (lon IS NULL OR (lon BETWEEN -180 AND 180))` — longitudine valida

### Enum `submission_status`

```sql
CREATE TYPE public.submission_status AS ENUM ('pending', 'approved', 'rejected');
```

### Formato campo `accesses`

Array JSON di oggetti. Ogni oggetto rappresenta un accesso del ripetitore. I campi rispecchiano la tabella `repeater_access` in produzione.

**Esempi per tipo di accesso:**

```json
[
  {
    "mode": "ANALOG",
    "ctcss_tx_hz": 88.5,
    "ctcss_rx_hz": 88.5,
    "dcs_code": null
  },
  {
    "mode": "DMR",
    "color_code": 1,
    "talkgroup": 222801,
    "network_name": "BM Italia"
  },
  {
    "mode": "C4FM",
    "dg_id": 0,
    "network_name": "YSF Italy"
  },
  {
    "mode": "DSTAR",
    "network_name": "IRCDDB"
  },
  {
    "mode": "ECHOLINK",
    "node_id": 1234
  },
  {
    "mode": "SVX",
    "node_id": 5678,
    "network_name": "SvxLink Italy"
  },
  {
    "mode": "APRS"
  },
  {
    "mode": "BEACON"
  },
  {
    "mode": "ATV"
  },
  {
    "mode": "NXDN"
  },
  {
    "mode": "ALLSTAR",
    "node_id": 12345
  },
  {
    "mode": "WINLINK"
  }
]
```

**Campi supportati per ogni accesso** (tutti opzionali tranne `mode`):

| Campo          | Tipo    | Applicabile a                  | Note                              |
|----------------|---------|--------------------------------|-----------------------------------|
| mode           | string  | Tutti                          | **Obbligatorio**. Valori: ANALOG, DMR, C4FM, DSTAR, ECHOLINK, SVX, APRS, BEACON, ATV, NXDN, ALLSTAR, WINLINK |
| ctcss_tx_hz    | number  | ANALOG                         | Tono CTCSS TX in Hz (0-300)      |
| ctcss_rx_hz    | number  | ANALOG                         | Tono CTCSS RX in Hz (0-300)      |
| dcs_code       | integer | ANALOG                         | Codice DCS (0-999)               |
| color_code     | integer | DMR                            | Color code (0-15)                |
| talkgroup      | integer | DMR                            | Talkgroup DMR                    |
| dg_id          | integer | C4FM                           | DG-ID (0-99)                     |
| node_id        | integer | ECHOLINK, SVX, ALLSTAR         | Node ID                          |
| network_name   | string  | DMR, C4FM, DSTAR, SVX          | Nome della rete associata        |
| notes          | string  | Tutti                          | Note libere per l'accesso        |

## RLS (Row Level Security)

| Operazione | Ruolo              | Regola                                                    |
|------------|--------------------|-----------------------------------------------------------|
| INSERT     | anon, authenticated | Chiunque può inserire con `user_id = auth.uid()`  |
| SELECT     | authenticated      | Solo le proprie submission (`user_id = auth.uid()`)       |
| SELECT     | admin, bridge_manager | Tutte (`authorize('reports.manage')`)                  |
| UPDATE     | admin, bridge_manager | Tutte (`authorize('reports.manage')`) — per cambiare status |
| DELETE     | admin, bridge_manager | Tutte (`authorize('reports.manage')`)                  |
| ALL        | service_role       | Accesso completo (bypass RLS)                             |

## Dashboard

La gestione delle submission avviene nella dashboard Next.js, sotto la sezione `/submissions`.

### Pagine

| Route                     | Descrizione                              |
|---------------------------|------------------------------------------|
| `/submissions`            | Lista di tutte le submission con filtri   |
| `/submissions/[id]`       | Dettaglio singola submission             |

### Lista submissions (`/submissions`)

- Tabella con colonne: **Nome/Callsign**, **Frequenza**, **Località**, **Accessi** (count), **Segnalato da**, **Stato**, **Data**
- Filtro per status: `all`, `pending`, `approved`, `rejected`
- Ordinamento: prima le `pending`, poi per data decrescente
- Solo visibile a utenti con ruolo `admin` o `bridge_manager`

### Dettaglio submission (`/submissions/[id]`)

Mostra tutti i dati della segnalazione organizzati in sezioni:

**1. Header**
- Nome/Callsign + Badge dello status
- Pulsante elimina (con conferma)

**2. Dati ripetitore**
- Frequenza (formattata in MHz), Shift
- Località, Provincia, Regione
- Coordinate (lat/lon) e/o Locator
- Note dell'utente

**3. Accessi segnalati**
- Card per ogni accesso nel JSON `accesses`
- Mostra mode (badge colorato) + campi specifici (CTCSS, Color Code, Talkgroup, Node ID, DG-ID, network)

**4. Metadata**
- Segnalato da (callsign o nome dal profilo, oppure "Anonimo" se utente anonimo)
- Data creazione

**5. Azioni admin** (solo se `canManage`)
- Select per cambiare status: `pending` → `approved` / `rejected`
- Quando si approva: l'admin crea manualmente il ripetitore dalla pagina `/repeaters` usando i dati della submission come riferimento

### Server Actions

File: `src/app/actions/submissions.ts`

| Action                     | Descrizione                                   |
|----------------------------|-----------------------------------------------|
| `updateSubmissionStatus`   | Aggiorna lo status (pending → approved/rejected) |
| `deleteSubmission`         | Elimina la submission                         |

Entrambe richiedono il permesso `reports.manage`.

## Notifica Telegram via Trigger SQL

Sia `repeater_reports` che `repeater_submissions` utilizzano la stessa funzione trigger **`notify_telegram_on_insert()`** che chiama la edge function `notify_telegram_report` via `net.http_post`.

### Funzione trigger generica

La funzione `notify_telegram_on_insert()` è riutilizzabile per qualsiasi tabella. Usa le variabili speciali di PostgreSQL (`TG_OP`, `TG_TABLE_NAME`, `TG_TABLE_SCHEMA`) per costruire un payload simile a quello dei webhook Supabase:

```json
{
  "type": "INSERT",
  "table": "repeater_submissions",
  "schema": "public",
  "record": { ... tutti i campi della riga ... }
}
```

### Trigger attivi

| Trigger                            | Tabella                | Evento | Funzione                    |
|------------------------------------|------------------------|--------|-----------------------------|
| trg_notify_telegram_on_report      | repeater_reports       | INSERT | notify_telegram_on_insert() |
| trg_notify_telegram_on_submission  | repeater_submissions   | INSERT | notify_telegram_on_insert() |

La edge function legge `body.table` per determinare il formato del messaggio:

- `"repeater_reports"` → 🚨 Nuovo report
- `"repeater_submissions"` → 📡 Nuovo ripetitore segnalato

### Requisiti Vault

La funzione legge i secrets dal Vault (stessa configurazione usata da `notify_on_user_notification`):

- `project_url` — URL del progetto Supabase (es. `http://kong:8000` in locale)
- `service_role_key` — Service role key per autenticare la chiamata
