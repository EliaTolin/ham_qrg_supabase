# Research — Cluster Spots

**Feature**: 001-cluster-spots
**Date**: 2026-04-10
**Status**: complete (all NEEDS CLARIFICATION resolved)

Questo documento risolve le scelte tecniche aperte del Plan, motivandole rispetto allo stato del repo e alle alternative considerate. Tutte le decisioni rispettano la spec [spec.md](./spec.md) e le 5 clarifications del 2026-04-10.

---

## Decision 1 — Stato dello spot: colonna enum vs derivato da `closed_at`/`expires_at`

**Decision**: Stato **derivato**, NON colonna persistita. Tre stati possibili calcolati al volo:
- `active`   ← `closed_at IS NULL AND expires_at > now()`
- `expired`  ← `closed_at IS NULL AND expires_at <= now()`
- `closed`   ← `closed_at IS NOT NULL`

**Rationale**:
- Risolve **gratuitamente** il SC-004 (transizione "scaduto" entro 60 s p99): non c'è transizione, lo stato è una funzione del tempo corrente. Latenza intrinseca: 0.
- Elimina la necessità di un job `pg_cron` o di un trigger `BEFORE SELECT` per "marcare scaduti". Niente cron = niente componente nuova = meno superficie di guasto.
- Coerente con il pattern del progetto (spec funzionale §4 — "non vengono mai cancellati automaticamente"): la riga sopravvive, cambia solo come la interpreti.
- Riduce la complessità della RLS (nessuna policy condizionata sullo stato).

**Alternatives considered**:
- **Enum `spot_state` persistito + cron job di transizione**: introduce un cron job (`pg_cron`) o un trigger periodico, latenza non-zero, possibilità di stati incoerenti tra DB e wall-clock, e una colonna che duplica informazione già contenuta in `expires_at`. Rifiutato.
- **Trigger `BEFORE SELECT` che calcola lo stato**: PostgreSQL non supporta trigger SELECT su tabelle (solo su view); avrebbe richiesto una view `repeater_spots_with_state`, complicando la sottoscrizione realtime (le view non sono nel publication set). Rifiutato.
- **Vista materializzata refreshata**: troppo lenta per realtime. Rifiutato.

**Conseguenza per i client**: il client computa lo stato lato app a partire dai 3 campi (`closed_at`, `expires_at`, `now()`), idealmente con un piccolo helper. Documentato in [contracts/rest.md](./contracts/rest.md) e [quickstart.md](./quickstart.md).

---

## Decision 2 — Vincolo "1 spot attivo per utente": indice unico parziale

**Decision**: `CREATE UNIQUE INDEX idx_spots_active_per_user ON public.repeater_spots (user_id) WHERE closed_at IS NULL`.

**Rationale**:
- È il modo idiomatico in PostgreSQL per esprimere "al massimo una riga 'attiva' per utente". Riconosciuto e ottimizzato dal planner.
- Fornisce **enforcement a livello DB** dell'invariante critico SC-006 ("nessun caso di due spot attivi osservabile"). Anche in presenza di race condition, una delle due transazioni concorrenti fallisce con `unique_violation` e il client può riprovare/mostrare errore.
- Asimmetria intenzionale rispetto al concetto di "attivo lato visualizzazione" (`closed_at IS NULL AND expires_at > now()`): l'indice considera "attivo" qualsiasi spot non chiuso, anche scaduto. La RPC `create_spot` chiude **sempre esplicitamente** lo spot precedente prima di inserire il nuovo, quindi l'indice non viene mai violato dal flusso normale.

**Alternatives considered**:
- **Constraint EXCLUDE**: più complessa, equivalente. Rifiutata per leggibilità.
- **Lock applicativo (`SELECT ... FOR UPDATE`) senza indice**: non protegge contro client che bypassa la RPC. La policy RLS blocca l'INSERT diretto, ma "defense in depth" è preferibile. Rifiutato.
- **Trigger BEFORE INSERT**: duplicato dell'indice unico, peggiore performance. Rifiutato.

---

## Decision 3 — Punto di enforcement della validazione callsign

**Decision**: La validazione "callsign valorizzato" (Q2 clarification: solo non-vuoto dopo trim) viene eseguita **dentro la RPC `create_spot`** come `RAISE EXCEPTION 'CALLSIGN_REQUIRED'` se `coalesce(trim(p.callsign), '') = ''`. Non come CHECK constraint sulla tabella.

