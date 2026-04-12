# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HamQRG is a Supabase backend for a ham radio repeater database. It stores repeater stations with their frequencies, access modes (analog, DMR, C4FM, D-STAR, etc.), geographic locations, and user feedback.

## Common Commands

```bash
# Start local Supabase development environment
supabase start

# Stop local environment
supabase stop

# Apply migrations to local database
supabase db reset

# Create a new migration
supabase migration new <migration_name>

# Push migrations to remote (production)
supabase db push

# Generate TypeScript types from schema
supabase gen types typescript --local > types/supabase.ts
```

## Architecture

### Database Schema

The schema uses PostgreSQL with PostGIS for geographic queries.

**Core Tables:**
- `repeaters` - Radio repeater stations with frequency, location (lat/lon or Maidenhead locator), and mode (Analog/Digital/Mixed)
- `repeater_access` - Access configurations per repeater (CTCSS tones, DCS codes, DMR color codes, network affiliations)
- `networks` - Named networks (DMR, C4FM, D-STAR, VoIP) that repeaters can belong to
- `repeater_feedback` - User likes/down reports with geographic position

**Key Enums:**
- `repeater_mode`: Analog, Digital, Mixed
- `access_mode`: ANALOG, DMR, C4FM, DSTAR, ECHOLINK, SVX, APRS, BEACON, ATV, NXDN, ALLSTAR, WINLINK
- `network_kind`: dmr, c4fm, dstar, voip, mixed, other

### Geographic Functions

Two main spatial query functions are exposed via the API:

- `repeaters_nearby(lat, lon, radius_km, limit, access_modes)` - Find repeaters within radius, returns distance
- `repeaters_in_bounds(lat1, lon1, lat2, lon2, access_modes)` - Find repeaters in bounding box

Both functions return repeater data with aggregated `accesses` JSONB containing all access configurations.

### Row Level Security

All tables use RLS. Only authenticated users can read data. Users can only modify their own feedback entries.

### Edge Functions Architecture

Edge functions follow a **clean architecture** pattern with constructor-based dependency injection:

```
function_name/
├── index.ts              # DI wiring + HTTP response handling
├── controller/           # Orchestrates use cases, contains flow logic
├── usecase/              # Atomic, single-action business operations
├── repository/           # Database access (Supabase client)
├── api/                  # External API clients
├── types.ts              # Shared interfaces
├── constants.ts          # Static mappings and config values
└── utils.ts              # Pure utility functions
```

**Layering rules:**
- `index.ts` → builds dependencies, passes them to controller, handles HTTP response/error wrapping
- `controller` → orchestrates the flow calling use cases, contains business logic decisions
- `usecase` → each class does ONE atomic action, reusable and independently testable
- `repository` → raw database operations via Supabase client
- `api` → external HTTP clients

**Naming conventions:**
- UseCase classes: `{ActionDescription}UseCase` (e.g. `FetchRepeatersFromIZ8WNHUseCase`, `MapApiRecordToRepeaterUseCase`, `PersistRepeaterToDatabaseUseCase`)
- Repository classes: `{Entity}Repository`
- Controller classes: `{Domain}Controller`
- API clients: `{Service}Client`
- Files: kebab-case matching the class name (e.g. `fetch-repeaters-iz8wnh.ts`)
- Variables in controller: `{shortName}UseCase` (e.g. `fetchRepeatersUseCase`, `mapApiRecordUseCase`)

### Migration Patterns

- Timestamped SQL files in `supabase/migrations/`
- Safe enum extensions: `ALTER TYPE ... ADD VALUE IF NOT EXISTS`
- Partial unique indexes: `CREATE UNIQUE INDEX IF NOT EXISTS ... WHERE column IS NOT NULL`
- Idempotent seeding: `INSERT ... ON CONFLICT DO NOTHING`

## Conventions

- The `geom` column is auto-generated from lat/lon coordinates
- Maidenhead locators are automatically converted to coordinates if lat/lon not provided
- Frequencies are stored in Hz (`frequency_hz`), shifts in Hz (`shift_hz`)
- CTCSS tones stored as numeric(6,1) in Hz
- Deno runtime for edge functions with JSR imports (`jsr:@supabase/*`)
- External sync records tracked via `external_id` + `last_seen_at` columns

## Active Technologies
- PostgreSQL 15+ (Supabase managed) per lo schema; SQL/PLpgSQL per RPC e trigger. Nessun edge function nuovo: la pipeline push riusa le edge function Deno/JSR esistenti (`send_notification`). + Supabase Postgres + PostGIS (riusato), `pg_net` per HTTP outbound dai trigger (già configurato), Vault per i secret di edge function (già configurato), Realtime publication `supabase_realtime` (esistente). (001-cluster-spots)
- PostgreSQL — nuova tabella `public.repeater_spots`; due `ALTER TABLE` su tabelle esistenti (`profiles`, `user_favorite_repeaters`); una `UNIQUE` aggiuntiva su `public.repeater_access(id, repeater_id)` per supportare la composite FK. (001-cluster-spots)

## Recent Changes
- 001-cluster-spots: Added PostgreSQL 15+ (Supabase managed) per lo schema; SQL/PLpgSQL per RPC e trigger. Nessun edge function nuovo: la pipeline push riusa le edge function Deno/JSR esistenti (`send_notification`). + Supabase Postgres + PostGIS (riusato), `pg_net` per HTTP outbound dai trigger (già configurato), Vault per i secret di edge function (già configurato), Realtime publication `supabase_realtime` (esistente).
