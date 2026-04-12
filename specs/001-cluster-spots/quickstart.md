# Quickstart — Cluster Spots

**Feature**: 001-cluster-spots
**Audience**: Flutter app team (`ham_qrg_flutter`) + Next.js dashboard team (`ham_qrg_dashboard`).

End-to-end recipes per integrare la feature Cluster Spots dal lato client. Allineato con [spec.md](./spec.md), [contracts/rpc.md](./contracts/rpc.md), [contracts/realtime.md](./contracts/realtime.md), [contracts/rest.md](./contracts/rest.md).

> **Migration impact**: nessun breaking change su API esistenti. Le 3 migrations aggiungono solo nuove tabelle/colonne/RPC. I client esistenti continuano a funzionare invariati. La type generation (`supabase gen types typescript --local > types/supabase.ts`) va ri-eseguita post-apply.

---

## 1. Backend setup (one-shot, dev locale)

```bash
# 1. Apply migrations
supabase db reset

# 2. Regenerate TypeScript types (per il dashboard)
supabase gen types typescript --local > types/supabase.ts

# 3. Run feature tests
psql "$SUPABASE_DB_URL" -f supabase/tests/cluster_spots/010_create_spot_happy.sql
psql "$SUPABASE_DB_URL" -f supabase/tests/cluster_spots/020_create_spot_validation.sql
psql "$SUPABASE_DB_URL" -f supabase/tests/cluster_spots/030_replace_active_spot.sql
psql "$SUPABASE_DB_URL" -f supabase/tests/cluster_spots/040_close_spot.sql
psql "$SUPABASE_DB_URL" -f supabase/tests/cluster_spots/050_notify_favorites.sql
```

---

## 2. Recipe — User Story 1: dichiarare uno spot

### Flow

1. L'utente apre la scheda di un ponte.
2. Tappa su "Mettiti in ascolto".
3. Sceglie durata (1–600 min) ed eventualmente un access dal dropdown popolato dagli access del ponte.
4. Conferma → `create-spot` RPC.
5. Sull'esito ok la UI mostra "Sei in ascolto: X minuti rimanenti".
6. Sull'esito errore mostra il messaggio i18n corrispondente al codice.

### Dart / Flutter

```dart
Future<RepeaterSpot> createSpot({
  required String repeaterId,
  required int durationMinutes,
  String? accessId,
}) async {
  final response = await supabase.functions.invoke('create-spot', body: {
    'repeater_id': repeaterId,
    'duration_minutes': durationMinutes,
    'access_id': accessId,
  });

  if (response.status != 201) {
    final error = response.data['error'] as String? ?? 'UNKNOWN';
    switch (error) {
      case 'AUTH_REQUIRED':
        throw const SpotError.authRequired();
      case 'CALLSIGN_REQUIRED':
        throw const SpotError.callsignRequired();
      case 'INVALID_DURATION':
        throw const SpotError.invalidDuration();
      case 'REPEATER_NOT_FOUND':
        throw const SpotError.repeaterNotFound();
      case 'INVALID_ACCESS':
        throw const SpotError.invalidAccess();
      default:
        throw SpotError.unknown(error);
    }
  }

  return RepeaterSpot.fromJson(response.data['data'] as Map<String, dynamic>);
}
```

### Mapping codici → i18n suggerito

| Code | IT | EN |
|---|---|---|
| `AUTH_REQUIRED` | "Devi effettuare l'accesso." | "You must be logged in." |
| `CALLSIGN_REQUIRED` | "Imposta il tuo callsign nel profilo per usare il cluster." | "Set your callsign in your profile to use the cluster." |
| `INVALID_DURATION` | "La durata deve essere tra 1 e 600 minuti." | "Duration must be between 1 and 600 minutes." |
| `REPEATER_NOT_FOUND` | "Ponte non trovato." | "Repeater not found." |
| `INVALID_ACCESS` | "Modalità di accesso non valida per questo ponte." | "Invalid access mode for this repeater." |
| `SPOT_NOT_FOUND` | "Spot non trovato." | "Spot not found." |
| `FORBIDDEN` | "Non puoi chiudere uno spot che non è tuo." | "You cannot close a spot that isn't yours." |
| `ALREADY_CLOSED` | "Lo spot è già stato chiuso." | "The spot is already closed." |

---

## 3. Recipe — User Story 2: lista "in ascolto ora" su scheda ponte

### Flow

1. Utente apre la scheda di un ponte.
2. La sezione "In ascolto ora" carica gli spot attivi via REST.
3. Apre simultaneamente il canale realtime `spots:repeater:{repeaterId}`.
4. Su ogni evento realtime, refetch enriched dello spot e applica al state locale.

### Dart / Flutter

