# Frontend Integration Spec — Cluster Spots

**Feature**: 001-cluster-spots
**Date**: 2026-04-11
**Audience**: Flutter app (`ham_qrg_flutter`) + Next.js dashboard (`ham_qrg_dashboard`)

> Questo file soddisfa il requisito **Constitution §V** (Frontend Integration Specification, NON-NEGOTIABLE) che impone la consegna di una spec di integrazione frontend in `specs/<feature>/frontend-integration.md`. Il contenuto effettivo è distribuito nei file `contracts/` e `quickstart.md` per maggiore granularità e manutenibilità (vedi [research.md §11](./research.md)).

---

## Cross-reference ai 5 punti mandatori della Constitution §V

| # | Punto Constitution §V | Coperto da | Sezione specifica |
|---|---|---|---|
| 1 | **Endpoint / RPC contract**: HTTP method, path, auth, request schema, response schema, error codes | [contracts/rpc.md](./contracts/rpc.md) | §1 `create_spot`, §2 `close_spot` — firme, request body, response JSON, tabelle errori con HTTP equivalents |
| 2 | **Example payloads**: realistic request + success response + error response | [contracts/rpc.md](./contracts/rpc.md) + [quickstart.md](./quickstart.md) | rpc.md §1–§2 (full JSON examples); quickstart.md §2 (Dart mapping codici → i18n) |
| 3 | **Behavioral notes**: pagination, ordering, geographic units, enum values, RLS implications | [contracts/rest.md](./contracts/rest.md) + [contracts/realtime.md](./contracts/realtime.md) | rest.md §1–§4 (ordering, 24h window, stato derivato helper); realtime.md §2–§6 (event semantics, RLS impact, channel topology) |
| 4 | **Migration impact**: breaking changes, recommended migration path | [quickstart.md](./quickstart.md) | §7 "Migration impact" — tabella di tutti i cambiamenti backend con "Impatto client esistente: Nessuno" |
| 5 | **Open questions**: decisions the frontend team must make before integrating | [quickstart.md](./quickstart.md) | §8 "Open questions per il team frontend" — 6 domande UX non-blocking per il backend |

---

## Quick navigation per il team frontend

### Per chi sviluppa la Flutter app

1. **Come creare/chiudere uno spot**: [quickstart.md §2](./quickstart.md) — codice Dart completo con error handling
2. **Come mostrare "in ascolto ora" su un ponte**: [quickstart.md §3](./quickstart.md) — Cubit con Realtime
3. **Come mostrare "Ultimi spot 24h"**: [quickstart.md §4](./quickstart.md) — query + global channel
4. **Come gestire le preferenze notifica**: [quickstart.md §5](./quickstart.md) — lettura/scrittura flag
5. **Come ascoltare il proprio spot attivo**: [quickstart.md §6](./quickstart.md) — user channel toast
6. **Helper `SpotState` derivato**: [contracts/rest.md §4](./contracts/rest.md) — Dart enum + extension

### Per chi sviluppa il dashboard Next.js

1. **Schema TypeScript generato**: `types/supabase.ts` (rigenerato post-migration in task T022)
2. **Query REST autorizzate (read-only)**: [contracts/rest.md](./contracts/rest.md) — nessuna UI di moderazione in v1

### Error handling reference

Tabella completa dei codici errore con HTTP equivalent e messaggi i18n suggeriti: [contracts/rpc.md §1 Errors](./contracts/rpc.md) + [quickstart.md §2 mapping](./quickstart.md).

---

## Nessun breaking change

Vedi [quickstart.md §7](./quickstart.md): tutte le 3 migration aggiungono solo nuove tabelle/colonne/RPC. I client esistenti continuano a funzionare invariati.