**Rationale**:
- Il vincolo coinvolge **due tabelle** (`repeater_spots` e `profiles`); le CHECK constraint Postgres non possono referenziare altre tabelle.
- Permette di restituire un codice di errore parlante (`CALLSIGN_REQUIRED`, HTTP 422) che il client mappa a un messaggio i18n esplicito ("Imposta il tuo callsign nel profilo per usare il cluster").
- L'RPC è già SECURITY DEFINER e già esegue altre validazioni → punto naturale per centralizzarle.
- L'INSERT diretto è bloccato dalla policy RLS (solo via RPC), quindi non c'è bypass.

**Alternatives considered**:
- **Trigger BEFORE INSERT** che fa il join su profiles: equivalente in correttezza, ma rende l'errore meno controllabile (eccezione generica) e splitta la logica di validazione su due posti. Rifiutato.
- **Subquery in CHECK constraint**: non supportato da Postgres CHECK. Non possibile.

---

## Decision 4 — Coerenza `access_id` ↔ `repeater_id`: composite FK

**Decision**: Aggiungere `UNIQUE (id, repeater_id)` su `public.repeater_access` (tecnicamente ridondante perché `id` è già PK, ma necessaria sintatticamente per essere referenziata da una composite FK), e creare in `public.repeater_spots` la composite FK `(access_id, repeater_id) REFERENCES public.repeater_access(id, repeater_id)`. Inoltre la RPC `create_spot` esegue una **pre-validazione** esplicita prima dell'INSERT per dare un errore parlante (`INVALID_ACCESS`) invece dell'errore generico di FK.

