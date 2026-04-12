# Contract — REST queries (PostgREST)

**Feature**: 001-cluster-spots
**Mechanism**: Direct PostgREST queries on `public.repeater_spots` (table allowed by RLS SELECT policy `authenticated can read all spots`).

> Le RPC `create_spot` e `close_spot` sono documentate in [rpc.md](./rpc.md). Questo file copre le query di **lettura** che il client esegue direttamente.

---

## 1. Query: spot di un singolo ponte (in ascolto ora)

**Used by**: scheda dettaglio ponte → "in ascolto ora" (User Story 2)
**Spec mapping**: FR-013

### TypeScript (`supabase-js`)

```ts
const { data, error } = await supabase
  .from('repeater_spots')
  .select(`
    id,
    user_id,
    callsign_snapshot,
    started_at,
    expires_at,
    closed_at,
    duration_minutes,
    profiles!user_id ( id, callsign, first_name, last_name ),
    repeater_access!access_id ( id, mode )
  `)
  .eq('repeater_id', repeaterId)
  .is('closed_at', null)              // solo non chiusi
  .gt('expires_at', new Date().toISOString())   // solo non scaduti = "active"
  .order('started_at', { ascending: false });
```

### Notes

- I client devono filtrare in client side anche per `closed_at IS NULL` perché lo stato `expired` (non chiuso ma oltre `expires_at`) NON deve apparire nella sezione "in ascolto ora" di una scheda ponte (FR-013 è esplicito su "spot **attivi**").
- L'ordering è `started_at DESC` (più recenti in cima); il piano di accesso usa `idx_spots_repeater_started`.
- Per la realtime subscription correlata vedi [realtime.md §1 → `spots:repeater:{id}`](./realtime.md).

### Response shape (esempio)

```json
[
  {
    "id": "f7c1a0b2-3d4e-5f6a-7b8c-9d0e1f2a3b4c",
    "user_id": "11111111-1111-1111-1111-111111111111",
    "callsign_snapshot": "IZ0ABC",
    "started_at": "2026-04-10T14:32:00.000Z",
    "expires_at": "2026-04-10T15:02:00.000Z",
    "closed_at": null,
    "duration_minutes": 30,
    "profiles": {
      "id": "11111111-1111-1111-1111-111111111111",
      "callsign": "IZ0ABC",
      "first_name": "Mario",
      "last_name": "Rossi"
    },
    "repeater_access": {
      "id": "0d2e1a8a-5e6f-4b3c-9c4f-8a1b2c3d4e5f",
      "mode": "DMR"
    }
  }
]
```

`repeater_access: null` se lo spot è "generico" (`access_id IS NULL`).

---

## 2. Query: sezione globale "Ultimi spot" (24h)

**Used by**: sezione globale "Ultimi spot" (User Story 3)
**Spec mapping**: FR-014, FR-015, FR-017

### TypeScript

```ts
const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

const { data, error } = await supabase
  .from('repeater_spots')
  .select(`
    id,
    user_id,
    callsign_snapshot,
    started_at,
    expires_at,
    closed_at,
    duration_minutes,
    profiles!user_id ( id, callsign, first_name, last_name ),
    repeaters!repeater_id ( id, callsign, name ),
    repeater_access!access_id ( id, mode )
  `)
  .gte('started_at', since)
  .order('started_at', { ascending: false });
```

### Notes

- **Niente paginazione**: il volume atteso (alcune decine di spot/giorno worst case) sta comodamente in una singola response (FR-017).
- **Niente filtri server-side**: no "solo preferiti", no "per modalità" (FR-016). Eventuali filtri sono lato client.
- L'ordering usa `idx_spots_started`.
- Mostra **sia attivi sia chiusi/scaduti** delle ultime 24h. Lo stato è derivato lato client (vedi §4 sotto).

---

## 3. Query: spot attivo dell'utente corrente

**Used by**: banner / stato "hai uno spot attivo" nell'app (FR-019, US1)

```ts
const { data } = await supabase
  .from('repeater_spots')
  .select('id, repeater_id, started_at, expires_at, duration_minutes, access_id')
  .eq('user_id', userId)
  .is('closed_at', null)
  .gt('expires_at', new Date().toISOString())
  .maybeSingle();
```

