# Data Model Requirements Quality Checklist: Cluster Spots

**Purpose**: Author self-check (pre-PR) for the *quality* of the data model requirements — schema, constraints, FK actions, indexes, RLS policies, edge cases. Validates that the specification of the data layer is complete, unambiguous, internally consistent, and ready to be implemented as 3 SQL migrations + tests. Tests the requirements, not the implementation.
**Created**: 2026-04-11
**Feature**: [spec.md](../spec.md), [data-model.md](../data-model.md), [research.md](../research.md)
**Audience & timing**: Author self-check before opening the PR for the 3 cluster-spots migrations.
**Depth**: Standard (~20 items, requirement-quality focused).

## Schema Completeness

- [x] CHK001 - Are all columns required by the functional specification documented in `data-model.md` (author, repeater, callsign-snapshot or live-callsign decision, optional access, started_at, duration, expires, closed_at)? [Completeness, Spec §FR-012, data-model §1] — Tutte presenti: user_id, repeater_id, callsign_snapshot (aggiunto C5), access_id, started_at, duration_minutes, expires_at, closed_at.
- [x] CHK002 - Is it explicitly specified whether `callsign` is **snapshot** at spot creation or **resolved live** at read time, and which one satisfies the "registra callsign al momento della creazione" wording of FR-012? [Ambiguity, Spec §FR-012, data-model §1] — Risolto C5: colonna `callsign_snapshot text NOT NULL`, snapshot immutabile. FR-012 aggiornato di conseguenza.
- [x] CHK003 - Is the `closed_by` column's purpose, value domain, and v1 expected value (`= user_id` or `NULL`) documented, given that admin moderation is out-of-scope (Q5)? [Clarity, data-model §1, §9] — Risolto C8: documentato come "forward-compat, non FR-mandated, v1: sempre user_id o NULL".
- [x] CHK004 - Are the data types and units of every column specified unambiguously (e.g. `duration_minutes` as `smallint`, all timestamps as `timestamptz`)? [Clarity, data-model §1] — Tutti i tipi espliciti nella tabella §1: uuid, text, timestamptz, smallint. Unità nel nome colonna (duration_minutes).
- [x] CHK005 - Is the `expires_at` generated column expression specified deterministically (formula, `STORED` vs `VIRTUAL`, immutability under `started_at` updates)? [Completeness, data-model §1] — Formula esplicita, STORED dichiarato. started_at non è aggiornabile dal client (RPC non lo espone). Postgres impedisce UPDATE su generated columns.

## Constraints & Invariants

- [x] CHK006 - Is the SC-006 invariant ("max 1 active spot per user, atomicity guaranteed, no observable double-active") expressed as an explicit data-model requirement (partial unique index) and not only as a process step inside an RPC? [Completeness, Spec §SC-006, data-model §2] — Sì: `idx_spots_active_per_user UNIQUE (user_id) WHERE closed_at IS NULL` in §2, con nota "drive di SC-006".
- [x] CHK007 - Is the asymmetry between "active for unique index" (`closed_at IS NULL`) and "active for visualization" (`closed_at IS NULL AND expires_at > now()`) documented as a deliberate design decision rather than an inconsistency? [Consistency, Spec §FR-006, research §2, data-model §2] — Sì: blocco "Asimmetria intenzionale" in §2, cross-ref a research §2.
- [x] CHK008 - Are all CHECK constraints (duration range, temporal coherence `closed_at >= started_at`, `closed_by` consistency) listed and traced back to functional requirements? [Completeness, Spec §FR-002, §FR-012, data-model §1] — 3 CHECK nominati in §1 con SQL esplicito. duration → FR-002, temporal → FR-012, closed_by → integrità interna.
- [x] CHK009 - Is the requirement that the access (when provided) MUST belong to the spot's repeater expressed *both* as a declarative DB constraint *and* as an RPC pre-validation, and is the rationale for the duplication documented? [Consistency, Spec §FR-005, research §4, data-model §1] — Composite FK in §1, RPC pre-validation in §7, rationale "defense in depth" in research §4.
- [x] CHK010 - Is the precondition `UNIQUE(id, repeater_id)` on `repeater_access` documented as required for the composite FK, including the idempotent migration pattern given Postgres lacks `ADD CONSTRAINT IF NOT EXISTS` for UNIQUE? [Completeness, data-model §3.3] — §3.3 documenta UNIQUE + `DO $$ pg_constraint $$` pattern per idempotenza.

## State Transitions & Derived State

- [x] CHK011 - Is the decision "state is derived, not persisted" stated as a requirement (not just an implementation choice in research) and is the predicate for each of the 3 logical states unambiguous? [Clarity, research §1, data-model §6] — Tabella predicati in data-model §1 "Stato derivato". FR-010 in spec.md (fix C1) lo dichiara esplicitamente come requisito.
- [x] CHK012 - Are all valid state transitions enumerated (active→expired, active→closed, expired→closed) and are illegal transitions (e.g. closed→active) explicitly forbidden? [Completeness, data-model §6] — Diagramma mermaid in §6 enumera le 3 transizioni valide. closed→active impossibile: nessuna RPC resetta closed_at, la policy UPDATE non permette annullamento, l'assenza dell'arco nel diagramma lo rende implicito.
- [x] CHK013 - Is the requirement that the `expired` state MUST NOT trigger any DB write (no cron, no auto-update) explicitly captured, and is the consequence "no realtime event for expiry" documented for client consumers? [Coverage, Spec §SC-004, research §1, data-model §6] — data-model §6: "non una transizione fisica". FR-018/FR-019 (fix C2): "NON genera un evento realtime". realtime.md §3: "NON c'è un evento dedicato".
- [x] CHK014 - Is it specified what happens to the `closed_at`/`closed_by` columns when an active spot is replaced by a new one via `create_spot` (must be set to `now()` and `auth.uid()`, atomically with the new INSERT)? [Completeness, Spec §FR-007, data-model §6] — §6 "Punti chiave" bullet 3 + rpc.md §3 steps 6+7: UPDATE closed_at/closed_by + INSERT nella stessa transazione implicita.