**Rationale**:
- L'invariante è semantico: l'access dichiarato deve appartenere al ponte dello spot. Un FK semplice su `access_id` non lo garantirebbe (potrei spottare il ponte X dichiarando un access di Y).
- La composite FK fornisce enforcement **a livello dichiarativo Postgres**, superiore a qualsiasi trigger applicativo (resiste anche a INSERT con bypass dell'RPC, sebbene la policy RLS dovrebbe già bloccarli).
- La pre-validazione nella RPC trasforma l'errore in user-facing: il client mostra "Modalità di accesso non valida per questo ponte" invece di "FK violation 23503".

**Alternatives considered**:
- **Trigger BEFORE INSERT**: duplica logica già esprimibile come constraint. Rifiutato.
- **Validazione solo applicativa nella RPC**: non protegge da bypass futuri (es. se in v2 si introducono altre RPC che inseriscono spot). Rifiutato per defense in depth.
- **`access_id` denormalizzato come testo (es. mode + tg)**: rompe il pattern "FK al catalogo accessi", introduce drift, scarsa qualità del dato. Rifiutato.

---

## Decision 5 — Comportamento delle FK su cancellazione di entità collegate

**Decision**:

| FK | Riferimento | ON DELETE | Motivazione |
|----|-------------|-----------|-------------|
| `repeater_spots.user_id` | `auth.users(id)` | **CASCADE** | Q1 clarification: cancellazione account → hard delete spot. Coerente con FK CASCADE sui `profiles` e `user_favorite_repeaters`. |
| `repeater_spots.repeater_id` | `public.repeaters(id)` | **CASCADE** | Coerente con `user_favorite_repeaters_repeater_id_fkey` (stesso pattern). Operazionalmente i ponti vengono **disattivati** via `is_active=false`, non hard-deleted; il flag non triggera alcuna FK action, quindi gli spot restano attivi fino a scadenza naturale come da Q4 clarification. La CASCADE protegge il caso raro di hard-delete admin. |
| `repeater_spots.access_id` | `public.repeater_access(id, repeater_id)` (composite) | **SET NULL** | Q4 spirit: la rimozione di un access non deve invalidare gli spot storici. Lo spot diventa "generico" sul ponte (FR-003 ammette `access_id` nullo). |

**Rationale**:
- Q1 (cascade hard delete account) impone CASCADE su `user_id`. ✓
- Q4 (spot rimane fino a scadenza quando il ponte è disattivato) è soddisfatta perché la disattivazione è soft (`is_active=false`) e non triggera FK. Per il caso edge raro di hard-delete, CASCADE è coerente con il resto dello schema (favorites cascade allo stesso modo).
- SET NULL su access preserva lo storico anche se il catalogo access viene riconfigurato.

**Alternatives considered**:
- **RESTRICT su `repeater_id`**: bloccherebbe il hard-delete admin di un ponte. Più conservativo ma operativamente fastidioso e incoerente con `user_favorite_repeaters` che è CASCADE. Rifiutato.
- **NO ACTION**: equivale a RESTRICT a fine transazione, stessi cons. Rifiutato.

---

## Decision 6 — Realtime: come propagare le mutazioni con join annidati

**Decision**: Aggiungere `public.repeater_spots` alla pubblicazione `supabase_realtime`. I client si sottoscrivono al canale e, per ogni evento ricevuto, eseguono un **secondo fetch puntuale** con la `select=...` arricchita (join su profiles + repeater + access). Il payload nativo del realtime è limitato alle colonne della tabella e NON include i join.

**Rationale**:
- È il pattern standard documentato di Supabase Realtime: il payload arrivato dal canale serve come "trigger di refresh", non come fonte di verità completa.
- Il secondo fetch è economico (singola riga via PK), molto inferiore ai 5 s del SC-002.
- Riduce la complessità del trigger (nessun PG NOTIFY custom con payload custom — basta la pubblicazione standard).

**Alternatives considered**:
- **`PG NOTIFY` custom con payload pre-arricchito**: richiede listener applicativo dedicato (non c'è infra per questo nel repo), bypassa il canale Supabase Realtime standard. Rifiutato.
- **View `repeater_spots_with_details` aggiunta alla publication**: le view non sono pubblicabili in realtime su Supabase. Non praticabile.
- **Pubblicare anche le tabelle joinate (`profiles`, `repeaters`)**: aumenta drasticamente il volume di eventi WebSocket inutili. Rifiutato.

---

## Decision 7 — Trigger di fan-out notifiche: loop vs INSERT...SELECT

**Decision**: Usare un singolo `INSERT INTO user_notifications ... SELECT ... FROM user_favorite_repeaters JOIN profiles ...` invece del loop riga-per-riga. Equivalente semanticamente, una sola statement, più veloce.

**Rationale**:
- Il loop nel pattern esistente (`notify_favorites_on_feedback`) è leggibile ma genera N statement separate e N round-trip al planner.
- L'`INSERT...SELECT` Postgres-idiomatico è atomico, indicizzato dal planner una sola volta, e meglio gestito dal trigger downstream `trg_user_notification_push` (che riceve N righe in un solo statement event ma comunque ne fa un trigger per riga FOR EACH ROW — quindi nessuna differenza per pg_net).
- Soddisfa SC-011 (latenza creazione <2 s anche con 500 favoriti): un singolo INSERT...SELECT su 500 righe è ben sotto i 100 ms.

**Alternatives considered**:
- **Loop preservato per coerenza con `notify_favorites_on_feedback`**: leggibilità simile ma performance peggiore. Vincere uniformità qui costa misurabile latenza. Rifiutato (segnalata come opportunità di refactoring del trigger esistente in futuro, ma fuori scope).
- **Batch async con coda**: over-engineering per v1, introduce componenti nuove. Rifiutato per YAGNI.

---

## Decision 8 — Filtraggio dei destinatari: doppio opt-in (globale + per-preferito)

**Decision**: Il fan-out filtra direttamente nella query SELECT del trigger:

```sql
WHERE ufr.repeater_id = NEW.repeater_id
  AND ufr.user_id <> NEW.user_id
  AND ufr.cluster_notifications_enabled = true
  AND p.cluster_notifications_enabled = true
```

I due flag esistono come:
- `public.profiles.cluster_notifications_enabled boolean NOT NULL DEFAULT true` (globale)
- `public.user_favorite_repeaters.cluster_notifications_enabled boolean NOT NULL DEFAULT true` (per-preferito)

**Rationale**:
- Soddisfa direttamente FR-022, FR-024, FR-025 e SC-007 (zero notifiche errate).
- Filtraggio in SQL = un solo round-trip, niente logica applicativa duplicata.
- Default `true` rispetta la spec ("attivo per default").
- L'utente autore è escluso con `ufr.user_id <> NEW.user_id` (FR-023, SC-008).

**Alternatives considered**:
- **Filtraggio dopo l'INSERT in user_notifications con un trigger ulteriore**: duplica logica, costa in più storage. Rifiutato.
- **Tabella separata `cluster_notification_preferences`**: over-normalization per due flag boolean. Rifiutato per YAGNI.

---

## Decision 9 — Migrazioni: numero, ordine, granularità

**Decision**: 3 file di migration distinti, in quest'ordine:

1. `<ts>_repeater_spots.sql` — schema, indici, RLS, realtime publication, UNIQUE precondizione.
2. `<ts>_cluster_notification_preferences.sql` — `ALTER TABLE` su `profiles` e `user_favorite_repeaters`.
3. `<ts>_cluster_spot_rpc_and_notify.sql` — RPC `create_spot` e `close_spot`, trigger `notify_favorites_on_spot`, GRANT EXECUTE.

**Rationale**:
- Separa "data layer" (1) da "preference layer" (2) da "behavior layer" (3): rollback selettivo possibile per file.
- Ogni file resta sotto le ~100 righe, leggibile in review.
- L'ordine è dipendenza-stretta: 3 referenzia colonne di 1 e 2.
- Tutte le migrations sono idempotenti (Constitution §IV — `IF NOT EXISTS`, `CREATE OR REPLACE`).
- Pattern coerente col repo (i.e. `20260301120000_user_notifications.sql` separato da `20260301130000_notify_favorites_on_feedback.sql`).

**Alternatives considered**:
- **Singolo monolite**: meno overhead di file ma più difficile da rivedere e impossibile rollback parziale. Rifiutato.
- **Una migration per RPC**: troppo granulare, file da 20 righe. Rifiutato.

---

## Decision 10 — Strategia di test

**Decision**: Test SQL in `supabase/tests/cluster_spots/`, eseguibili dopo `supabase db reset`. Ogni file è uno scenario specifico, idempotente, che usa `INSERT` di fixture su `auth.users`/`profiles`/`repeaters` di test e poi asserisce con `assert (SELECT count(*) ...) = N` o `RAISE EXCEPTION` se fail.

File previsti:
- `010_create_spot_happy.sql` — utente con callsign, durata 30, no access → spot creato attivo.
- `020_create_spot_validation.sql` — durata 0/61, callsign blank, repeater inesistente, access non appartenente → tutti rifiutati con codici corretti.
- `030_replace_active_spot.sql` — utente crea spot A, poi spot B → A ha `closed_at`, B è l'unico attivo, indice unico mai violato.
- `040_close_spot.sql` — owner chiude, non-owner riceve `FORBIDDEN`, doppia chiusura riceve `ALREADY_CLOSED`.
- `050_notify_favorites.sql` — utente A favorito ponte X, utente B crea spot su X → 1 riga in `user_notifications` per A; A con `cluster_notifications_enabled=false` (globale o per-preferito) → 0 righe; autore B non riceve notifica del proprio spot.

**Rationale**:
- Coerente con lo spazio `supabase/tests/` esistente.
- Niente nuovo framework: SQL puro, eseguito dal CLI Supabase.
- Copre tutti i SC critici (SC-005, SC-006, SC-007, SC-008) e i casi edge clarification.

**Alternatives considered**:
- **pgTAP**: framework più ricco, ma il repo non lo usa attualmente — introdurlo solo per questa feature è scope creep. Rifiutato.
- **Test integration via Deno/Vitest che fa RPC reali**: utile ma più lento e copre meno. Rifiutato come primary, eventualmente complementare in futuro.

---

## Decision 11 — Frontend integration spec: dove vive

**Decision**: La Frontend Integration Spec (Constitution §V, NON-NEGOTIABLE) è soddisfatta dai 4 artifact `contracts/rpc.md`, `contracts/realtime.md`, `contracts/rest.md`, `quickstart.md` di questo plan. Non viene creato un file unico `frontend-integration.md` separato perché la struttura `contracts/ + quickstart.md` di speckit è più granulare e copre tutti i 5 punti richiesti dalla constitution:

| Punto Constitution §V | Coperto da |
|------------------------|------------|
| 1. Endpoint/RPC contract | `contracts/rpc.md` (request, response, errori) |
| 2. Example payloads | `quickstart.md` (Dart + TS) |
| 3. Behavioral notes | `contracts/realtime.md` + `contracts/rest.md` (ordering, finestra 24h, enum, RLS visibili) |
| 4. Migration impact | sezione dedicata in `quickstart.md` (no breaking change su API esistenti) |
| 5. Open questions | sezione finale di `quickstart.md` |

**Rationale**: speckit standard layout > duplicare in un secondo file. Documentato nel plan per chiarezza in review.

---

## Open items risolti durante la ricerca

- ❓ "Serve un job pg_cron per la scadenza?" → ❌ No (Decision 1, stato derivato).
- ❓ "Bisogna aggiungere un permission RBAC nuovo per moderazione?" → ❌ No (Q5 clarification: moderazione admin out of scope v1).
- ❓ "L'autore vede il proprio spot in tempo reale?" → ✓ Sì, dalla stessa publication realtime + filtro `user_id=eq.$me` (vedi `contracts/realtime.md`).
- ❓ "I client devono ricalcolare lo stato 'scaduto' periodicamente?" → ✓ Sì, ma triviale: helper basato su `expires_at - now()` con tick locale al secondo (UI concern).

## Open items deferred (non bloccanti)

- **Reliability/availability SLA**: l'SLO concreto del SC-004 (60 s p99) si riposa interamente sull'orologio del DB Supabase, che è gestito. Non ci sono componenti custom da monitorare per questo SC. Observability sui trigger (logging strutturato di `notify_favorites_on_spot`) è una nice-to-have da affrontare in tasks se diventa rilevante.
- **Eventuale fan-out >1000 favoriti**: out of scope per v1 (cap realistico 500 da SC-011). Refactor in batch async se mai serve.