```dart
class SpotsOnRepeaterCubit extends Cubit<List<EnrichedSpot>> {
  final SupabaseClient supabase;
  final String repeaterId;
  RealtimeChannel? _channel;

  SpotsOnRepeaterCubit(this.supabase, this.repeaterId) : super(const []);

  Future<void> start() async {
    // 1. Initial load
    final rows = await supabase
      .from('repeater_spots')
      .select('id, user_id, callsign_snapshot, started_at, expires_at, closed_at, duration_minutes, '
              'profiles!user_id(id, callsign, first_name, last_name), '
              'repeater_access!access_id(id, mode)')
      .eq('repeater_id', repeaterId)
      .isFilter('closed_at', null)
      .gt('expires_at', DateTime.now().toUtc().toIso8601String())
      .order('started_at', ascending: false);
    emit(rows.map(EnrichedSpot.fromJson).toList());

    // 2. Realtime subscription
    _channel = supabase.channel('spots:repeater:$repeaterId')
      ..onPostgresChanges(
        event: PostgresChangeEvent.all,
        schema: 'public',
        table: 'repeater_spots',
        filter: PostgresChangeFilter(
          type: PostgresChangeFilterType.eq,
          column: 'repeater_id',
          value: repeaterId,
        ),
        callback: _onRealtimeEvent,
      )
      ..subscribe();
  }

  Future<void> _onRealtimeEvent(PostgresChangePayload payload) async {
    final spotId = (payload.newRecord['id'] ?? payload.oldRecord['id']) as String?;
    if (spotId == null) return;
    final fresh = await supabase
      .from('repeater_spots')
      .select('id, user_id, callsign_snapshot, started_at, expires_at, closed_at, duration_minutes, '
              'profiles!user_id(id, callsign, first_name, last_name), '
              'repeater_access!access_id(id, mode)')
      .eq('id', spotId)
      .maybeSingle();
    final next = [...state]..removeWhere((s) => s.id == spotId);
    if (fresh != null) {
      final spot = EnrichedSpot.fromJson(fresh);
      // Solo gli "active" finiscono nella sezione "in ascolto ora"
      if (spot.state == SpotState.active) {
        next.insert(0, spot); // più recente in cima
      }
    }
    emit(next);
  }

  @override
  Future<void> close() async {
    await _channel?.unsubscribe();
    return super.close();
  }
}
```

### Helper SpotState (Dart)

```dart
enum SpotState { active, expired, closed }

extension EnrichedSpotState on EnrichedSpot {
  SpotState get state {
    if (closedAt != null) return SpotState.closed;
    if (!expiresAt.isAfter(DateTime.now())) return SpotState.expired;
    return SpotState.active;
  }
}
```

---

## 4. Recipe — User Story 3: sezione globale "Ultimi spot"

### Dart / Flutter

```dart
final since = DateTime.now()
  .subtract(const Duration(hours: 24))
  .toUtc()
  .toIso8601String();

final rows = await supabase
  .from('repeater_spots')
  .select('id, user_id, callsign_snapshot, started_at, expires_at, closed_at, duration_minutes, '
          'profiles!user_id(id, callsign), '
          'repeaters!repeater_id(id, callsign, name), '
          'repeater_access!access_id(id, mode)')
  .gte('started_at', since)
  .order('started_at', ascending: false);

// Realtime: stessa subscription ma SENZA filter
final channel = supabase.channel('spots:global')
  ..onPostgresChanges(
    event: PostgresChangeEvent.all,
    schema: 'public',
    table: 'repeater_spots',
    callback: _onAnySpotEvent,
  )
  ..subscribe();
```

UI: badge "in ascolto" vs "concluso" derivato da `spot.state`. Tap su uno spot → naviga a `/repeater/${spot.repeaterId}`.

---

## 5. Recipe — User Story 4: notifiche push e preferenze

### Flow utente

1. L'utente mette nei preferiti il ponte X (flusso esistente, nessuna modifica).
2. **Default**: riceverà notifiche push quando un altro utente fa uno spot su X.
3. Per silenziare globalmente: switch "Notifiche cluster" in Impostazioni profilo → `profiles.cluster_notifications_enabled = false`.
4. Per silenziare un singolo preferito: switch nella UI dei preferiti → `user_favorite_repeaters.cluster_notifications_enabled = false`.
5. Una notifica viene inviata se e solo se entrambi i flag sono `true` E l'utente non è l'autore dello spot.

### Lettura/scrittura dei flag

```dart
// Globale
final profile = await supabase
  .from('profiles')
  .select('cluster_notifications_enabled')
  .eq('id', supabase.auth.currentUser!.id)
  .single();

await supabase
  .from('profiles')
  .update({'cluster_notifications_enabled': false})
  .eq('id', supabase.auth.currentUser!.id);

// Per-preferito
final favs = await supabase
  .from('user_favorite_repeaters')
  .select('id, repeater_id, cluster_notifications_enabled')
  .eq('user_id', supabase.auth.currentUser!.id);

await supabase
  .from('user_favorite_repeaters')
  .update({'cluster_notifications_enabled': false})
  .eq('id', favoriteId);
```

### Push payload (cosa arriva al device)

