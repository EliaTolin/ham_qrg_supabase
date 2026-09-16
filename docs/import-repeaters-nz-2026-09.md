# Import ripetitori Nuova Zelanda — 2026-09

Migration: `20260916120000_import_repeaters_nz_arec.sql`

## Contenuto

- **31 repeaters** (19 DMR, 12 analogici) + **31 repeater_access**
- Tutti con `source = 'arec_nz'`
- **10 con coordinate → attivi e visibili in mappa**; 21 senza coordinate,
  importati ma `is_active = false`

## Fonte

Workbook di programmazione del repeater controller **AREC** (New Zealand
Amateur Radio Emergency Communications), mantenuto da ZL1SKL, inviato da
**Nick ZL2NEB** a settembre 2026. Fonte attendibile ma non verificata riga per
riga dal mittente stesso.

## Il file NON è un database di ripetitori

È un **codeplug radio**: la lista dei canali da programmare in un apparato.
Tre conseguenze che determinano tutto il resto della pipeline:

1. **Nessuna coordinata, nessun locator, nessun nominativo.** Solo frequenze,
   toni e label di display (`QTOWN 965`, `KLNDK NS 9875`).
2. **Un ripetitore compare una volta per talkgroup.** Una singola macchina DMR
   occupa fino a 8 righe.
3. **La stessa frequenza è riusata in tutto il paese.** Non identifica un
   ripetitore.

## La frequenza non è una chiave

È il punto critico di questo import. In Nuova Zelanda:

| Frequenza | Siti che la usano |
|---|---|
| 439.700 / 434.700 | Auckland, Kapiti, Christchurch, Dunedin |
| 145.775 | Musick, Abners, Bluff |
| 439.875 | Kaitaia, Raetihi, Whanganui, Gisborne, Belmont, Greymouth, Christchurch, Gore |

**159 righe su 196** stanno su una frequenza condivisa da due o più siti.
Un import basato su `(frequency_hz, shift_hz)` — come quello mondiale, che in
USA/EU funziona — qui avrebbe fuso ripetitori diversi e perso decine di
macchine reali.

La chiave usata è quindi `(output, input, mode, **sito**)`, dove il sito è il
prefisso di nome della label, troncato al primo numero di canale o keyword di
rete:

```
'BLUFF TRBO ZL' -> BLUFF      'AK DMR ZL'     -> AK
'KLNDK NS 9875' -> KLNDK      'POR 900 DMR ZL'-> POR 900   (33 cm ≠ 70 cm)
```

Lo stesso sito è incluso nell'`external_id`, altrimenti i quattro ripetitori
su 439.700 collasserebbero in un unico id.

## Classificazione contro il DB

Una riga è considerata **già presente** solo se frequenza, shift **e** nome
concordano. Il match sul nome espande le abbreviazioni radio (`BRYNDN` →
Brynderwyn, `D-BAY` → Doubtless Bay) tramite tabella esplicita, prefisso o
sottosequenza di lettere con obbligo di iniziali coincidenti.

| Esito | N | Trattamento |
|---|---|---|
| Già presenti | 102 | scartati |
| **Ambigui** | 62 | **non importati**, in attesa di decisione umana |
| Conflitto di shift | 1 | `DNDN 830`: file −4.5 MHz, DB −5.0 MHz |
| **Nuovi** | 31 | importati |

Gli **ambigui** sono righe la cui frequenza è condivisa e il cui nome non è
risolvibile: tipicamente il codeplug nomina la **collina** (`MUSICK`,
`KLONDYKE`) mentre il DB nomina la **città**. Importarli creerebbe duplicati,
scartarli perderebbe ripetitori reali: restano fuori e vanno chiusi con Nick
o con le coordinate.

## Coordinate: 10 recuperate, 21 no

`repeaters.geom` è generata da lat/lon. Senza coordinate `geom` è NULL, quindi
la riga **non compare né in mappa né in `repeaters_nearby`/`in_bounds`**.

Il codeplug non ha coordinate, ma **un sito radio ospita più macchine** e il DB
contiene già 166 ripetitori NZ, di cui 151 località con posizione. Dove il
nome del sito corrisponde a una località già nota, le coordinate sono quelle
(`tool/nz_import/geocode_nz.py`).

L'inferenza è volutamente **strict**, e due vincoli la governano:

1. Si parte dalla località letta dal foglio `ZL-TRBO - Details` del workbook
   stesso — dato reale, non congettura — oppure da una tabella di
   abbreviazioni scritta a mano e verificabile. Match **esatto o per prefisso**
   sul nome normalizzato: niente sottosequenze, niente iniziali.
2. Tutti i riferimenti trovati devono concordare entro **3 km**. «Auckland» in
   DB sono 4 siti sparsi su 57 km e «Oamaru» su 52: casi del genere vengono
   **rifiutati**, non mediati.

Una prima versione riusava il matcher fuzzy di `diff_nz.py` senza il vincolo
di frequenza a restringere i candidati, e produceva errori sicuri di sé:
`POR` (Porirua) → **Poverty Bay**, `TAS` (Tasman) → **Taupo**, `MARL`
(Marlborough) → **Minden**. Sono tutti test di regressione ora.

Risultato: **10 geolocalizzati** (Wellington ×2, Christchurch ×2, Kapiti,
Taupo, Manawatu, Wairarapa, Queenstown, Porirua 33cm) → importati **attivi**.
Gli altri **21 entrano inattivi**: i dati RF sono conservati e pronti, ma
nulla di parziale o inventato raggiunge l'utente.

Per attivare i restanti servono le coordinate da NZART
(<https://nzart.org.nz/info/repeater-maps/> pubblica solo PNG e PDF, quindi va
estratto a mano) o direttamente da Nick.

**Nessuna coordinata è stata inventata o approssimata.**

## Località

Il foglio `ZL-TRBO - Details` associa una località a ogni coppia di frequenze,
ma la stessa coppia serve più siti: un join sulla sola frequenza assegnava
Hamilton a «Marlborough» e Auckland a «Dunedin». La località viene ora
accettata solo quando il nome del sito la conferma in modo univoco → **16 su
31** valorizzate, le altre restano NULL.

## Idempotenza

`on conflict do nothing` su entrambe le tabelle, dedup su
`repeaters_external_id_unique`. `repeaters_frequency_locator_unique` non si
applica: senza locator l'indice parziale non copre queste righe.

`external_id` = `blake2s(namespace | paese | sorgente | out | in | modo | sito)`,
namespace congelato `hamqrg.repeater.v1`.

## Verifica eseguita

Postgres 17.6 + PostGIS 3.5.3 in Docker, tutte le migration del repo applicate
in ordine, PostGIS nello schema `extensions` come in Supabase. Lo schema
ottenuto ha `repeater_access.ctcss_hz` a colonna singola, quindi il test
esercita il **ramo non-splittato** dell'insert adattivo (produzione usa
`ctcss_tx_hz`/`ctcss_rx_hz`).

- 31 repeaters + 31 access inseriti
- run ripetuto → 0 inserimenti, conteggi invariati: **idempotente**
- 17.541 ripetitori preesistenti **intatti**, 166 NZ preesistenti intatti
- 0 access orfani, 0 `external_id` duplicati, 0 tabelle di staging residue
- **10 righe attive, tutte e 10 con `geom` valorizzato**; 0 righe attive prive
  di `geom` (sarebbero invisibili pur risultando attive)
- **RPC verificate sui dati importati**: `repeaters_nearby(-41.2578, 174.7850)`
  restituisce i 3 ponti di Wellington con i rispettivi access;
  `repeaters_in_bounds` sull'intera NZ ne restituisce 10 su 176
- i 4 ripetitori su 439.700 restano **4 record distinti**
- nessuna località assegnata a due ripetitori diversi

`tool/nz_import/test_parse.py` esegue 57 controlli su parser, diff e geocoder,
con test di regressione per i bug trovati in revisione:

1. `Sheet1` scartato per assunzione (conteneva ripetitori reali)
2. località incrociate per join sulla sola frequenza
3. siti distinti fusi dalla chiave di dedup senza sito
4. `GORE` matchato con `Gisborne` per sottosequenza di lettere
5. geocoding fuzzy: `POR`→Poverty Bay, `TAS`→Taupo, `MARL`→Minden
6. `AK` (Auckland) rifiutato perché i riferimenti distano 57 km

## Da chiudere con Nick

1. **Coordinate dei 21 ancora inattivi** (bloccante per la loro attivazione).
2. **`DNDN 830`**: shift −4.5 MHz nel file contro −5.0 MHz in DB; il band plan
   UHF neozelandese usa normalmente −5.0.
3. **62 righe ambigue**: servono le coordinate o una conferma nome per capire
   se sono le macchine già in DB sotto un altro nome.
