<!--
SYNC IMPACT REPORT
==================
Version change: [unversioned template] → 1.0.0
Bump rationale: Initial substantive ratification — template placeholders replaced
with concrete principles, sections, and governance for the HamQRG backend.

Modified principles:
  - [PRINCIPLE_1_NAME]    → I. DRY & Shared-Code Reuse
  - [PRINCIPLE_2_NAME]    → II. SOLID Object Design
  - [PRINCIPLE_3_NAME]    → III. Layered Architecture (index → controller → usecase → repository)
  - [PRINCIPLE_4_NAME]    → IV. Production-Grade Code Quality (NON-NEGOTIABLE)
  - [PRINCIPLE_5_NAME]    → V. Frontend Integration Specification (NON-NEGOTIABLE)

Added sections:
  - Additional Constraints & Technology Standards (replaces [SECTION_2_NAME])
  - Development Workflow & Quality Gates       (replaces [SECTION_3_NAME])
  - Governance (populated)

Removed sections: none.

Templates requiring updates:
  - ✅ .specify/memory/constitution.md             (this file, populated)
  - ⚠ .specify/templates/plan-template.md         (Constitution Check section is generic
       — no rewrite required, but reviewers MUST evaluate the five principles below
       against every plan; consider expanding the gate inline when next edited)
  - ⚠ .specify/templates/spec-template.md         (add an explicit "Frontend Integration
       Spec" deliverable subsection on next revision — Principle V mandates it)
  - ⚠ .specify/templates/tasks-template.md        (sample tasks reference generic
       src/models/services layout; align Phase 2/3 examples with the
       index/controller/usecase/repository hierarchy on next revision)
  - ✅ CLAUDE.md                                  (already documents the layered
       edge-function architecture and naming — consistent with this constitution)

Deferred TODOs: none.
-->

# HamQRG Constitution

HamQRG is a Supabase backend powering a ham-radio repeater database (and adjacent
amateur-radio features). This constitution defines the non-negotiable engineering
principles every contributor — human or AI — MUST follow when changing the backend,
its edge functions, migrations, or specifications.

## Core Principles

### I. DRY & Shared-Code Reuse

Duplication is a defect. Any logic, type, constant, or helper that could plausibly
be reused by another edge function MUST live under `supabase/functions/_shared/`
(or the equivalent shared module) — not be copy-pasted.

Rules:

- Before introducing a new helper, contributors MUST search `_shared/` for an
  existing equivalent and extend it instead of forking.
- The reuse test is forward-looking: "Could a *future* edge function reasonably
  call this?" If yes, it belongs in `_shared/`.
- Local-only logic (used by exactly one function and conceptually tied to its
  domain) MAY stay inside that function's folder, but MUST be moved to `_shared/`
  the first time a second consumer appears — no second copy is allowed.
- Shared modules MUST be self-contained, free of function-specific assumptions,
  and documented at the top of the file with their intended use.

**Rationale**: Edge functions evolve independently and drift fast. Centralizing
shared code keeps behavior consistent across the API surface and prevents
divergent bug fixes.

### II. SOLID Object Design

All TypeScript/Deno code in edge functions MUST follow the SOLID principles:

- **Single Responsibility**: Every class does exactly one thing. UseCase classes
  in particular MUST be atomic — one action, one reason to change.
- **Open/Closed**: Extend behavior via composition or new use cases; do not
  modify stable use cases to bolt on new flows.
- **Liskov Substitution**: Repository and API-client interfaces MUST be
  substitutable so use cases can be tested with fakes.
- **Interface Segregation**: Controllers depend on the narrowest interface they
  need; do not pass "god objects" through constructors.
- **Dependency Inversion**: Controllers and use cases MUST receive their
  collaborators via constructor injection from `index.ts`. No use case may
  instantiate a Supabase client, fetch HTTP directly, or read environment
  variables on its own.

**Rationale**: SOLID compliance is what makes the layered architecture in
Principle III actually testable and refactorable instead of theoretical.

### III. Layered Architecture (index → controller → usecase → repository)

Every edge function MUST follow this exact dependency direction, with no skips
and no upward calls:

```
index.ts          → wires dependencies, handles HTTP request/response & error mapping
controller/       → orchestrates use cases, owns flow & business decisions
usecase/          → atomic, single-action units of business logic
repository/       → database access via Supabase client
api/              → external HTTP clients
```

Hard rules:

- `index.ts` MUST NOT contain business logic — only DI wiring and HTTP framing.
- Controllers MUST NOT touch the database or external APIs directly; they call
  use cases.
- Use cases MUST NOT call other use cases at the same layer through hidden
  globals — composition happens in the controller.
- Repositories MUST NOT contain business rules; they expose data operations.
- Naming MUST follow the conventions in `CLAUDE.md`: `{Action}UseCase`,
  `{Entity}Repository`, `{Domain}Controller`, `{Service}Client`, kebab-case
  filenames matching the class.
- Cross-function shared variants of any of these layers belong in `_shared/`
  per Principle I.

**Rationale**: A predictable hierarchy lets any contributor (and any future
agent) navigate a function in seconds and reason about blast radius.

### IV. Production-Grade Code Quality (NON-NEGOTIABLE)

Code merged to `main` MUST be production-ready. "Quick fixes," commented-out
blocks, dead code, and TODO-without-owner comments are not acceptable.

Mandatory checks before merge:

- All inputs at system boundaries (HTTP, external APIs, database results) MUST
  be validated; internal collaborators are trusted per CLAUDE.md guidance.
- Errors MUST be surfaced with enough context to debug in production logs;
  silent `catch` blocks are forbidden.
- Migrations MUST be idempotent and use the safe patterns documented in
  `CLAUDE.md` (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, partial unique
  indexes, safe enum extensions).
- RLS policies MUST be reviewed on every schema change; no table may ship
  without an explicit policy decision.
- No new dependency, abstraction, or feature flag may be added "just in case" —
  YAGNI applies.

**Rationale**: HamQRG is consumed by a public mobile/web client; regressions
are user-visible. The cost of polishing during review is lower than the cost
of fixing in production.

### V. Frontend Integration Specification (NON-NEGOTIABLE)

Every backend feature — new endpoint, new edge function, new RPC, schema
change that affects API contracts, or any behavior visible to clients — MUST
be accompanied by a written **Frontend Integration Spec** before the work is
considered complete.

The spec MUST be delivered in `specs/<feature>/frontend-integration.md` (or
attached to the PR) and MUST include:

1. **Endpoint / RPC contract**: HTTP method, path or RPC name, auth
   requirements, request schema, response schema, error codes.
2. **Example payloads**: A realistic request and a realistic success response,
   plus at least one error response.
3. **Behavioral notes**: Pagination, ordering, geographic units (km vs. m,
   Hz vs. MHz), enum values, RLS implications visible to the client.
4. **Migration impact**: Which existing client calls (if any) break or change,
   and the recommended migration path.
5. **Open questions**: Anything the frontend team must decide before
   integrating (e.g., UX for new error states).

The spec MUST be written in a way the frontend team can hand directly to
their implementation agent or developer — no backend context required to
understand it.

**Rationale**: The frontend team (Flutter app + Next.js dashboard) cannot
integrate what it cannot see. Shipping a backend change without the spec
creates an invisible dependency and stalls the product.

## Additional Constraints & Technology Standards

- **Runtime**: Edge functions run on Deno with JSR imports (`jsr:@supabase/*`).
  Node-specific APIs and npm-only packages MUST NOT be introduced unless
  unavoidable and justified in the PR description.
- **Database**: PostgreSQL with PostGIS. Geographic queries MUST go through the
  documented spatial functions (`repeaters_nearby`, `repeaters_in_bounds`) or
  add a new SQL function — never recompute distances client-side from raw rows.
- **Units**: Frequencies stored in Hz (`frequency_hz`), shifts in Hz
  (`shift_hz`), CTCSS tones as `numeric(6,1)` Hz. Conversions to MHz happen at
  the API boundary, never inside use cases or repositories.
- **Geometry**: The `geom` column is auto-generated from lat/lon. Maidenhead
  locators MUST be converted server-side when lat/lon are absent.
- **External sync**: Records imported from third parties MUST track
  `external_id` and `last_seen_at`; deletes from upstream are reflected by
  staleness, not destructive purges, unless explicitly designed otherwise.
- **Security**: All tables MUST have RLS enabled. Authenticated read is the
  default; write access MUST be scoped to the row owner unless a use case
  documents and justifies a broader policy.
- **Secrets**: No secret may be hard-coded. Edge functions read configuration
  via Deno's environment APIs at the `index.ts` layer only.

## Development Workflow & Quality Gates

1. **Spec first**: Non-trivial features start with a spec in `specs/<feature>/`
   following the spec template; the Frontend Integration Spec (Principle V) is
   part of the deliverable, not an afterthought.
2. **Plan check**: Implementation plans MUST include a Constitution Check that
   evaluates the feature against Principles I–V. Violations require an entry in
   the plan's Complexity Tracking table with explicit justification.
3. **Migrations**: New SQL files go in `supabase/migrations/` with timestamped
   names. They MUST be re-runnable against a fresh local database
   (`supabase db reset`) without manual intervention.
4. **Local validation**: Contributors MUST run the affected edge function
   locally (or `supabase db reset` + targeted SQL checks for migrations) before
   opening a PR.
5. **Code review**: Reviewers MUST verify (a) layering, (b) `_shared/` reuse,
   (c) RLS impact, and (d) presence of the Frontend Integration Spec.
   Any "no" is a blocking comment.
6. **Type generation**: When the schema changes, regenerate TypeScript types
   (`supabase gen types typescript --local > types/supabase.ts`) in the same PR
   so the frontend can pick them up cleanly.

## Governance

This constitution supersedes ad-hoc conventions. When CLAUDE.md, READMEs, or
inline comments conflict with this document, this document wins and the
conflicting source MUST be updated in the same PR.

**Amendment procedure**:

1. Open a PR that edits `.specify/memory/constitution.md` and any dependent
   templates (`.specify/templates/*.md`) and guidance files (`CLAUDE.md`,
   `README.md`).
2. Include a Sync Impact Report at the top of the constitution describing
   version delta, modified principles, and template propagation status.
3. Bump the version per semantic versioning:
   - **MAJOR**: Removing or redefining a principle in a backward-incompatible way.
   - **MINOR**: Adding a new principle, section, or materially expanding guidance.
   - **PATCH**: Wording, typo, or clarification with no semantic change.
4. At least one human reviewer MUST approve before merge.

**Compliance review**: Every PR description MUST state, in one sentence,
which principles were touched and how compliance was verified. Reviewers
reject PRs that fail to do so.

**Runtime guidance**: For day-to-day development, agents and contributors
SHOULD consult `CLAUDE.md` — it is the operational companion to this
constitution and is kept in sync with it.

**Version**: 1.0.0 | **Ratified**: 2026-04-10 | **Last Amended**: 2026-04-10
