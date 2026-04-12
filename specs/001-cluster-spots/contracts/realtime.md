# Contract — Realtime channels

**Feature**: 001-cluster-spots
**Mechanism**: Supabase Realtime via `postgres_changes` events on the `supabase_realtime` publication. Table `public.repeater_spots` is added to that publication by migration `<ts>_repeater_spots.sql`.

---

## 1. Channel topology

The client is expected to open at most **two** simultaneous channels:

| Context | Channel name (suggested) | Filter | Used by |
|---|---|---|---|
| Single repeater detail screen | `spots:repeater:{repeaterId}` | `repeater_id=eq.{repeaterId}` | Lista "in ascolto ora" su scheda ponte |
| Global "Ultimi spot 24h" screen | `spots:global` | _(no filter)_ | Sezione globale "Ultimi spot" |
| Caller's own active spot | `spots:user:{userId}` | `user_id=eq.{userId}` | Banner / stato dello spot dell'autore (FR-019) |

> The "global" channel and the "repeater" channel are mutually exclusive **per screen**: open the one matching the current view, close it on navigation. The "user" channel is long-lived for the entire authenticated session.

---

## 2. Event payload

The native `postgres_changes` payload contains **only the columns of `public.repeater_spots`**, NOT joined data. The client MUST do a follow-up enriched fetch when it needs `profiles.callsign`, `repeaters.name`, etc.

### Example payload — INSERT

```json
{
  "schema": "public",
  "table": "repeater_spots",
  "commit_timestamp": "2026-04-10T14:32:00.123Z",
  "eventType": "INSERT",
  "new": {
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
  "old": {}
}
```

### Example payload — UPDATE (close or replace)

```json
{
  "schema": "public",
  "table": "repeater_spots",
  "eventType": "UPDATE",
  "new": {
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
  "old": {
    "id": "f7c1a0b2-3d4e-5f6a-7b8c-9d0e1f2a3b4c",
    "closed_at": null
  }
}
```

> **DELETE events** are not expected in normal operation (the chiusura è soft via `closed_at`). They occur only on cascade hard delete (account cancellation per Q1, or rare hard repeater delete per Q4).

---

## 3. Event semantics — how the client interprets each transition

| Event | Old / New diff | Logical meaning | Suggested client action |
|---|---|---|---|
| `INSERT` | `closed_at: null` (new) | Nuovo spot creato. | Aggiungere alla lista "in ascolto ora", refetch enriched, mostrare badge "ora attivo". |
| `UPDATE`, `closed_at: null → not null` | Sostituzione automatica O chiusura manuale | Spot non più attivo. | Rimuovere dalla lista "in ascolto", aggiornare badge a "concluso" se nella sezione "Ultimi spot 24h", o rimuoverlo dalla scheda ponte. **Sul canale `spots:user:{me}`**: mostrare toast "il tuo spot non è più attivo". |
| `DELETE` | _(rare)_ | Hard delete (cascade da auth.users o repeaters). | Rimuovere silenziosamente dalla UI. |

> **Stato derivato `expired`**: NON c'è un evento dedicato. Quando uno spot supera `expires_at` senza essere stato chiuso, il DB non emette nulla. I client devono ricalcolare lo stato lato app a partire da `(closed_at, expires_at, now())` con un tick locale (es. setInterval ogni secondo o `Stream.periodic`). Vedi [quickstart.md](../quickstart.md) per l'helper.

---

## 4. Subscription examples

### Dart / Flutter (`supabase_flutter`)

```dart
// Scheda dettaglio ponte
final channel = supabase.channel('spots:repeater:$repeaterId')
  ..onPostgresChanges(
    event: PostgresChangeEvent.all,
    schema: 'public',
    table: 'repeater_spots',
    filter: PostgresChangeFilter(
      type: PostgresChangeFilterType.eq,
      column: 'repeater_id',
      value: repeaterId,
    ),
    callback: (payload) async {
      final spotId = payload.newRecord['id'] as String?;
      if (spotId == null) return;
      // Refetch arricchito (vedi quickstart §3)
      final enriched = await supabase
        .from('repeater_spots')
        .select('id, callsign_snapshot, started_at, expires_at, closed_at, duration_minutes, '
                'profiles!user_id(callsign, first_name), '
                'repeater_access!access_id(id, mode)')
        .eq('id', spotId)
        .maybeSingle();
      // applica enriched al BLoC/Cubit/state locale
    },
  )
  ..subscribe();
```

### TypeScript (`@supabase/supabase-js`)

```ts
const channel = supabase
  .channel(`spots:user:${userId}`)
  .on(
    'postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'repeater_spots',
      filter: `user_id=eq.${userId}` },
    (payload) => {
      const wasActive = payload.old?.closed_at == null;
      const nowClosed = payload.new?.closed_at != null;
      if (wasActive && nowClosed) {
        // Mostra toast: "il tuo spot non è più attivo"
        notifyMe();
      }
    },
  )
  .subscribe();
```

---

## 5. Lifecycle rules for the client

- Aprire un canale **per ogni schermata visibile**, chiuderlo su `dispose()`/route pop.
- Il canale `spots:user:{me}` è long-lived: aprirlo all'avvio dell'app (post-login) e chiuderlo solo al logout.
- Su disconnessione/riconnessione realtime, il client deve **re-fetch the current state** dalle query REST documentate in [contracts/rest.md](./rest.md): gli eventi persi durante la disconnessione NON vengono replayati.
- Filtrare lato client gli eventi che non interessano (es. `closed_at != null` per la lista "in ascolto ora") è ammesso e raccomandato.

---

## 6. RLS interactions visible in realtime

La policy `SELECT` è `TO authenticated USING (true)`, quindi tutti gli utenti autenticati ricevono tutti gli eventi di tutti gli spot (anche quelli non visibili sulla loro schermata corrente, se non filtrati).

**Implicazione client**: il filtro `repeater_id=eq.X` riduce volume sulla scheda ponte; sulla sezione globale "Ultimi spot" il client riceverà `~ N spot/giorno / 86400` eventi al secondo ≈ negligibile su un'app ham radio amatoriale.

---

## 7. Error handling

| Scenario | Comportamento atteso |
|---|---|
| Token JWT scaduto sul canale | Supabase Realtime emette evento di errore; il client deve refresh-token e ricreare il canale. |
| Riconnessione automatica | Supabase Realtime riconnette automaticamente con backoff esponenziale; il client NON riceve eventi storici. |
| Server-side disconnect | Stesso comportamento di sopra. Re-fetch obbligatorio per allineare lo stato. |
