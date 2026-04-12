# Cluster / Spot — Specifica tecnica (STORICA)

> **⚠️ ATTENZIONE**: Questo documento è stato redatto prima della sessione di clarification del 2026-04-10 e **non è più la fonte autoritativa**. La fonte autoritativa è [`specs/001-cluster-spots/`](../specs/001-cluster-spots/) (spec.md, plan.md, data-model.md, contracts/). Le differenze principali: (1) la moderazione admin è stata rimossa dalla v1 (Q5), (2) è stata aggiunta la colonna `callsign_snapshot`, (3) FR-010 è stato riformulato con stato derivato. Questo file resta utile come reference dei pattern SQL ma **non va usato per decisioni di design**.

> Specifica **tecnica** della feature Cluster / Spot. Per la descrizione funzionale e le decisioni di prodotto vedi [`cluster-spots.md`](./cluster-spots.md). Questo documento assume che le decisioni funzionali siano già state prese e le traduce in schema, RLS, RPC, trigger e migration.

## Indice

- [Infrastruttura esistente riusata](#infrastruttura-esistente-riusata)
- [Schema](#schema)
- [Indici](#indici)
- [Modifiche a tabelle esistenti](#modifiche-a-tabelle-esistenti)
- [Realtime publication](#realtime-publication)
- [RLS policies](#rls-policies)
- [RPC](#rpc)
- [Trigger notifiche push](#trigger-notifiche-push)
- [Contratto API client](#contratto-api-client)
- [Cleanup / scadenze](#cleanup--scadenze)
- [Migration plan](#migration-plan)
- [Casi limite e considerazioni](#casi-limite-e-considerazioni)

## Infrastruttura esistente riusata

La feature non introduce nuove infrastrutture trasversali; riusa quanto già presente nel progetto:

| Componente esistente | File di riferimento | Come viene usato |
|----------------------|---------------------|------------------|
| `public.profiles` | `20251223152305_profiles.sql`, `20251230124112_profiles_callsign_favorites.sql` | Lettura `callsign` per validazione e visualizzazione; aggiunta colonna opt-out cluster |
| `public.user_favorite_repeaters` | `20251223184226_favorite.sql` | Determinare destinatari notifiche; aggiunta colonna opt-out per-preferito |
| `public.user_notifications` + trigger `trg_user_notification_push` | `20260301120000_user_notifications.sql` | Pipeline push notification: l'INSERT in `user_notifications` invoca automaticamente l'edge function `send_notification` via `pg_net` |
| Pattern `notify_favorites_on_*` | `20260301130000_notify_favorites_on_feedback.sql` | Modello per il nuovo trigger `notify_favorites_on_spot` |
| RBAC custom claims + `public.authorize()` | `20260209120000_rbac_custom_claims.sql` | Policy admin per chiusura forzata di spot abusivi (riusa permission `users.manage`) |
| Realtime publication `supabase_realtime` | esistente | Aggiunta tabella `repeater_spots` per propagazione eventi WebSocket |

**Niente nuove edge function**: il push viene inviato dalla `send_notification` esistente.

## Schema

### Nuova tabella `public.repeater_spots`

| Campo              | Tipo         | Nullable | Default            | Note                                                                              |
|--------------------|--------------|----------|--------------------|-----------------------------------------------------------------------------------|
| `id`               | `uuid`       | NO       | `gen_random_uuid()` | PK                                                                                |
| `user_id`          | `uuid`       | NO       |                    | FK → `auth.users(id)` ON DELETE CASCADE                                           |
| `repeater_id`      | `uuid`       | NO       |                    | FK → `public.repeaters(id)` ON DELETE CASCADE                                     |
| `access_id`        | `uuid`       | SI       |                    | FK → `public.repeater_access(id)` ON DELETE SET NULL; deve appartenere allo stesso `repeater_id` (vedi composite FK) |
| `started_at`       | `timestamptz`| NO       | `now()`            |                                                                                   |
| `duration_minutes` | `smallint`   | NO       |                    | CHECK BETWEEN 1 AND 60                                                            |
| `expires_at`       | `timestamptz`| NO       |                    | Generated column: `started_at + (duration_minutes \|\| ' minutes')::interval`    |
| `closed_at`        | `timestamptz`| SI       |                    | Valorizzata su chiusura manuale, sostituzione automatica o azione admin           |
| `closed_by`        | `uuid`       | SI       |                    | FK → `auth.users(id)` ON DELETE SET NULL — chi ha chiuso (può essere owner o admin) |
| `created_at`       | `timestamptz`| NO       | `now()`            |                                                                                   |

### Constraints

- `CHECK (duration_minutes BETWEEN 1 AND 60)` — durata valida
- `CHECK (closed_at IS NULL OR closed_at >= started_at)` — coerenza temporale
- `CHECK (closed_by IS NULL OR closed_at IS NOT NULL)` — `closed_by` valorizzato solo se chiuso
- **Coerenza access ↔ repeater**: composite FK `(access_id, repeater_id)` referenziante una constraint UNIQUE `(id, repeater_id)` aggiunta a `repeater_access` (vedi sotto). Garantisce a livello dichiarativo che l'access scelto appartenga al ponte dello spot.
- **Callsign required**: enforcement nella RPC `create_spot` (non può essere una CHECK constraint perché coinvolge una tabella diversa)

### Stato derivato di uno spot

Lo stato non è una colonna ma viene calcolato da `closed_at` ed `expires_at`:

| Stato | Condizione |
|-------|------------|
| `active` | `closed_at IS NULL AND expires_at > now()` |
| `expired` | `closed_at IS NULL AND expires_at <= now()` |
| `closed` | `closed_at IS NOT NULL` |

## Indici

```sql
-- Spot di un ponte ordinati per recenza (scheda dettaglio ponte)
create index idx_spots_repeater_started
  on public.repeater_spots (repeater_id, started_at desc);

-- Ultimi spot globali (sezione "ultimi spot")
create index idx_spots_started
  on public.repeater_spots (started_at desc);

-- Vincolo "1 spot attivo per utente" + lookup veloce
create unique index idx_spots_active_per_user
  on public.repeater_spots (user_id)
  where closed_at is null;
```

> **Nota sull'indice unico**: considera "attivo" qualsiasi spot con `closed_at IS NULL`, anche se naturalmente scaduto. Per questo motivo la RPC `create_spot` chiude **sempre esplicitamente** lo spot precedente prima di inserirne uno nuovo, indipendentemente dal fatto che fosse ancora entro `expires_at`. In questo modo l'INSERT del nuovo spot non viola mai l'indice unico.

## Modifiche a tabelle esistenti

### `public.profiles`

Colonna per l'opt-out globale notifiche cluster:

```sql
alter table public.profiles
  add column cluster_notifications_enabled boolean not null default true;

comment on column public.profiles.cluster_notifications_enabled is
  'Global opt-out for cluster spot push notifications';
```

### `public.user_favorite_repeaters`

Colonna per l'opt-out per-preferito:

```sql
alter table public.user_favorite_repeaters
  add column cluster_notifications_enabled boolean not null default true;

comment on column public.user_favorite_repeaters.cluster_notifications_enabled is
  'Per-favorite opt-out for cluster spot push notifications on this specific repeater';
```

### `public.repeater_access`

UNIQUE constraint per supportare la composite FK da `repeater_spots`:

```sql
alter table public.repeater_access
  add constraint repeater_access_id_repeater_unique unique (id, repeater_id);
```

(È una UNIQUE "ridondante" perché `id` è già PK, ma necessaria affinché Postgres permetta di referenziarla con composite FK.)

## Realtime publication

```sql
alter publication supabase_realtime add table public.repeater_spots;
```

## RLS policies

```sql
alter table public.repeater_spots enable row level security;

-- SELECT: tutti gli utenti autenticati possono leggere tutti gli spot
create policy "authenticated can read all spots"
  on public.repeater_spots
  for select
  to authenticated
  using (true);

-- INSERT: solo via RPC create_spot (security definer). Nessuna policy diretta INSERT,
-- per garantire che ogni inserzione passi dalla validazione callsign + chiusura precedente.

-- UPDATE: l'owner può chiudere il proprio spot
create policy "users can close own spots"
  on public.repeater_spots
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- UPDATE admin: chi ha permesso 'users.manage' può chiudere qualsiasi spot (moderazione)
create policy "admins can close any spot"
  on public.repeater_spots
  for update
  to authenticated
  using (public.authorize('users.manage'::public.app_permission));

-- DELETE: nessuno. La chiusura è soft via closed_at.
```

> **Nota sul permesso admin**: in v1 si riusa `users.manage` (già grantato al ruolo `admin`) per la chiusura forzata, evitando l'introduzione di un nuovo permesso. Se in futuro si vuole separare un ruolo "moderatore cluster" dagli admin globali, si potrà introdurre un nuovo `cluster.manage` permission via `ALTER TYPE app_permission ADD VALUE`.

## RPC

### `public.create_spot(p_repeater_id uuid, p_duration_minutes smallint, p_access_id uuid default null) returns public.repeater_spots`

Funzione `SECURITY DEFINER`, `LANGUAGE plpgsql`. Comportamento:

1. Verifica `auth.uid() IS NOT NULL` — altrimenti `RAISE EXCEPTION 'AUTH_REQUIRED'`
2. Verifica che `profiles.callsign` di `auth.uid()` sia non null e non blank — altrimenti `RAISE EXCEPTION 'CALLSIGN_REQUIRED'`
3. Verifica `p_duration_minutes BETWEEN 1 AND 60` — altrimenti `RAISE EXCEPTION 'INVALID_DURATION'`
4. Verifica esistenza del ponte — altrimenti `RAISE EXCEPTION 'REPEATER_NOT_FOUND'`
5. Se `p_access_id IS NOT NULL`, verifica che esista e che `repeater_id` corrisponda — altrimenti `RAISE EXCEPTION 'INVALID_ACCESS'` (questa è una pre-validazione esplicita per ottenere un errore parlante prima che la composite FK lo intercetti a livello DB)
6. **Chiude lo spot attivo precedente** dell'utente (se presente):
   ```sql
   update public.repeater_spots
     set closed_at = now(),
         closed_by = auth.uid()
     where user_id = auth.uid()
       and closed_at is null;
   ```
7. **Inserisce il nuovo spot**:
   ```sql
   insert into public.repeater_spots (user_id, repeater_id, access_id, duration_minutes)
   values (auth.uid(), p_repeater_id, p_access_id, p_duration_minutes)
   returning *;
   ```
8. Restituisce la riga creata

L'intera funzione è eseguita in una singola transazione implicita (chiamata RPC = transazione singola), quindi step 6 e 7 sono atomici.

### `public.close_spot(p_spot_id uuid) returns public.repeater_spots`

Funzione `SECURITY DEFINER`, `LANGUAGE plpgsql`. Comportamento:

1. Verifica `auth.uid() IS NOT NULL` — altrimenti `RAISE EXCEPTION 'AUTH_REQUIRED'`
2. Carica lo spot. Se non esiste — `RAISE EXCEPTION 'SPOT_NOT_FOUND'`
3. Verifica che `spot.user_id = auth.uid()` **OPPURE** `public.authorize('users.manage')` sia true — altrimenti `RAISE EXCEPTION 'FORBIDDEN'`
4. Verifica che `closed_at IS NULL` — altrimenti `RAISE EXCEPTION 'ALREADY_CLOSED'`
5. UPDATE:
   ```sql
   update public.repeater_spots
     set closed_at = now(),
         closed_by = auth.uid()
     where id = p_spot_id
   returning *;
   ```
6. Restituisce la riga aggiornata

### Codici di errore esposti dalle RPC

| Codice | Significato | HTTP equivalente |
|--------|-------------|------------------|
| `AUTH_REQUIRED` | Utente non autenticato | 401 |
| `CALLSIGN_REQUIRED` | Profilo senza callsign valorizzato | 422 |
| `INVALID_DURATION` | Durata fuori range 1–60 | 422 |
| `REPEATER_NOT_FOUND` | `repeater_id` inesistente | 404 |
| `INVALID_ACCESS` | `access_id` inesistente o non appartenente al ponte | 422 |
| `SPOT_NOT_FOUND` | `spot_id` inesistente | 404 |
| `FORBIDDEN` | Tentativo di chiudere uno spot non proprio senza essere admin | 403 |
| `ALREADY_CLOSED` | Spot già chiuso | 409 |

I codici sono sollevati con `RAISE EXCEPTION USING errcode = 'P0001', message = '...'` o codici più specifici dove appropriato. Il client li riconosce dal `message` e mostra messaggi localizzati.

## Trigger notifiche push

```sql
create or replace function public.notify_favorites_on_spot()
returns trigger
language plpgsql
security definer
as $$
declare
  _repeater_label text;
  _spotter_callsign text;
  _fav_user_id uuid;
begin
  -- Label leggibile del ponte
  select coalesce(r.callsign, r.name, 'Repeater')
    into _repeater_label
    from public.repeaters r
    where r.id = new.repeater_id;

  -- Callsign dello spotter (è già garantito non null dalla RPC create_spot)
  select p.callsign into _spotter_callsign
    from public.profiles p
    where p.id = new.user_id;

  -- Per ogni utente con il ponte nei preferiti, opt-in globale e per-preferito,
  -- escluso lo spotter stesso
  for _fav_user_id in
    select ufr.user_id
      from public.user_favorite_repeaters ufr
      join public.profiles p on p.id = ufr.user_id
      where ufr.repeater_id = new.repeater_id
        and ufr.user_id <> new.user_id
        and ufr.cluster_notifications_enabled = true
        and p.cluster_notifications_enabled = true
  loop
    insert into public.user_notifications (user_id, headings, contents, data)
    values (
      _fav_user_id,
      jsonb_build_object(
        'en', 'New spot on ' || _repeater_label,
        'it', 'Nuovo spot su ' || _repeater_label
      ),
      jsonb_build_object(
        'en', _spotter_callsign || ' is listening for ' || new.duration_minutes || ' min',
        'it', _spotter_callsign || ' è in ascolto per ' || new.duration_minutes || ' min'
      ),
      jsonb_build_object(
        'type', 'new_cluster_spot',
        'spot_id', new.id::text,
        'repeater_id', new.repeater_id::text,
        'spotter_user_id', new.user_id::text
      )
    );
  end loop;

  return new;
end;
$$;

create trigger trg_notify_favorites_on_spot
  after insert on public.repeater_spots
  for each row
  execute function public.notify_favorites_on_spot();
```

> **Effetto a cascata**: l'INSERT in `user_notifications` attiva il trigger esistente `trg_user_notification_push`, che a sua volta chiama l'edge function `send_notification` via `pg_net`. Nessuna logica push aggiuntiva da scrivere.

## Contratto API client

Le seguenti operazioni sono quelle che il client (Flutter) eseguirà via supabase-js / supabase_flutter.

### Creare uno spot

```dart
final spot = await supabase.rpc('create_spot', params: {
  'p_repeater_id': repeaterId,
  'p_duration_minutes': durationMinutes,
  'p_access_id': accessId, // opzionale, può essere null
});
```

### Chiudere il proprio spot

```dart
await supabase.rpc('close_spot', params: {
  'p_spot_id': spotId,
});
```

### Lista "ultimi spot" globali (ultime 24h)

```ts
supabase
  .from('repeater_spots')
  .select(`
    id, started_at, expires_at, closed_at, duration_minutes,
    profiles!user_id ( id, callsign, first_name, last_name ),
    repeaters!repeater_id ( id, name, callsign ),
    repeater_access!access_id ( id, access_mode, ctcss_tx_hz, dmr_color_code )
  `)
  .gte('started_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
  .order('started_at', { ascending: false })
```

### Spot di un ponte specifico

Stessa query con filtro aggiuntivo:

```ts
.eq('repeater_id', repeaterId)
```

### Spot attivo dell'utente corrente

```ts
supabase
  .from('repeater_spots')
  .select('*')
  .eq('user_id', userId)
  .is('closed_at', null)
  .gt('expires_at', new Date().toISOString())
  .maybeSingle()
```

### Sottoscrizione realtime — scheda dettaglio ponte

```ts
supabase
  .channel(`spots:repeater:${repeaterId}`)
  .on('postgres_changes',
      { event: '*', schema: 'public', table: 'repeater_spots',
        filter: `repeater_id=eq.${repeaterId}` },
      async (payload) => {
        // Re-fetch dell'oggetto enriched, perché payload contiene solo le colonne
        // della tabella repeater_spots e non i join annidati
        const { data } = await supabase
          .from('repeater_spots')
          .select(`id, started_at, expires_at, closed_at, duration_minutes,
                   profiles!user_id(callsign),
                   repeater_access!access_id(access_mode)`)
          .eq('id', payload.new.id)
          .single();
        // applica `data` allo state locale
      })
  .subscribe()
```

### Sottoscrizione realtime — sezione "ultimi spot" globale

Stessa di sopra ma senza il `filter`. Riceve eventi per tutti gli spot.

### Sottoscrizione realtime — proprio spot attivo

```ts
supabase
  .channel(`spots:user:${userId}`)
  .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'repeater_spots',
        filter: `user_id=eq.${userId}` },
      payload => {
        // Notifica l'utente che il suo spot è stato chiuso/sostituito
      })
  .subscribe()
```

## Cleanup / scadenze

**Nessun job di cleanup.** Gli spot scaduti naturalmente (`expires_at <= now()`) restano nel DB con `closed_at IS NULL` finché non vengono sostituiti dall'azione `create_spot` dello stesso utente. Lo storico permanente è una decisione di prodotto (vedi specifica funzionale §4).

**Implicazione importante per la determinazione di "spot attivo"**:

- Per scopi di **visualizzazione** in app: `closed_at IS NULL AND expires_at > now()`
- Per scopi di **enforcement del vincolo "1 spot attivo per utente"** (indice unico): `closed_at IS NULL` (anche se scaduto)

Questa asimmetria è intenzionale: la RPC `create_spot` chiude sempre esplicitamente il precedente, quindi all'INSERT del nuovo l'indice unico non è mai violato.

## Migration plan

Si prevedono **3 file di migration** distinti, in quest'ordine, sotto `supabase/migrations/`. I timestamp finali saranno generati al momento dell'implementazione effettiva.

### 1. `<timestamp>_repeater_spots.sql`

- UNIQUE su `repeater_access(id, repeater_id)` (precondizione composite FK)
- CREATE TABLE `repeater_spots` con tutte le colonne, constraint, generated column `expires_at`
- Indici (`idx_spots_repeater_started`, `idx_spots_started`, `idx_spots_active_per_user`)
- ENABLE RLS
- Policy SELECT, UPDATE owner, UPDATE admin
- `ALTER PUBLICATION supabase_realtime ADD TABLE`

### 2. `<timestamp>_cluster_notification_preferences.sql`

- `ALTER TABLE profiles ADD COLUMN cluster_notifications_enabled boolean NOT NULL DEFAULT true`
- `ALTER TABLE user_favorite_repeaters ADD COLUMN cluster_notifications_enabled boolean NOT NULL DEFAULT true`
- Comment SQL su entrambe le colonne

### 3. `<timestamp>_cluster_spot_rpc_and_notify.sql`

- Funzione `create_spot` (SECURITY DEFINER)
- Funzione `close_spot` (SECURITY DEFINER)
- GRANT EXECUTE su entrambe a `authenticated`
- Funzione `notify_favorites_on_spot` (SECURITY DEFINER)
- Trigger `trg_notify_favorites_on_spot`

> Le migration sono spezzate in 3 file per:
> - separare il "data layer" (1) dal "preference layer" (2) e dal "behavior layer" (3)
> - facilitare il rollback selettivo
> - tenere ogni file sotto i ~100 righe leggibili

## Casi limite e considerazioni

### Race condition: due richieste `create_spot` concorrenti dello stesso utente

Lo step "chiudi precedente + inserisci nuovo" della RPC è eseguito in una singola transazione. L'indice unico parziale `idx_spots_active_per_user` garantisce che, in caso di race, una delle due transazioni fallirà al momento dell'INSERT con violazione di unique constraint. Il client deve gestire questo errore (riprovare o mostrare errore).

### Spot creato da utente che poi cancella il proprio account

`user_id` ha `ON DELETE CASCADE` → tutti gli spot dell'utente vengono cancellati con l'account. Lo storico per quell'utente sparisce, comportamento accettabile per GDPR.

### Ponte cancellato mentre ha spot attivi

`repeater_id` ha `ON DELETE CASCADE` → gli spot del ponte sono rimossi. Coerente con il fatto che senza il ponte lo spot non ha più riferimento.

### Access cancellato mentre ha spot che lo riferiscono

`access_id` ha `ON DELETE SET NULL` → gli spot diventano "generici" sul ponte. L'app deve gestire questa nullità nella UI.

### Realtime e join annidati

Il payload Realtime di Supabase contiene **solo le colonne della tabella `repeater_spots`**, NON i record correlati. Il client, alla ricezione di un evento, deve fare una query puntuale `select=...,profiles(...)...&id=eq.<spot_id>` per ottenere l'oggetto arricchito. Pattern standard, documentato nel client.

### Notifiche a favorite con utente cancellato

Il loop nel trigger fa un JOIN su `profiles`, quindi se un favorite punta a un user cancellato (caso impossibile per CASCADE ma per sicurezza) viene saltato implicitamente.

### Volume notifiche per ponte molto popolare

Se un ponte ha 500 utenti tra i preferiti, ogni spot genera 500 INSERT in `user_notifications` e 500 chiamate `pg_net` per push. Per v1 è accettabile (Supabase scala fino a numeri ben superiori). Se diventa un problema:
- batch INSERT singolo invece di loop (già fatto, è un singolo INSERT...SELECT semplificabile)
- coalescing nella edge function `send_notification` (un solo POST OneSignal con array di destinatari)

### Autenticazione anonima

Il progetto consente utenti anonimi (vedi `repeater-submissions.md`). Per gli spot, la verifica del callsign nella RPC blocca implicitamente gli utenti anonimi (che non hanno callsign). Comportamento desiderato: solo utenti registrati con callsign possono fare spot.
