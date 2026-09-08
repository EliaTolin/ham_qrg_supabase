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

## Idempotenza e transazione

`supabase db push` esegue già ogni migration dentro una transazione, quindi il
file **non** apre un `begin`/`commit` esplicito: sarebbe annidato e il commit
chiuderebbe in anticipo la transazione del CLI. Le tabelle di staging sono
create senza `on commit drop` e rimosse esplicitamente in coda.

`on conflict do nothing` su entrambe le tabelle. La deduplicazione si appoggia
agli indici esistenti:

- `repeaters_frequency_locator_unique (frequency_hz, locator)`
- `repeaters_external_id_unique (external_id)`
- `repeater_access_dedup_unique (repeater_id, mode, network_id, ctcss_hz, dcs_code, color_code, talkgroup, dg_id)`

## search_path

In Supabase PostGIS è installato nello schema `extensions`, non in `public`.
Senza `set search_path = public, extensions` la colonna generata
`repeaters.geom` non riesce a risolvere il tipo `geography` e l'insert fallisce
con `SQLSTATE 42704`. La migration lo imposta esplicitamente.

## Verifica eseguita

Postgres 17.6 + PostGIS 3.5.3 in Docker, con **PostGIS nello schema
`extensions`** per replicare la configurazione Supabase, schema ricostruito
applicando tutte le migration del repo:

- primo run su DB vuoto: 17.541 repeaters + 30.431 access
- secondo run: conteggi invariati → **idempotente**
- terzo run con 2 ponti preesistenti di altra sorgente (`source='iz8wnh'`):
  righe altrui **intatte** per source, external_id e CTCSS
- 0 access orfani, 0 `geom` nulli, 0 tabelle di staging residue
- RPC verificate: `repeaters_nearby` (anche coi filtri `P25` e `IRLP`),
  `repeaters_in_bounds`, `search_repeaters`

## Completezza dei dati

Coordinate, locator, shift, località e regione sono presenti sul 100% delle
righe. 6.520 ponti condividono le coordinate con altri: non è un errore, è la
posizione approssimata alla città pubblicata dalle directory per i ponti privati.

I dati di accesso sono invece parziali, perché il dump USA di partenza non
espone le colonne dei node (ha solo `system_links` come testo libero):

| Modo | Access | Senza dato d'accesso |
|---|---|---|
| ANALOG | 17.222 | 2.858 (16,6%) — accesso libero, legittimo |
| ECHOLINK | 3.766 | 3.610 (95,9%) |
| ALLSTAR | 3.440 | 3.401 (98,9%) |
| IRLP | 2.612 | 2.569 (98,4%) |
| C4FM | 1.969 | 1.929 (98,0%) |
| P25 | 469 | 444 (94,7%) |
| DMR | 627 | 94 (15,0%) |
| DSTAR / NXDN / ATV | 326 | 0 |

Gli access di link privi di `node_id` sono stati **mantenuti**: segnalano che il
ponte offre quella modalità, anche se il numero per collegarsi va reperito
altrove. Da valutare lato client se distinguerli visivamente.


## Note sui dati

- Modi `M17` e `TETRA` scartati (non presenti nell'enum); nessuna riga persa.
- Bande 23 cm, 10 m, 13 cm, 3 cm escluse; 6 m e 33 cm mantenute.
- 78 righe dubbie rimosse (collisioni di locator, DMR ID incoerenti).
- `node_id` popolato per EchoLink, AllStar, IRLP, Wires-X; per DMR viene usato
  `talkgroup` con il DMR ID e `color_code` quando disponibili.
- Il NAC dei ponti P25 è riportato in `notes` (`NAC <valore>`), perché lo schema
  non ha una colonna dedicata.