```json
{
  "headings": { "en": "New spot on IZ0XYZ", "it": "Nuovo spot su IZ0XYZ" },
  "contents": { "en": "IZ0ABC is listening for 30 min", "it": "IZ0ABC è in ascolto per 30 min" },
  "data": {
    "type": "new_cluster_spot",
    "spot_id": "f7c1a0b2-...",
    "repeater_id": "5a5e9f30-...",
    "spotter_user_id": "11111111-..."
  }
}
```

### Deep link suggerito

Sul tap della notifica push: navigare alla scheda del ponte (`data.repeater_id`). La UI mostrerà lo spot in cima alla lista "in ascolto ora" se è ancora attivo.

---

## 6. Recipe — il proprio spot attivo (FR-019)

```dart
// Subscribe al proprio canale all'avvio dell'app (post-login)
final myChannel = supabase.channel('spots:user:${user.id}')
  ..onPostgresChanges(
    event: PostgresChangeEvent.update,
    schema: 'public',
    table: 'repeater_spots',
    filter: PostgresChangeFilter(
      type: PostgresChangeFilterType.eq,
      column: 'user_id',
      value: user.id,
    ),
    callback: (payload) {
      final wasActive = payload.oldRecord['closed_at'] == null;
      final nowClosed = payload.newRecord['closed_at'] != null;
      if (wasActive && nowClosed) {
        // Sostituzione automatica o chiusura forzata (in v1 solo sostituzione)
        showToast('Il tuo spot non è più attivo');
      }
    },
  )
  ..subscribe();
```

---

## 7. Migration impact (sintesi per il team frontend)

| Cambiamento backend | Impatto client esistente |
|---|---|
| Nuova tabella `repeater_spots` | Nessuno (tabella nuova). |
| Nuova Edge Function `create-spot` | Nessuno; nuova feature opzionale. |
| Nuova Edge Function `close-spot` | Nessuno. |
| Colonna `profiles.cluster_notifications_enabled` (default `true`) | Nessuno; query SELECT esistenti continuano a funzionare. La colonna è opt-in da UI nuova. |
| Colonna `user_favorite_repeaters.cluster_notifications_enabled` (default `true`) | Nessuno; idem. |
| Nuova policy UPDATE su `user_favorite_repeaters` | Nessuno; abilita un'operazione che prima non c'era. |
| `UNIQUE(id, repeater_id)` su `repeater_access` | Nessuno; vincolo ridondante con la PK. |
| Realtime publication aggiornata | Nessuno; la subscription preesistente non è influenzata. |

**Type generation richiesta**: dopo `supabase db reset` o `supabase db push`, rieseguire `supabase gen types typescript --local > types/supabase.ts` per ottenere i tipi `Database['public']['Tables']['repeater_spots']` e `Database['public']['Functions']['create_spot']`.

---

## 8. Open questions per il team frontend

Domande non bloccanti per il backend ma che il team frontend dovrebbe decidere:

1. **UX al limite scadenza**: come visualizzare uno spot che sta per scadere (es. countdown rosso negli ultimi 60 secondi)? Decisione UI-only.
2. **Aggiornamento periodico dello stato**: con quale periodo ricalcolare lo `state` lato client (1 s? 5 s? `Stream.periodic`)?
3. **Behavior on disconnect**: alla riconnessione realtime, refetch silenzioso o pull-to-refresh utente?
4. **Empty state della scheda ponte**: messaggio "Nessuno in ascolto ora" o un CTA "Mettiti tu in ascolto"?
5. **Opt-out per-preferito**: dove va il toggle nell'IA? Dentro la card del preferito? In una settings page dei preferiti?
6. **Permessi push OS-level**: se l'utente non ha mai concesso il permesso push di sistema, l'app dovrebbe mostrare un onboarding la prima volta che attiva un preferito? (non richiesto dal backend, ma raccomandato per UX).

Nessuna di queste richiede modifiche al backend.

---

## 9. Smoke test end-to-end (manuale, post-deploy)

1. Crea due account utente di test (A e B), entrambi con `callsign` valorizzato.
2. A mette il ponte "TEST" tra i preferiti.
3. B chiama `create_spot(repeater_id=TEST, duration=5)`.
4. **Verifica**: `select * from public.repeater_spots where user_id=B` → 1 riga, `closed_at IS NULL`, `expires_at = now()+5min`.
5. **Verifica**: `select count(*) from public.user_notifications where user_id=A` → 1.
6. **Verifica**: il device di A riceve la notifica push (fixture di OneSignal device token richiesta).
7. B chiama `create_spot(repeater_id=TEST2, duration=10)`.
8. **Verifica**: lo spot precedente di B ha `closed_at IS NOT NULL`, lo nuovo è l'unico con `closed_at IS NULL`.
9. B chiama `close_spot(<new_spot_id>)`.
10. **Verifica**: `closed_at IS NOT NULL`, `closed_by = B`.
11. B richiama `close-spot` sullo stesso id → errore `ALREADY_CLOSED`.
12. A chiama `close_spot(<spot_di_B>)` → errore `FORBIDDEN`.
