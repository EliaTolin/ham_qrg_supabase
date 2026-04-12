---
description: "Task list for Cluster Spots implementation"
---

# Tasks: Cluster Spots — "In ascolto" su un ponte radio

**Input**: Design documents from `/specs/001-cluster-spots/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included. Test strategy is explicitly designed in [research.md §10](./research.md): 5 SQL test files under `supabase/tests/cluster_spots/` covering happy paths, validation, replacement atomicity, owner-only close, and notification fan-out.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- All file paths are absolute or relative to repo root `/Users/eliatolin/Desktop/Aurora/Progetti/HamQRG/ham_qrg_supabase`

## Path Conventions

This is a Supabase backend single-project. Source paths:

- Migrations: `supabase/migrations/`
- SQL tests: `supabase/tests/cluster_spots/` (created by Phase 1)
- Generated types: `types/supabase.ts`
- No new edge functions in this feature.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify the local development environment is ready and create the test directory.

- [x] T001 Verify local Supabase stack is running and current schema is applied: `supabase start && supabase db reset`. Confirm baseline is healthy by listing migrations and checking that `public.profiles`, `public.user_favorite_repeaters`, `public.repeaters`, `public.repeater_access`, `public.user_notifications` and the trigger `trg_user_notification_push` all exist.
- [x] T002 Generate three sequential migration timestamps (ts1=20260411120000, ts2=20260411120100, ts3=20260411120200) (`YYYYMMDDHHMMSS`) for the 3 migration files of this feature, ensuring they are strictly greater than the most recent migration in `supabase/migrations/`. Record the chosen timestamps in a scratch note (used by T004, T005, T008).
- [x] T003 [P] Create test directory `supabase/tests/cluster_spots/` (mkdir only) so that the 5 test files can be authored in parallel later.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, indexes, RLS, opt-in flags, and realtime publication. Everything that all user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T004 Create Migration 1 file `supabase/migrations/<ts1>_repeater_spots.sql` containing, in order:
  - Idempotent `UNIQUE (id, repeater_id)` on `public.repeater_access` (precondition for the composite FK; use the `DO $$ ... pg_constraint ... $$` pattern from [data-model.md §3.3](./data-model.md))
  - `CREATE TABLE IF NOT EXISTS public.repeater_spots` with columns and types per [data-model.md §1](./data-model.md): `id uuid PK`, `user_id uuid NOT NULL`, `repeater_id uuid NOT NULL`, `access_id uuid NULL`, `callsign_snapshot text NOT NULL` (snapshot immutabile del callsign dell'autore al momento della creazione, FR-012), `started_at timestamptz NOT NULL DEFAULT now()`, `duration_minutes smallint NOT NULL`, `expires_at timestamptz GENERATED ALWAYS AS (started_at + (duration_minutes || ' minutes')::interval) STORED`, `closed_at timestamptz NULL`, `closed_by uuid NULL`, `created_at timestamptz NOT NULL DEFAULT now()`
  - All CHECK constraints from [data-model.md §1](./data-model.md): duration range, temporal coherence, `closed_by` consistency
  - All FKs from [data-model.md §1](./data-model.md): `user_id → auth.users ON DELETE CASCADE`, `repeater_id → public.repeaters ON DELETE CASCADE`, composite `(access_id, repeater_id) → public.repeater_access(id, repeater_id) ON DELETE SET NULL`, `closed_by → auth.users ON DELETE SET NULL`
  - 3 indexes from [data-model.md §2](./data-model.md): `idx_spots_repeater_started`, `idx_spots_started`, partial unique `idx_spots_active_per_user (user_id) WHERE closed_at IS NULL`
  - `ALTER TABLE public.repeater_spots ENABLE ROW LEVEL SECURITY`
  - SELECT policy `"authenticated can read all spots"` (`TO authenticated USING (true)`)
  - UPDATE policy `"users can close own spots"` (owner-only, see [data-model.md §5](./data-model.md))
  - Idempotent add to publication `supabase_realtime` using the `pg_publication_tables` guard pattern from [data-model.md §4](./data-model.md)
- [x] T005 Create Migration 2 file `supabase/migrations/<ts2>_cluster_notification_preferences.sql` containing:
  - `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cluster_notifications_enabled boolean NOT NULL DEFAULT true` + `COMMENT ON COLUMN`
  - `ALTER TABLE public.user_favorite_repeaters ADD COLUMN IF NOT EXISTS cluster_notifications_enabled boolean NOT NULL DEFAULT true` + `COMMENT ON COLUMN`
  - **NEW** policy `"update own favorites"` on `public.user_favorite_repeaters` for `UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`. The existing migration `20251223184226_favorite.sql` only defines SELECT/INSERT/DELETE policies — without this new UPDATE policy, the per-favorite opt-out toggle from [contracts/rest.md §5](./contracts/rest.md) cannot be saved by the client.
- [x] T006 Apply migrations locally (deferred to T013 — all 3 migrations applied together): `supabase db reset`. Verify by querying:
  - `\d public.repeater_spots` shows all columns + constraints + indexes
  - `select polname from pg_policies where tablename='repeater_spots'` returns the 2 expected policies
  - `select polname from pg_policies where tablename='user_favorite_repeaters'` includes `update own favorites`
  - `select * from pg_publication_tables where tablename='repeater_spots'` returns one row
  - `\d public.profiles` and `\d public.user_favorite_repeaters` show the new `cluster_notifications_enabled` column with default `true`
- [x] T007 [P] Resolve open data-model checklist items CHK002 and CHK003 by marking them `[x]` in [checklists/data-model.md](./checklists/data-model.md). Both are now resolved in data-model.md by analyze remediation (2026-04-11):
  - **CHK002** (callsign): resolved as **snapshot persistito** in colonna `callsign_snapshot text NOT NULL`. La RPC `create_spot` copia `profiles.callsign` al momento dell'INSERT. Soddisfa FR-012 letteralmente.
  - **CHK003** (`closed_by`): documentato come forward-compat surface, non mandato da FR-012. In v1 vale sempre `user_id` o `NULL`.
- [x] T007a [P] **(pre-implementation cleanup)** Update `docs/cluster-spots-technical.md` to align with the post-clarification spec: remove all references to admin moderation (User Story 5, FR-031..FR-035, the `users.manage` policy, the admin error codes), add `callsign_snapshot` column to the schema table, and add a banner at the top pointing to `specs/001-cluster-spots/` as the authoritative source for the feature. **Do NOT delete the file** — it remains a useful technical companion for the SQL details. This task MUST be completed before Phase 3 to prevent implementers from following the stale doc.

**Checkpoint**: Foundation ready. The schema, the policies, the indexes, the publication, the opt-out columns, and the new UPDATE policy on favorites are all in place. User stories can begin.

---

## Phase 3: User Story 1 — Dichiararsi "in ascolto" su un ponte (Priority: P1) 🎯 MVP

**Goal**: An authenticated user with a populated callsign can create a spot on a repeater (1–600 min, optional access), automatically replacing any previous active spot of theirs, and can manually close their spot at any time. Validations cover duration, callsign, repeater existence, and access-belongs-to-repeater. Atomicity guarantees the "1 active spot per user" invariant.

**Independent Test**: Run tests T010–T013 (`010_create_spot_happy.sql`, `020_create_spot_validation.sql`, `030_replace_active_spot.sql`, `040_close_spot.sql`) — all green, with zero unique-violation errors observable from `select * from public.repeater_spots`.

### Implementation for User Story 1

- [x] T008 [US1] Create Migration 3 file `supabase/migrations/<ts3>_cluster_spot_rpc_and_notify.sql` containing the complete behavior layer of the feature, in this order:
  1. Function `public.create_spot(p_repeater_id uuid, p_duration_minutes smallint, p_access_id uuid DEFAULT NULL) RETURNS public.repeater_spots` as `LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp`. Body MUST follow the pseudocode in [contracts/rpc.md §3 → create_spot](./contracts/rpc.md) verbatim: auth check → callsign trim check (captures the snapshot value) → duration range → repeater exists → access belongs to repeater → CLOSE previous active spot of caller (always, even if expired) → INSERT new row **including `callsign_snapshot` populated from the captured callsign value** → RETURN.
  2. Function `public.close_spot(p_spot_id uuid) RETURNS public.repeater_spots` per [contracts/rpc.md §3 → close_spot](./contracts/rpc.md): auth check → load spot → owner check → not-already-closed check → UPDATE setting `closed_at = now()`, `closed_by = auth.uid()` → RETURN. **No admin override** in v1.
  3. Function `public.notify_favorites_on_spot()` `RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp` per [contracts/rpc.md §4](./contracts/rpc.md). MUST use the **single `INSERT ... SELECT`** form (not a `FOR ... LOOP`) per [research.md §7 Decision 7](./research.md), filtered by `ufr.user_id <> NEW.user_id AND ufr.cluster_notifications_enabled = true AND p.cluster_notifications_enabled = true`. The `headings`/`contents` jsonb must be bilingual `en` + `it` per the existing pattern in `notify_favorites_on_feedback`.
  4. `CREATE TRIGGER trg_notify_favorites_on_spot AFTER INSERT ON public.repeater_spots FOR EACH ROW EXECUTE FUNCTION public.notify_favorites_on_spot()`.
  5. `GRANT EXECUTE ON FUNCTION public.create_spot(uuid, smallint, uuid) TO authenticated` and `GRANT EXECUTE ON FUNCTION public.close_spot(uuid) TO authenticated`.
  6. All `RAISE EXCEPTION` calls MUST use `ERRCODE = 'P0001'` and the exact `message` strings from [contracts/rpc.md §1 errors table](./contracts/rpc.md): `AUTH_REQUIRED`, `CALLSIGN_REQUIRED`, `INVALID_DURATION`, `REPEATER_NOT_FOUND`, `INVALID_ACCESS`, `SPOT_NOT_FOUND`, `FORBIDDEN`, `ALREADY_CLOSED`.
- [x] T009 [P] [US1] Create test `supabase/tests/cluster_spots/010_create_spot_happy.sql` covering [research.md §10 → 010](./research.md). Fixture: insert 1 user in `auth.users` + matching `profiles` row with `callsign='IZ0TEST'`, 1 repeater, 1 repeater_access. Action: `select public.create_spot(<repeater_id>, 30::smallint, <access_id>)` while `set local role authenticated; set local request.jwt.claim.sub = '<user_id>'`. Asserts: row exists, `closed_at IS NULL`, `expires_at = started_at + interval '30 minutes'`, `access_id` matches.
- [x] T010 [P] [US1] Create test `supabase/tests/cluster_spots/020_create_spot_validation.sql` covering all 5 validation error codes from [contracts/rpc.md §1](./contracts/rpc.md): (a) callsign blank → `CALLSIGN_REQUIRED`; (b) duration `0` → `INVALID_DURATION`; (c) duration `61` → `INVALID_DURATION`; (d) repeater UUID inesistente → `REPEATER_NOT_FOUND`; (e) access UUID che appartiene a un altro repeater → `INVALID_ACCESS`. Each assertion is a `BEGIN ... EXCEPTION WHEN raise_exception THEN ...` block that compares `SQLERRM`.
- [x] T011 [P] [US1] Create test `supabase/tests/cluster_spots/030_replace_active_spot.sql` covering SC-006 atomicity from [spec.md](./spec.md) and the partial unique index from [data-model.md §2](./data-model.md). Fixture: 1 user with callsign, 2 repeaters. Action: `create_spot(R1, 30)` → assert 1 row with `closed_at IS NULL`. Then `create_spot(R2, 30)` → assert old spot has `closed_at IS NOT NULL`, new spot is the only one with `closed_at IS NULL`, `select count(*) from public.repeater_spots where user_id=<u> and closed_at is null` returns exactly 1 throughout the test. No `unique_violation` thrown. **Nota sulla concorrenza** (edge case spec "Doppia creazione concorrente"): il test serializzato verifica la logica sequenziale. Il caso di two-concurrent-calls-from-same-user è garantito "by construction" dall'indice unico parziale `idx_spots_active_per_user`: se due transazioni parallele tentano entrambe di inserire, una delle due fallisce con `unique_violation` (23505). Questo scenario non è facilmente testabile in un singolo script SQL sequenziale; la garanzia è dichiarativa e verificata dalla sola esistenza dell'indice.
- [x] T012 [P] [US1] Create test `supabase/tests/cluster_spots/040_close_spot.sql` covering: (a) owner closes own spot → `closed_at IS NOT NULL`, `closed_by = user_id`; (b) different authenticated user calls `close_spot` on the first user's spot → `FORBIDDEN`; (c) owner calls `close_spot` again on the already-closed spot → `ALREADY_CLOSED`; (d) `close_spot('00000000-...')` → `SPOT_NOT_FOUND`.
- [ ] T013 [US1] **DEFERRED** (Docker not running) Apply migrations locally (`supabase db reset` or `supabase migration up`) and run all 4 US1 tests via `psql "$SUPABASE_DB_URL" -f supabase/tests/cluster_spots/<file>.sql`. Confirm all green. Block on any failure: read the error, fix Migration 3 or the test, re-run.

**Checkpoint**: User Story 1 fully functional. The MVP increment is shippable: an authenticated user with a callsign can declare and close spots, with all guarantees from FR-001..FR-012 enforced.

---

## Phase 4: User Story 2 — Vedere chi è in ascolto su un ponte (Priority: P1)

**Goal**: Authenticated users see, on a repeater detail screen, the list of currently-active spots on that repeater, with realtime updates as spots are created/closed/replaced. Backend exposes the data via standard PostgREST + Realtime — no new RPC needed.

**Independent Test**: From two psql sessions: session A subscribes to `LISTEN` events on `repeater_spots` (or via Supabase Realtime test page); session B inserts a spot via `create_spot`. Session A receives the realtime event within ~1 s. Then session B closes via `close_spot`; session A receives the UPDATE event.

### Implementation for User Story 2

- [ ] T014 [US2] Verify the publication wiring is correct: run `select schemaname, tablename from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='repeater_spots'` and confirm exactly one row exists (this validates the idempotent ALTER PUBLICATION done in Migration 1 actually fired).
- [ ] T015 [US2] Validate the per-repeater REST query from [contracts/rest.md §1](./contracts/rest.md) by executing it manually against the local Supabase URL with a real authenticated session token (use `curl` or Supabase Studio's SQL editor). Confirm: rows are returned only for `closed_at IS NULL AND expires_at > now()`, ordering is `started_at DESC`, and the joined `profiles!user_id(...)` and `repeater_access!access_id(...)` shapes match the example in `contracts/rest.md`. Document any drift in `contracts/rest.md` immediately.
- [ ] T016 [P] [US2] Smoke-test the realtime channel manually: open a Supabase Realtime client (Studio's "Database → Replication → Realtime" page or `supabase functions test` with a local subscriber) on `postgres_changes` for `public.repeater_spots` filtered by `repeater_id=eq.<R1>`. Trigger an INSERT via `create_spot` from a separate psql session and confirm the event arrives within 5 s (SC-002). Then trigger a `close_spot` and confirm the UPDATE event arrives.

**Checkpoint**: User Story 2 functional. Combined with US1, we now have a working MVP loop: create a spot, see it appear in real time on the repeater detail view.

---

## Phase 5: User Story 3 — Sezione globale "Ultimi spot" (Priority: P2)

**Goal**: Global "Ultimi spot 24h" feed shows all spots created in the last 24h, ordered most-recent-first, with realtime updates.

**Independent Test**: REST query `select ... from repeater_spots where started_at >= now() - interval '24 hours' order by started_at desc` returns the correct rows. Realtime channel without `repeater_id` filter receives events for all spots.

### Implementation for User Story 3

- [ ] T017 [US3] Validate the global 24h REST query from [contracts/rest.md §2](./contracts/rest.md): execute it with an authenticated session token. Confirm: results include both active and closed spots within 24h (per FR-014, FR-015), ordering is `started_at DESC`, and rows older than 24h are NOT returned. Verify against a fixture of 3 spots: one active now, one closed 12h ago, one created 25h ago (only the first two should appear).
- [ ] T018 [P] [US3] Smoke-test the global realtime channel: subscribe to `postgres_changes` on `public.repeater_spots` **without** any filter. Trigger spot INSERTs from multiple repeaters in quick succession and confirm all events arrive (this validates FR-018 propagation across the whole feed).

**Checkpoint**: User Story 3 functional. The global feed works alongside the repeater-detail view.

---

## Phase 6: User Story 4 — Notifiche push ai preferiti con opt-out (Priority: P2)

**Goal**: When a spot is created, every user who has the repeater in favorites AND has both `cluster_notifications_enabled` flags (`profiles` global + `user_favorite_repeaters` per-favorite) set to `true`, AND is not the spot author, receives a row in `user_notifications` (which the existing `trg_user_notification_push` then dispatches via `pg_net` to the `send_notification` edge function).

**Independent Test**: Run test T019 (`050_notify_favorites.sql`) and confirm all 5 sub-scenarios pass.

> **Note**: the trigger function `notify_favorites_on_spot` and the trigger `trg_notify_favorites_on_spot` were already authored as part of Migration 3 in T008 (US1 phase). This phase only validates and tests the fan-out behavior — no new DDL.

### Implementation for User Story 4

- [x] T019 [P] [US4] Create test `supabase/tests/cluster_spots/050_notify_favorites.sql` covering all 5 sub-scenarios from [research.md §10 → 050](./research.md):
  1. **Happy path**: user A favorite ponte X with both flags `true`, user B (different) has callsign and creates a spot on X → exactly 1 row appears in `public.user_notifications` for `user_id=A` with `data->>'type' = 'new_cluster_spot'` and `data->>'spot_id' = <new_spot_id>`.
  2. **Global opt-out**: A has `profiles.cluster_notifications_enabled = false` → 0 rows for A.
  3. **Per-favorite opt-out**: A has `profiles.cluster_notifications_enabled = true` but `user_favorite_repeaters.cluster_notifications_enabled = false` for ponte X → 0 rows for A.
  4. **Author exclusion** (SC-008): B has X among their own favorites with both flags `true`, but B is the author of the spot → 0 rows for B.
  5. **No favorites case**: ponte Y has zero favoriti → spot creation succeeds and inserts 0 rows in `user_notifications`.
- [ ] T020 [US4] Run test 050 via `psql "$SUPABASE_DB_URL" -f supabase/tests/cluster_spots/050_notify_favorites.sql` and confirm green. Block on any failure: inspect the trigger function body in Migration 3, verify the JOIN and WHERE clause, re-run.
- [ ] T021 [P] [US4] Manual end-to-end smoke test: with local `pg_net` enabled and the `send_notification` edge function up (`supabase functions serve send_notification`), insert a spot via `create_spot` and confirm a row appears in `net._http_response` with status 200 (or a parsed error, depending on whether OneSignal credentials are valid in the local Vault). This validates the full pipeline `INSERT spot → trigger fan-out → user_notifications INSERT → pg_net call`. **Additionally, validate FR-030** (single-device failure isolation): configure two favoriti utenti, one of which has an intentionally invalid device token or a non-existent user_id in the push provider. Confirm that the other user still receives the push (or that both `user_notifications` rows are created regardless of downstream delivery status — the isolation is guaranteed by the per-row trigger design of `trg_user_notification_push`). **Blocking only if** the local environment has `project_url` + `service_role_key` configured in Vault per the comment in `20260301120000_user_notifications.sql`.

**Checkpoint**: User Story 4 functional. Full feature is now end-to-end working: create a spot → realtime updates everywhere → push notifications fan out correctly with double opt-in respected.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation alignment, type generation, smoke validation, and constitution compliance review.

- [ ] T022 [P] Regenerate TypeScript types for the dashboard: `supabase gen types typescript --local > types/supabase.ts`. Verify the diff shows new entries: `Database['public']['Tables']['repeater_spots']`, `Database['public']['Functions']['create_spot']`, `Database['public']['Functions']['close_spot']`, plus `cluster_notifications_enabled` columns on `profiles` and `user_favorite_repeaters`. Commit the regenerated file.
- [ ] T023 _(Moved to T007a in Phase 2 — pre-implementation cleanup to prevent stale doc confusion)_
- [ ] T024 [P] Run the manual end-to-end smoke test from [quickstart.md §9](./quickstart.md) (12 steps, two test users, full flow including push). Document the result in a comment on the PR (or in `specs/001-cluster-spots/smoke-test-results.md` if the team prefers a checked-in artifact).
- [ ] T025 SC-011 load test: creare un fixture SQL che inserisca 500 utenti fittizi con il ponte di test nei preferiti (entrambi `cluster_notifications_enabled = true`), poi eseguire `create_spot` dal test user e misurare con `\timing` la latenza percepita dall'autore (tempo tra la chiamata RPC e il RETURNING della riga). La soglia è **<2 s** (SC-011). Se fallisce, valutare l'ottimizzazione del trigger fan-out (INSERT...SELECT batch). Al termine, pulire i 500 utenti fittizi.
- [ ] T026 Final SC validation against [spec.md §Success Criteria](./spec.md):
  - **SC-001** _(frontend-only, out of scope di questo repo)_: la metrica "3 tap in <10 s" non è misurabile lato backend. Verificata dal team Flutter durante l'integrazione.
  - **SC-002**: realtime event arrives in <5 s — misurare con `\timing` su 20 call consecutive between `INSERT` (psql session A) and event reception (psql session B subscribed to publication, or Supabase Studio Realtime view). Soglia: ≥19/20 sotto 5 s.
  - **SC-003**: push delivered to provider in <30 s — verificabile solo in staging con credenziali OneSignal valide. In locale, verificare che la riga in `user_notifications` appaia in <2 s e che `pg_net` chiami l'edge function (controllare `net._http_response`). Mark as "deferred to staging" se no credenziali.
  - **SC-005**: 100% of callsign-less users get `CALLSIGN_REQUIRED` → covered by test T010
  - **SC-006**: 0 cases of two simultaneous active spots per user → covered by test T011 + the partial unique index assertion
  - **SC-007**: 0 spurious notifications to opted-out users → covered by test T019 sub-scenarios 2 and 3
  - **SC-008**: 0 self-notifications → covered by test T019 sub-scenario 4
  - **SC-009** _(misurato con protocollo SC-002)_: verificato in parallelo con SC-002 durante lo stesso run di 20 misurazioni.
  - **SC-011**: coperto dal task T025 dedicato (500 favoriti load test).
  - **SC-012**: 0 msg liberi / 0 dati GPS → verificato per ispezione: `\d public.repeater_spots` non contiene colonne di testo libero né posizione GPS.
- [ ] T027 [P] Constitution compliance review against [.specify/memory/constitution.md](../../.specify/memory/constitution.md): confirm (a) RLS enabled and explicit on `repeater_spots` (Principle IV), (b) all 3 migrations are idempotent and re-runnable (`supabase db reset` clean), (c) no new edge function added (Principle I — reused `send_notification`), (d) `types/supabase.ts` regenerated (workflow gate 6), (e) Frontend Integration Spec index file `specs/001-cluster-spots/frontend-integration.md` is present and cross-references the 5 mandatory points of Principle V, (f) policy RLS preesistenti su `profiles` e `user_favorite_repeaters` continuano a funzionare correttamente dopo l'aggiunta delle colonne `cluster_notifications_enabled`: verificare che `SELECT * FROM profiles WHERE id != auth.uid()` non espone le nuove colonne di utenti diversi dall'owner, e che `SELECT * FROM user_favorite_repeaters WHERE user_id != auth.uid()` ritorna 0 righe (policy esistenti), (g) nessun `pg_cron` job nuovo né trigger di cleanup periodico (coerente con Out of Scope "Cancellazione automatica dello storico spot"). State the outcome in one sentence in the PR description per the governance compliance review rule.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup. **BLOCKS all user stories.**
- **User Story 1 (Phase 3)**: Depends on Foundational. Can start immediately after T006. **MVP target.**
- **User Story 2 (Phase 4)**: Depends on Foundational (specifically the publication add in T004). Can run in parallel with US1 if a different developer is on it, since there is no DDL in US2 — only verification.
- **User Story 3 (Phase 5)**: Depends on Foundational. Same as US2 — pure verification, can run in parallel with US1/US2/US4.
- **User Story 4 (Phase 6)**: Depends on T008 (Migration 3 contains the trigger). Test T019 can run only after migrations are applied (T013 already does this).
- **Polish (Phase 7)**: Depends on all 4 user stories being complete.

### User Story Dependencies

- **US1 (P1)**: Independent. Only depends on Foundational.
- **US2 (P1)**: Independent. Only depends on Foundational. Does NOT depend on US1 conceptually, but the smoke test in T016 needs T013 to have run so a `create_spot` call can produce events.
- **US3 (P2)**: Independent. Only depends on Foundational.
- **US4 (P2)**: Depends on T008 (Migration 3 with the trigger function). The trigger fan-out is verified in T019/T020 only after T013.

### Within Each User Story

- **US1**: T008 (migration authoring) runs first. Tests T009–T012 [P] can run in parallel after T008 (different files). T013 (apply + run) is the gate.
- **US2/US3**: pure verification — tasks are mostly parallel because they touch different surfaces (publication / REST query / realtime channel).
- **US4**: T019 (test authoring) before T020 (test run); T021 is independent and can run in parallel.

### Parallel Opportunities

- **Within Setup**: T003 [P] in parallel with T001/T002.
- **Within Foundational**: T007 [P] (data-model.md edit) in parallel with T004/T005/T006.
- **Within US1**: T009, T010, T011, T012 all [P] (4 different test files).
- **US2 vs US3 vs US4**: with multiple developers, all three can be worked in parallel after T013 completes.
- **Within Polish**: T022, T023, T024, T026 are [P] (different files / concerns); T025 is sequential because it audits results from all of the above.

---

## Parallel Example: User Story 1

```bash
# After T008 (Migration 3 authored), launch all 4 US1 tests in parallel:
Task: "Create test supabase/tests/cluster_spots/010_create_spot_happy.sql"
Task: "Create test supabase/tests/cluster_spots/020_create_spot_validation.sql"
Task: "Create test supabase/tests/cluster_spots/030_replace_active_spot.sql"
Task: "Create test supabase/tests/cluster_spots/040_close_spot.sql"