Restituisce `null` se l'utente non ha spot attivi. Per la realtime correlata vedi [realtime.md §1 → `spots:user:{userId}`](./realtime.md).

---

## 4. Helper: derivazione dello stato lato client

Lo stato di uno spot NON è una colonna. I client lo calcolano da `(closed_at, expires_at, now())`:

### TypeScript

```ts
type SpotState = 'active' | 'expired' | 'closed';

function spotState(s: { closed_at: string | null; expires_at: string }): SpotState {
  if (s.closed_at != null) return 'closed';
  if (new Date(s.expires_at).getTime() <= Date.now()) return 'expired';
  return 'active';
}
```

### Dart

```dart
enum SpotState { active, expired, closed }

SpotState spotState(Map<String, dynamic> spot) {
  if (spot['closed_at'] != null) return SpotState.closed;
  final expiresAt = DateTime.parse(spot['expires_at'] as String);
  if (!expiresAt.isAfter(DateTime.now())) return SpotState.expired;
  return SpotState.active;
}
```

> **Importante**: poiché lo stato dipende da `now()`, i client devono ricalcolarlo periodicamente per spot al limite della scadenza (es. tick di 1 s). Per la sezione "Ultimi spot 24h" lo stato del singolo elemento può cambiare da `active` → `expired` durante la visualizzazione: è UX desiderato (badge che aggiorna in tempo reale).

---

## 5. Notification preferences (lettura/scrittura)

Le preferenze di notifica cluster sono colonne di tabelle esistenti. Si leggono/scrivono via PostgREST standard.

### Globale

```ts
// Lettura
const { data: profile } = await supabase
  .from('profiles')
  .select('cluster_notifications_enabled')
  .eq('id', userId)
  .single();

// Scrittura
await supabase
  .from('profiles')
  .update({ cluster_notifications_enabled: false })
  .eq('id', userId);
```

(La policy esistente `Allow update access for authenticated users` su `profiles` permette già l'update del proprio profilo.)

### Per-preferito

```ts
// Lettura insieme al preferito
const { data } = await supabase
  .from('user_favorite_repeaters')
  .select('id, repeater_id, cluster_notifications_enabled')
  .eq('user_id', userId);

// Scrittura
await supabase
  .from('user_favorite_repeaters')
  .update({ cluster_notifications_enabled: false })
  .eq('id', favoriteId);
```

(La policy esistente su `user_favorite_repeaters` ammette già `select own favorites` + `insert own favorites` + `delete own favorites`. **Manca** una policy `update own favorites`: la migration `<ts>_cluster_notification_preferences.sql` la aggiunge contestualmente all'`ALTER TABLE`.)

---

## 6. RLS impact summary visibile al client

| Tabella | Operazione | Chi può | Note |
|---|---|---|---|
| `repeater_spots` | SELECT | qualsiasi `authenticated` | Tutta la tabella, nessun filtro per owner. |
| `repeater_spots` | INSERT | nessuno via REST | Solo via RPC `create_spot`. |
| `repeater_spots` | UPDATE | owner-only via RPC `close_spot` | La policy ammette UPDATE diretto dell'owner ma il client DEVE usare la RPC per coerenza dei trigger. |
| `repeater_spots` | DELETE | nessuno | Cascade da auth.users / repeaters in casi rari. |
| `profiles.cluster_notifications_enabled` | SELECT/UPDATE | owner-only | Policy esistente. |
| `user_favorite_repeaters.cluster_notifications_enabled` | SELECT/UPDATE | owner-only | Policy `update own favorites` aggiunta dalla migration. |

---

## 7. Type generation

Dopo l'apply delle 3 migrations, i tipi TypeScript del client devono essere rigenerati:

```bash
supabase gen types typescript --local > types/supabase.ts
```

I client (Flutter, dashboard) consumano `types/supabase.ts` per ottenere le type signature di `repeater_spots`, `create_spot`, `close_spot`, e i flag aggiunti su `profiles` / `user_favorite_repeaters`.
