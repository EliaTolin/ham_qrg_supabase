# Import ripetitori mondiale — 2026-09

Migration: `20260908130000_import_repeaters_worldwide.sql`

## Contenuto

- **17.541 repeaters** in 15 paesi (prevalenza USA, più Australia, Nuova Zelanda, Sud America)
- **30.431 repeater_access**

Ripartizione per modo:

| Modo | Access |
|---|---|
| ANALOG | 17.222 |
| ECHOLINK | 3.766 |
| ALLSTAR | 3.440 |
| IRLP | 2.612 |
| C4FM | 1.969 |
| DMR | 627 |
| P25 | 469 |
| DSTAR | 253 |
| NXDN | 70 |
| ATV | 3 |

## Prerequisito

Richiede `20260908120000_add_access_modes_p25_irlp.sql` (P25 e IRLP nell'enum
`access_mode`). La migration ha una guardia esplicita: se i due valori mancano
fallisce subito con un messaggio chiaro invece di inserire dati parziali.

## external_id

Ogni repeater ha un `external_id` nella forma `hq_<20 hex>`, ottenuto come
`blake2s(namespace | country | state | source_row_id)`.

- **Opaco**: non espone l'identificatore della sorgente.
- **Deterministico**: rieseguendo il generatore sugli stessi dati sorgente si
  ottengono gli stessi id, quindi l'import è ri-eseguibile e gli aggiornamenti
  futuri riconoscono le righe già presenti.
- Il namespace è `hamqrg.repeater.v1` ed è congelato: cambiarlo rigenera tutti
  gli id e produrrebbe duplicati.

La corrispondenza `external_id` → riga sorgente è mantenuta **fuori dal repo**
(`external_id_map.csv`, non versionato).

## Idempotenza

Transazione unica, `on conflict do nothing` su entrambe le tabelle. La
deduplicazione si appoggia agli indici esistenti:

- `repeaters_frequency_locator_unique (frequency_hz, locator)`
- `repeaters_external_id_unique (external_id)`
- `repeater_access_dedup_unique (repeater_id, mode, network_id, ctcss_hz, dcs_code, color_code, talkgroup, dg_id)`

## Verifica eseguita

Postgres 17.6 + PostGIS 3.5.3 in Docker, schema ricostruito applicando tutte
le 67 migration del repo:

- primo run: `INSERT 17541` + `INSERT 30431`, commit in **15,6 s**
- secondo run: `INSERT 0` + `INSERT 0`, conteggi invariati → **idempotente**
- 0 access orfani, 0 `geom` nulli, 0 `external_id` nulli
- RPC `repeaters_nearby` e `repeaters_in_bounds` interrogate con esito positivo,
  compresi i filtri `P25` e `IRLP`

## Note sui dati

- Modi `M17` e `TETRA` scartati (non presenti nell'enum); nessuna riga persa.
- Bande 23 cm, 10 m, 13 cm, 3 cm escluse; 6 m e 33 cm mantenute.
- 78 righe dubbie rimosse (collisioni di locator, DMR ID incoerenti).
- `node_id` popolato per EchoLink, AllStar, IRLP, Wires-X; per DMR viene usato
  `talkgroup` con il DMR ID e `color_code` quando disponibili.
- Il NAC dei ponti P25 è riportato in `notes` (`NAC <valore>`), perché lo schema
  non ha una colonna dedicata.