# Then T013 sequentially: apply + run all 4
```

---

## Implementation Strategy

### MVP First (User Story 1 + User Story 2 only)

1. Complete Phase 1 (Setup).
2. Complete Phase 2 (Foundational) — CRITICAL, blocks everything.
3. Complete Phase 3 (US1) — author Migration 3, write 4 tests, apply, run green.
4. Complete Phase 4 (US2) — verify publication & REST query & realtime channel.
5. **STOP and VALIDATE**: at this point an authenticated user can create/close spots and another user sees them in realtime on a repeater detail screen. This is the smallest shippable increment that delivers user value (the "anti ponte vuoto" loop works between two users on the same repeater).
6. Deploy/demo to Flutter team for early integration if desired.

### Incremental Delivery

1. MVP (US1 + US2) → ship.
2. Add US3 (global feed) → ship.
3. Add US4 (push notifications) → ship.
4. Polish phase → final deploy.

Each step is independently shippable because all the DDL is already in place from Foundational + the single Migration 3 created in US1; the later phases are pure verification and frontend-side work.

### Parallel Team Strategy

With 2 developers post-Foundational:

- **Dev A**: US1 (DDL-heavy, includes Migration 3 and 4 tests)
- **Dev B**: in parallel, US2 + US3 + US4 verification (no DDL conflict because Dev B only reads/tests; the test 050 in T019 depends on Migration 3 from Dev A, so coordinate the merge order)

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks.
- [Story] label maps tasks to specific user stories for traceability.
- Each user story is independently completable and testable; US2/US3/US4 are mostly verification phases because the design (per [plan.md](./plan.md) and [research.md](./research.md)) consolidates all DDL into a single Migration 3 that is authored in US1.
- Commit after each task or logical group: 1 commit per migration file, 1 commit per test file, 1 commit per polish item.
- The 3 migrations are designed to be re-runnable against `supabase db reset` without manual intervention (idempotent patterns documented in `data-model.md` §3.3 and §4).
- No new edge function: the push pipeline is reused from `20260301120000_user_notifications.sql` (Constitution Principle I — DRY).
- Avoid: editing already-applied migration files, skipping Foundational checkpoint, parallelizing tasks that touch the same file (T008 must complete before tests T009–T012, even though tests are [P] among themselves).
