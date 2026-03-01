# Send Notification API

Edge Function per l'invio di notifiche push tramite OneSignal con supporto multilingua.

## Endpoint

```
POST /functions/v1/send_notification
```

## Autenticazione

| Metodo | Descrizione |
|--------|-------------|
| `Bearer <user_jwt>` | Token JWT utente autenticato |
| `Bearer <service_role_key>` | Chiamate interne (trigger DB, cron) |

## Request Body

```json
{
  "headings": { "en": "New feedback", "it": "Nuovo feedback" },
  "contents": { "en": "Repeater IW3XYZ got feedback!", "it": "Il ponte IW3XYZ ha ricevuto un feedback!" },
  "include_external_user_ids": ["user-uuid-1", "user-uuid-2"],
  "data": { "repeater_id": "abc-123", "type": "new_feedback" },
  "url": "hamqrg://repeater/abc-123"
}
```

### Campi

| Campo | Tipo | Obbligatorio | Descrizione |
|-------|------|:------------:|-------------|
| `headings` | `Record<string, string>` | Si | Titolo multilingua. Chiave = codice ISO 639-1, valore = testo. |
| `contents` | `Record<string, string>` | Si | Corpo multilingua. Stesso formato di `headings`. |
| `include_external_user_ids` | `string[]` | * | Lista di `auth.uid()` Supabase a cui inviare. |
| `included_segments` | `string[]` | * | Segmenti OneSignal (es. `"All"`, `"Active Users"`). |
| `data` | `Record<string, string>` | No | Payload custom allegato alla notifica (es. `repeater_id`, `type`). |
| `url` | `string` | No | URL o deep link da aprire al tap sulla notifica. |

> \* Almeno uno tra `include_external_user_ids` e `included_segments` e' obbligatorio.

### Lingue supportate

I campi `headings` e `contents` seguono il formato OneSignal Multi-Language Messaging.
OneSignal consegna automaticamente la lingua corrispondente al device dell'utente, con fallback su `en`.

```json
{
  "headings": {
    "en": "English title",
    "it": "Titolo italiano",
    "de": "Deutscher Titel",
    "fr": "Titre francais"
  }
}
```

## Response

### Successo (200)

```json
{
  "success": true,
  "id": "onesignal-notification-id",
  "recipients": 42,
  "timestamp": "2026-03-01T12:00:00.000Z"
}
```

### Errore di validazione (400)

```json
{
  "success": false,
  "error": "Missing required field: headings",
  "timestamp": "2026-03-01T12:00:00.000Z"
}
```

### Errore server (500)

```json
{
  "success": false,
  "error": "OneSignal API error: 401 Unauthorized - ...",
  "timestamp": "2026-03-01T12:00:00.000Z"
}
```

## Tabella `user_notifications`

La tabella memorizza lo storico delle notifiche inviate. Un trigger automatico chiama questa Edge Function ad ogni INSERT.

### Schema

| Colonna | Tipo | Default | Descrizione |
|---------|------|---------|-------------|
| `id` | `uuid` | `gen_random_uuid()` | Primary key |
| `user_id` | `uuid` | - | FK a `auth.users(id)` |
| `headings` | `jsonb` | - | Titolo multilingua |
| `contents` | `jsonb` | - | Corpo multilingua |
| `data` | `jsonb` | `'{}'` | Payload custom (repeater_id, type, ecc.) |
| `created_at` | `timestamptz` | `now()` | Data di creazione |

### RLS

- **SELECT**: gli utenti possono vedere solo le proprie notifiche (`auth.uid() = user_id`)

### Trigger

`trg_user_notification_push` - Dopo ogni INSERT, chiama `send_notification` via `pg_net` con il `service_role_key` dal Vault.

## Esempi

### Invio diretto via API

```bash
curl -X POST https://<project>.supabase.co/functions/v1/send_notification \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "headings": {"en": "Test", "it": "Test"},
    "contents": {"en": "Hello!", "it": "Ciao!"},
    "included_segments": ["All"]
  }'
```

### Invio via INSERT (trigger automatico)

```sql
INSERT INTO user_notifications (user_id, headings, contents, data)
VALUES (
  'user-uuid',
  '{"en": "New feedback", "it": "Nuovo feedback"}'::jsonb,
  '{"en": "Repeater IW3XYZ got feedback!", "it": "Il ponte IW3XYZ ha ricevuto un feedback!"}'::jsonb,
  '{"repeater_id": "repeater-uuid", "type": "new_feedback"}'::jsonb
);
```

### Invio broadcast a segmento

```json
{
  "headings": { "en": "Maintenance", "it": "Manutenzione" },
  "contents": { "en": "Scheduled maintenance tonight", "it": "Manutenzione programmata stasera" },
  "included_segments": ["All"]
}
```

### Invio a utenti specifici con deep link

```json
{
  "headings": { "en": "New feedback", "it": "Nuovo feedback" },
  "contents": { "en": "Your favorite repeater got feedback", "it": "Il tuo ponte preferito ha ricevuto un feedback" },
  "include_external_user_ids": ["uuid-1", "uuid-2"],
  "data": { "repeater_id": "abc-123", "type": "new_feedback" },
  "url": "hamqrg://repeater/abc-123"
}
```

## Setup

### Environment Variables

| Variabile | Descrizione |
|-----------|-------------|
| `ONESIGNAL_APP_ID` | App ID dal dashboard OneSignal |
| `ONESIGNAL_REST_API_KEY` | REST API Key dal dashboard OneSignal |

### Vault Secrets (per il trigger DB)

```sql
-- Locale
SELECT vault.create_secret('http://kong:8000', 'project_url');
SELECT vault.create_secret('<service_role_key>', 'service_role_key');

-- Produzione: Supabase Dashboard -> Vault -> Add secret
```

### Flutter (client)

```dart
// Inizializzare OneSignal
OneSignal.initialize("ONESIGNAL_APP_ID");

// Dopo il login Supabase, mappare l'utente
OneSignal.login(supabase.auth.currentUser!.id);
```

## Architettura

```
INSERT user_notifications
        |
        v
  [PostgreSQL Trigger]
        |
        v
  [pg_net HTTP POST] ---> [send_notification Edge Function]
                                    |
                                    v
                            [OneSignal REST API]
                                    |
                                    v
                              [Push to device]
```

```
send_notification/
├── index.ts                              # DI + HTTP handler
├── types.ts                              # NotificationRequest, NotificationResult
├── controller/
│   └── notification-controller.ts        # Validazione + orchestrazione
└── usecase/
    └── send-push-notification.ts         # Chiama OneSignalClient

_shared/api/
└── onesignal-client.ts                   # Client REST OneSignal
```