## FK Actions & Cascade Behavior

- [x] CHK015 - Are the `ON DELETE` actions specified for *every* FK on `repeater_spots` (user_id, repeater_id, access_id, closed_by), and is each one traced to the clarification or spec decision that justifies it? [Completeness, data-model §1, §9] — 4 FK con ON DELETE esplicito in §1. Rationale per ciascuno in research §5 (Decision 5).
- [x] CHK016 - Is the requirement "soft-disable repeater (`is_active=false`) does NOT cascade-delete or modify spots" explicitly captured, given that `repeater_id` has `ON DELETE CASCADE`? [Clarity, Spec §Edge Cases "Ponte disattivato/eliminato", data-model §1, §9] — FK §1 commento: "soft-disabled via is_active=false (no FK fire)". §9: "Soft is_active=false non triggera FK".
- [x] CHK017 - Is the GDPR cancellation requirement "all spots of the deleted user are physically removed in cascade" expressed both at the entity-relationship level (FK CASCADE on user_id) AND validated against the edge case "cancellazione account di un utente con spot attivo (realtime propagation)"? [Consistency, Spec §FR-011a + Edge Cases, data-model §1, §9] — FR-011a + FK CASCADE in §1 + edge case in spec + §9 entry "Cancellazione account". Coerenti.

## Indexes & Query Coverage

- [x] CHK018 - Are all required indexes (per-repeater listing, global 24h listing, partial unique for active enforcement) specified with their backing query and the corresponding functional requirement? [Completeness, Spec §FR-013, §FR-014, §SC-002, §SC-006, data-model §2] — 3 indici in §2, ciascuno con "drive di FR-xxx / SC-xxx".
- [x] CHK019 - Are the index requirements expressed in a measurable way (i.e. linked to a SC, not just "for performance")? [Measurability, Spec §SC-002, data-model §2] — idx_active_per_user → SC-006 diretto. idx_repeater_started e idx_started → FR-013/FR-014 che supportano SC-002/SC-010.

## RLS & Security Surface Documented in Data Model

- [x] CHK020 - Are the 4 distinct RLS surfaces specified (SELECT for any authenticated, INSERT only via RPC `SECURITY DEFINER`, UPDATE owner-only, DELETE forbidden), and is the rationale for blocking direct INSERT documented (atomicity of "1 active per user")? [Completeness, Spec §FR-038–FR-041, data-model §5] — 4 superfici in §5 con SQL e commenti. Blocco INSERT: "atomicità 1-active-per-user + validazione callsign".
- [x] CHK021 - Is the absence of an admin update/delete policy in v1 explicitly documented (so a future reviewer doesn't add one by mistake)? [Clarity, Spec §FR-031–FR-035 removed by Q5, data-model §5] — Aggiunta nota esplicita in §5 "Note di sicurezza": "Nessuna policy admin in v1 [...] un futuro reviewer NON deve aggiungerne una senza riaprire il design".

## Edge Cases & Cross-Spec Consistency

- [x] CHK022 - Are the data-model implications of every edge case from `spec.md` ("doppia creazione concorrente", "stato in transizione scaduto", "orologio del client errato", "ponte disattivato/eliminato", "access rimosso") addressed in `data-model.md`? [Coverage, Spec §Edge Cases, data-model §9] — Tutti affrontati: concorrenza→§2 unique, scaduto→§6 derivato, orologio→§1 DEFAULT now(), ponte→§1 FK+§9, access→§1 SET NULL+§9, callsign→§9 snapshot, connessione→§6 tx implicita, account→§1 CASCADE+§9.
- [x] CHK023 - Is the "server-authoritative timestamps" requirement (Spec edge case "orologio del client errato") expressed as a data-model rule (`DEFAULT now()` server-side, no client-supplied `started_at`)? [Clarity, Spec §Edge Cases, data-model §1] — §1: `started_at DEFAULT now()`. La RPC non espone il parametro → protezione strutturale.
- [x] CHK024 - Is the "validazione callsign solo non-vuoto" decision (Q2) reflected in the data model section as a documented validation rule, distinguishing it from "stored constraint" (which is impossible cross-table)? [Consistency, Spec §FR-004, research §3, data-model §7] — §7: callsign → solo "RPC step 2" (distinto dalla durata che ha CHECK + RPC). research §3 documenta perché non è CHECK cross-table.
- [x] CHK025 - Is the relationship between `repeater_spots.access_id` being NULL ("generic spot") and the visualization requirements (FR-013, FR-015) consistent — i.e. does the data model explicitly support and require the NULL case? [Consistency, Spec §FR-003, data-model §1] — §1: `access_id uuid YES NULL`. FK composite ammette null (standard Postgres). Commento: "lo spot diventa 'generico'". Coerente con FR-003.

## Notes

- This checklist tests requirement quality, not implementation behavior. Each item asks "is this aspect specified well enough?", not "does this work?".
- Items mostly trace to either `data-model.md` sections or `spec.md` FR/SC; gaps where the requirement is missing entirely are tagged `[Gap]` (none in this run — the data model is mature).
- After resolving each item, mark `[x]` and add a one-line note inline if the spec/data-model was updated.
- Recommended order of resolution: CHK002 (snapshot vs live callsign — open ambiguity) → CHK003 (closed_by purpose) → then top-down.
