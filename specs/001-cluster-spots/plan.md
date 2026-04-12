# Implementation Plan: Cluster Spots — "In ascolto" su un ponte radio

**Branch**: `001-cluster-spots` | **Date**: 2026-04-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-cluster-spots/spec.md`

## Summary

I radioamatori dichiarano "sono in ascolto su questo ponte per N minuti" (1–60). Lo spot è visibile in tempo reale a tutti gli utenti autenticati nella scheda del ponte e in una sezione globale "Ultimi spot" delle ultime 24h, e genera notifiche push agli utenti che hanno il ponte tra i preferiti (con doppio opt-out: globale + per-preferito). Ogni utente ha al massimo 1 spot attivo: la creazione di un nuovo spot chiude automaticamente il precedente. Nessun messaggio libero, nessuna posizione GPS, nessuna moderazione admin in v1, cancellazione account → cascade hard delete degli spot.

**Approccio tecnico**: una sola nuova tabella `public.repeater_spots` con stato derivato (no enum di stato), due RPC `SECURITY DEFINER` (`create_spot`, `close_spot`), un trigger `notify_favorites_on_spot` che fan-out via `user_notifications` (riusando la pipeline push esistente `trg_user_notification_push` → `send_notification`). Niente edge function nuova, niente cron job (lo "scaduto" è derivato da `expires_at <= now()`). Realtime via `supabase_realtime` publication.

## Technical Context

**Language/Version**: PostgreSQL 15+ (Supabase managed) per lo schema; SQL/PLpgSQL per RPC e trigger. Nessun edge function nuovo: la pipeline push riusa le edge function Deno/JSR esistenti (`send_notification`).
**Primary Dependencies**: Supabase Postgres + PostGIS (riusato), `pg_net` per HTTP outbound dai trigger (già configurato), Vault per i secret di edge function (già configurato), Realtime publication `supabase_realtime` (esistente).
**Storage**: PostgreSQL — nuova tabella `public.repeater_spots`; due `ALTER TABLE` su tabelle esistenti (`profiles`, `user_favorite_repeaters`); una `UNIQUE` aggiuntiva su `public.repeater_access(id, repeater_id)` per supportare la composite FK.
**Testing**: pgTAP-style integration via `supabase db reset` + script SQL di test (allineato col pattern del repo, vedi `supabase/tests/`). Unit test JS/Deno solo se si tocca il codice di edge function — non è il caso qui.
**Target Platform**: Supabase Cloud (prod) + Supabase CLI locale (`supabase start`). Client consumer: Flutter app `ham_qrg_flutter` via `supabase_flutter` (RPC + Realtime), dashboard Next.js `ham_qrg_dashboard` solo per lettura (no UI di moderazione in v1).
**Project Type**: Backend service (Supabase) — single project; no frontend in questo repo.
**Performance Goals** (da Spec SC):
  - Spot creato visibile via realtime in <5 s p95 (SC-002)
  - Notifica push consegnata al provider in <30 s p95 (SC-003)
  - Spot "scaduto" dalle viste in <60 s p99 (SC-004) — risolto con stato derivato (zero latenza intrinseca)
  - Latenza percepita di `create_spot` <2 s anche con fan-out 500 favoriti (SC-011)
**Constraints**:
  - RLS obbligatorio su ogni nuova tabella (Constitution §IV)
  - INSERT su `repeater_spots` ammesso solo via RPC `SECURITY DEFINER` (no policy INSERT diretta) per garantire l'invariante "1 attivo per utente" + validazione callsign
  - Le RPC sono atomiche (singola transazione implicita)
  - Nessun rate limit applicativo in v1 (per design)
  - Migrations idempotenti (`IF NOT EXISTS`, safe enum extensions, ecc.)
**Scale/Scope** (assunzioni di progetto):
  - ~migliaia di utenti registrati attivi mensili
  - Picco realistico di spot simultaneamente attivi: ~100 (1 per utente, attivi solo durante l'ascolto)
  - Picco di favoriti per ponte popolare: 500 (riferimento SC-011)
  - Volume notifiche: <100k/giorno worst case (ben sotto i limiti di OneSignal e dei trigger Postgres)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Valutazione contro i 5 principi della constitution v1.0.0 ([.specify/memory/constitution.md](../../.specify/memory/constitution.md)):

### I. DRY & Shared-Code Reuse — ✅ PASS

- Riusa interamente la pipeline push esistente (`user_notifications` + `trg_user_notification_push` + edge function `send_notification`). Zero codice duplicato.
- Riusa il pattern del trigger esistente `notify_favorites_on_feedback` (stesso modello SECURITY DEFINER + loop su `user_favorite_repeaters`) — `notify_favorites_on_spot` ne è la copia conforme con join in più sui flag opt-in.
- Riusa la `Realtime publication` esistente (`supabase_realtime`).
- Riusa le tabelle e i tipi esistenti: `profiles`, `user_favorite_repeaters`, `repeaters`, `repeater_access`.
- Nessuna nuova edge function → niente nuovo codice TS/Deno → nessun helper duplicato in `_shared/`.

### II. SOLID Object Design — ✅ N/A (PASS)

Questa feature è 100% schema + SQL functions: non introduce classi TypeScript. SOLID si applica al codice OOP delle edge function. Conformità mantenuta perché non si tocca codice edge function.

### III. Layered Architecture (index → controller → usecase → repository) — ✅ N/A (PASS)

Stesso motivo di II: non ci sono nuove edge function. Le RPC plpgsql sono il "layer di accesso" naturale del DB e si comportano come "use case atomici" (`create_spot` e `close_spot` fanno una sola cosa ciascuno).

### IV. Production-Grade Code Quality (NON-NEGOTIABLE) — ✅ PASS (con note)

- **Validazione input**: tutte le RPC validano i parametri in ingresso (`AUTH_REQUIRED`, `CALLSIGN_REQUIRED`, `INVALID_DURATION`, `REPEATER_NOT_FOUND`, `INVALID_ACCESS`, `SPOT_NOT_FOUND`, `FORBIDDEN`, `ALREADY_CLOSED`).
- **Errori parlanti**: codici di errore documentati nel contratto API ([contracts/rpc.md](./contracts/rpc.md)) con HTTP equivalente.
- **Migrations idempotenti**: ogni file usa `IF NOT EXISTS`, `CREATE OR REPLACE`, ecc. (vedi `migrations.md` in research).
- **RLS**: enabled su `repeater_spots` con policy esplicite SELECT (authenticated read all) e UPDATE owner-only (no admin update in v1, niente policy admin). INSERT bloccato a livello di policy → solo via RPC.
- **No dipendenze nuove**: nessuna nuova lib npm/jsr/Postgres extension.

### V. Frontend Integration Specification (NON-NEGOTIABLE) — ✅ PASS

L'output di questo plan include `contracts/rpc.md` (contratto RPC) + `contracts/realtime.md` (canali realtime + payload) + `quickstart.md` (esempi end-to-end Dart/Flutter e TS). Tutto scritto in modo che il team frontend (Flutter app) possa integrare senza contesto backend.

### Verdict gate

**PASS** — nessuna violazione dei 5 principi. Nessun entry necessario in Complexity Tracking.

### Post-design re-evaluation (after Phase 1)

Riletti tutti gli artifact prodotti (`research.md`, `data-model.md`, `contracts/rpc.md`, `contracts/realtime.md`, `contracts/rest.md`, `quickstart.md`) contro i 5 principi:

- **I. DRY**: confermato — il trigger fan-out riusa pattern e pipeline esistenti, nessun nuovo helper duplicato in `_shared/`.
- **II. SOLID**: N/A confermato — zero nuovo codice OOP.
- **III. Layered architecture**: N/A confermato — zero nuove edge function.
- **IV. Production quality**: confermato — `data-model.md` documenta esplicitamente l'idempotenza di ogni `ALTER`/CREATE; `contracts/rpc.md` enumera i codici errore con HTTP equivalente; `data-model.md` §5 documenta tutte le RLS; nessuna nuova dipendenza.
- **V. Frontend Integration Spec**: confermato — i 4 file `contracts/*.md` + `quickstart.md` coprono tutti i 5 punti richiesti dalla constitution (mapping in `research.md` Decision 11), e `quickstart.md §7-9` include esplicitamente migration impact, open questions e smoke test end-to-end.

**Verdict post-design**: PASS. Nessuna violazione introdotta in fase di design. Tabella Complexity Tracking resta vuota.

## Project Structure

### Documentation (this feature)

```text
specs/001-cluster-spots/
├── plan.md                  # This file (/speckit.plan output)
├── research.md              # Phase 0 output — decisioni tecniche e alternative
├── data-model.md            # Phase 1 output — schema, indici, vincoli
├── quickstart.md            # Phase 1 output — recipes Flutter/TS end-to-end
├── contracts/               # Phase 1 output
│   ├── rpc.md               #   contratto delle RPC create_spot / close_spot
│   ├── realtime.md          #   canali e payload Realtime
│   └── rest.md              #   query PostgREST autorizzate (lista spot)
├── checklists/
│   └── requirements.md      # già presente (/speckit.specify + /speckit.clarify)
├── spec.md                  # già presente
└── tasks.md                 # /speckit.tasks output (NON creato qui)
```

### Source Code (repository root)

Il progetto è un Supabase backend single-repo. La feature aggiunge solo migrations + opzionali test SQL:

```text
supabase/
├── migrations/
│   ├── <YYYYMMDDhhmmss>_repeater_spots.sql                    # NUOVO — schema, RLS, indici, realtime publication
│   ├── <YYYYMMDDhhmmss>_cluster_notification_preferences.sql  # NUOVO — opt-out flags su profiles + favorites
│   └── <YYYYMMDDhhmmss>_cluster_spot_rpc_and_notify.sql       # NUOVO — create_spot, close_spot, trigger fan-out
├── functions/
│   └── _shared/                                                # NESSUNA modifica
└── tests/
    └── cluster_spots/                                          # NUOVO — test SQL idempotenti
        ├── 010_create_spot_happy.sql
        ├── 020_create_spot_validation.sql
        ├── 030_replace_active_spot.sql
        ├── 040_close_spot.sql
        └── 050_notify_favorites.sql

types/
└── supabase.ts                                                 # rigenerato post-migrations (`supabase gen types typescript --local`)

specs/001-cluster-spots/                                        # vedi sopra
```

**Structure Decision**: Single Supabase backend project (no client code in this repo). Tutta la feature vive in 3 migrations idempotenti + un set di test SQL sotto `supabase/tests/cluster_spots/`. Niente nuove edge function (la pipeline push esistente fa il lavoro), niente nuovo codice TS/Deno. Il client Flutter consuma la feature attraverso le RPC + Realtime channels documentati in `contracts/`. Il riferimento al doc storico [`docs/cluster-spots-technical.md`](../../docs/cluster-spots-technical.md) è da considerarsi **superseded** dalle clarifications del 2026-04-10 (in particolare la rimozione completa della moderazione admin); il presente `plan.md` + i suoi artifact sono la fonte autoritativa.

## Complexity Tracking

> Nessuna violazione del Constitution Check — questa tabella è vuota.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| _(none)_ | _(none)_ | _(none)_ |
