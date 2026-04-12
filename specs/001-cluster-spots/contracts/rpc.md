# Contract — Edge Functions `create-spot` & `close-spot`

**Feature**: 001-cluster-spots
**Type**: Deno Edge Functions (`POST /functions/v1/<name>`)
**Auth**: Required (`Authorization: Bearer <user_jwt>`); JWT verified via `verifySupabaseJWT`. The edge functions use the service_role client internally for atomic DB writes.
**Architecture**: Layered (index → controller → usecase → repository) per Constitution §III.

---

## 1. `create-spot`

### Endpoint

```http
POST /functions/v1/create-spot
Authorization: Bearer <user_jwt>
Content-Type: application/json
```

### Request body

```json
{
  "repeater_id": "5a5e9f30-1b7e-4a7e-8a3a-9e1f6c2b4d10",
  "duration_minutes": 30,
  "access_id": "0d2e1a8a-5e6f-4b3c-9c4f-8a1b2c3d4e5f"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `repeater_id` | `string (uuid)` | ✓ | Must reference an existing row in `public.repeaters`. Disattivati (`is_active=false`) sono ammessi (l'invariante è solo "esiste"). |
| `duration_minutes` | `number (int)` | ✓ | Range **1–600** inclusive (max 10 hours). Server-authoritative. |
| `access_id` | `string (uuid)` | optional | If provided, must belong to `repeater_id`. If null/omitted, the spot is "generic". |

### Response — 201 Created

```json
{
  "success": true,
  "data": {
    "id": "f7c1a0b2-3d4e-5f6a-7b8c-9d0e1f2a3b4c",
    "user_id": "11111111-1111-1111-1111-111111111111",
    "repeater_id": "5a5e9f30-1b7e-4a7e-8a3a-9e1f6c2b4d10",
    "access_id": "0d2e1a8a-5e6f-4b3c-9c4f-8a1b2c3d4e5f",
    "callsign_snapshot": "IZ0ABC",
    "started_at": "2026-04-10T14:32:00.000Z",
    "duration_minutes": 30,
    "expires_at": "2026-04-10T15:02:00.000Z",
    "closed_at": null,
    "closed_by": null,
    "created_at": "2026-04-10T14:32:00.000Z"
  },
  "timestamp": "2026-04-10T14:32:00.123Z"
}
```

### Errors

Errors are returned as JSON with `success: false`:

```json
{ "success": false, "error": "CALLSIGN_REQUIRED", "timestamp": "..." }
```

| `message` | HTTP equivalent (UX) | When |
|---|---|---|
| `AUTH_REQUIRED` | 401 | `auth.uid()` is null. |
| `CALLSIGN_REQUIRED` | 422 | The caller's `profiles.callsign` is null or blank after `trim()`. |
| `INVALID_DURATION` | 422 | `duration_minutes` not in `[1, 600]`. |
| `REPEATER_NOT_FOUND` | 404 | `p_repeater_id` does not exist in `public.repeaters`. |
| `INVALID_ACCESS` | 422 | `p_access_id` is not null and either does not exist OR does not belong to `p_repeater_id`. |

> **Race condition (concurrent create)**: in the (extremely rare) case two concurrent `create_spot` calls from the same user reach the INSERT step before either has closed the previous, one of them fails with `unique_violation` (Postgres SQLSTATE `23505`). Clients SHOULD treat this as transient and may safely retry once.

> **Race condition (access removal)**: if an admin removes an `access` between the pre-validation (step 5) and the INSERT (step 7) within the same transaction window, the composite FK fires with `foreign_key_violation` (SQLSTATE `23503`). Clients MAY treat this as equivalent to `INVALID_ACCESS` and show the same user-facing message.

### Behavioral notes

1. The function runs in a single implicit transaction.
2. Step 6 ("close previous") and step 7 ("insert new") are atomic.
3. **Always** closes the previous active spot of the caller — even if it was already past `expires_at` — by setting `closed_at = now()`, `closed_by = auth.uid()`. This guarantees the partial unique index is never violated.
4. Triggers downstream:
   - `trg_notify_favorites_on_spot` (AFTER INSERT) → fan-out to `user_notifications` filtered by both opt-in flags.
   - `trg_user_notification_push` (existing) → push via `send_notification` edge function.
5. **Realtime**: the INSERT generates an event on the `supabase_realtime` publication. The companion UPDATE that closed the previous spot ALSO generates an event — clients subscribed to the user's own channel will receive a notification that their previous spot is no longer active (FR-019).

---

## 2. `close-spot`

### Endpoint

```http
POST /functions/v1/close-spot
Authorization: Bearer <user_jwt>
Content-Type: application/json
```

### Request body

```json
{
  "spot_id": "f7c1a0b2-3d4e-5f6a-7b8c-9d0e1f2a3b4c"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `spot_id` | `string (uuid)` | ✓ | The spot to close. The caller must be the owner. |

### Response — 200 OK

```json
{
  "success": true,
  "data": {
    "id": "f7c1a0b2-3d4e-5f6a-7b8c-9d0e1f2a3b4c",
    "user_id": "11111111-1111-1111-1111-111111111111",
    "repeater_id": "5a5e9f30-1b7e-4a7e-8a3a-9e1f6c2b4d10",
    "access_id": "0d2e1a8a-5e6f-4b3c-9c4f-8a1b2c3d4e5f",
    "callsign_snapshot": "IZ0ABC",
    "started_at": "2026-04-10T14:32:00.000Z",
    "duration_minutes": 30,
    "expires_at": "2026-04-10T15:02:00.000Z",
    "closed_at": "2026-04-10T14:45:12.000Z",
    "closed_by": "11111111-1111-1111-1111-111111111111",
    "created_at": "2026-04-10T14:32:00.000Z"
  },
  "timestamp": "2026-04-10T14:45:12.456Z"
}
```

### Errors

| `error` | HTTP status | When |
|---|---|---|
| `AUTH_REQUIRED` | 401 | Missing or invalid JWT. |
| `SPOT_NOT_FOUND` | 404 | `spot_id` does not exist. |
| `FORBIDDEN` | 403 | Caller is not the owner. **In v1 there is no admin override** (clarification Q5). |
| `ALREADY_CLOSED` | 409 | The spot already has `closed_at IS NOT NULL`. Idempotency for clients SHOULD be handled by treating `ALREADY_CLOSED` as success. |

### Behavioral notes

1. Sets `closed_at = now()` and `closed_by = auth.uid()` (always equal to `user_id` in v1).
2. Generates a Realtime UPDATE event on `public.repeater_spots`. Subscribers to the repeater channel and to the user channel both receive it.
3. Does NOT trigger any push notification (FR-026).

---

## 3. Pseudocode reference for the RPC bodies

> Authoritative version is the SQL in migration `<ts>_cluster_spot_rpc_and_notify.sql`. The pseudocode below is for reviewer convenience.

### `create_spot`

```sql
CREATE OR REPLACE FUNCTION public.create_spot(
  p_repeater_id      uuid,
  p_duration_minutes smallint,
  p_access_id        uuid DEFAULT NULL
) RETURNS public.repeater_spots
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller   uuid := auth.uid();
  v_callsign text;
  v_new_row  public.repeater_spots%ROWTYPE;
BEGIN
  -- 1. Auth
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  -- 2. Callsign required (Q2: solo non-vuoto) — also captures the snapshot
  SELECT NULLIF(TRIM(callsign), '') INTO v_callsign
    FROM public.profiles WHERE id = v_caller;
  IF v_callsign IS NULL THEN
    RAISE EXCEPTION 'CALLSIGN_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  -- v_callsign will be used as callsign_snapshot in the INSERT below

  -- 3. Duration range
  IF p_duration_minutes IS NULL OR p_duration_minutes < 1 OR p_duration_minutes > 600 THEN
    RAISE EXCEPTION 'INVALID_DURATION' USING ERRCODE = 'P0001';
  END IF;

  -- 4. Repeater exists
  IF NOT EXISTS (SELECT 1 FROM public.repeaters WHERE id = p_repeater_id) THEN
    RAISE EXCEPTION 'REPEATER_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  -- 5. Access (if provided) belongs to repeater
  IF p_access_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.repeater_access
       WHERE id = p_access_id AND repeater_id = p_repeater_id
    ) THEN
      RAISE EXCEPTION 'INVALID_ACCESS' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- 6. Close previous active spot (if any) — ALWAYS, even if already expired,
  --    to satisfy the partial unique index idx_spots_active_per_user.
  UPDATE public.repeater_spots
     SET closed_at = now(),
         closed_by = v_caller
   WHERE user_id = v_caller
     AND closed_at IS NULL;

  -- 7. Insert new spot
  INSERT INTO public.repeater_spots (user_id, repeater_id, access_id, callsign_snapshot, duration_minutes)
       VALUES (v_caller, p_repeater_id, p_access_id, v_callsign, p_duration_minutes)
    RETURNING * INTO v_new_row;

  RETURN v_new_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_spot(uuid, smallint, uuid) TO authenticated;
```

### `close_spot`

```sql
CREATE OR REPLACE FUNCTION public.close_spot(
  p_spot_id uuid
) RETURNS public.repeater_spots
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_row    public.repeater_spots%ROWTYPE;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_row FROM public.repeater_spots WHERE id = p_spot_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SPOT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  -- v1: solo l'owner. No admin moderation (Q5).
  IF v_row.user_id <> v_caller THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'P0001';
  END IF;

  IF v_row.closed_at IS NOT NULL THEN
    RAISE EXCEPTION 'ALREADY_CLOSED' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.repeater_spots
     SET closed_at = now(),
         closed_by = v_caller
   WHERE id = p_spot_id
   RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.close_spot(uuid) TO authenticated;
```

---

## 4. Notification fan-out trigger (reference)

```sql
CREATE OR REPLACE FUNCTION public.notify_favorites_on_spot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_repeater_label  text;
  v_spotter_callsign text;
BEGIN
  SELECT COALESCE(r.callsign, r.name, 'Repeater')
    INTO v_repeater_label
    FROM public.repeaters r
   WHERE r.id = NEW.repeater_id;

  SELECT p.callsign INTO v_spotter_callsign
    FROM public.profiles p
   WHERE p.id = NEW.user_id;

  -- Fan-out filtered by BOTH opt-in flags + exclude author (FR-022 .. FR-025, SC-007, SC-008)
  INSERT INTO public.user_notifications (user_id, headings, contents, data)
  SELECT
    ufr.user_id,
    jsonb_build_object(
      'en', 'New spot on ' || v_repeater_label,
      'it', 'Nuovo spot su ' || v_repeater_label
    ),
    jsonb_build_object(
      'en', v_spotter_callsign || ' is listening for ' || NEW.duration_minutes || ' min',
      'it', v_spotter_callsign || ' è in ascolto per ' || NEW.duration_minutes || ' min'
    ),
    jsonb_build_object(
      'type', 'new_cluster_spot',
      'spot_id', NEW.id::text,
      'repeater_id', NEW.repeater_id::text,
      'spotter_user_id', NEW.user_id::text
    )
  FROM public.user_favorite_repeaters ufr
  JOIN public.profiles p ON p.id = ufr.user_id
  WHERE ufr.repeater_id = NEW.repeater_id
    AND ufr.user_id <> NEW.user_id
    AND ufr.cluster_notifications_enabled = true
    AND p.cluster_notifications_enabled    = true;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_favorites_on_spot
  AFTER INSERT ON public.repeater_spots
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_favorites_on_spot();
```

The downstream `trg_user_notification_push` (existing, defined in `20260301120000_user_notifications.sql`) will fire once per inserted notification row and call the `send_notification` edge function via `pg_net`.
