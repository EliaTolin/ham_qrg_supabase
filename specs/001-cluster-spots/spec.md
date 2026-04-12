# Feature Specification: Cluster Spots — "In ascolto" su un ponte radio

**Feature Branch**: `001-cluster-spots`
**Created**: 2026-04-10
**Status**: Draft
**Input**: Specifica funzionale completa fornita dall'utente in `docs/cluster-spots.md`. La feature permette ai radioamatori di dichiararsi "in ascolto" su un ponte radio per un numero di minuti definito, rendendo lo spot visibile in tempo reale agli altri utenti e notificando chi ha quel ponte tra i preferiti, allo scopo di stimolare attività sui ripetitori riducendo l'effetto "ponte vuoto".

## Clarifications

### Session 2026-04-10

- Q: Quando un utente cancella il proprio account, cosa succede ai suoi spot storici? → A: Cascade hard delete — alla cancellazione account vengono fisicamente eliminati tutti gli spot dell'utente (attivi e storici), senza anonimizzazione né conservazione per analytics.
- Q: Quale livello di validazione applichiamo al callsign in fase di creazione spot? → A: Solo non-vuoto (trim non-empty). La feature spot non esegue alcuna validazione strutturale del formato callsign; questa responsabilità resta del sottosistema profilo utente.
- Q: In v1 esiste una vista personale "I miei spot" dove l'autore può vedere i propri spot, e con quale finestra temporale? → A: Nessuna vista dedicata in v1. L'autore vede il proprio spot attivo solo nelle stesse viste pubbliche degli altri (scheda ponte + sezione "Ultimi spot" 24h). Nessuna schermata personale, nessun storico personale esposto in app.
- Q: Cosa accade agli spot attivi quando il ponte di destinazione viene disattivato o eliminato dal catalogo? → A: Lo spot resta attivo fino a scadenza naturale. Il sistema non interviene automaticamente: lo spot continua il proprio ciclo di vita normale (timer, eventuale chiusura manuale dell'autore). Nessun nuovo stato "ponte rimosso", nessuna disattivazione bloccata.
- Q: La chiusura forzata di uno spot da parte di un admin è in scope per v1? → A: No, fuori scope per v1. La feature di moderazione/chiusura forzata da admin viene rimossa interamente dalla v1: nessuno stato "chiuso da admin", nessuna RPC/dashboard di moderazione, nessuna notifica realtime di moderazione all'autore. Eventuali abusi nella v1 saranno gestiti out-of-band (fuori app). La feature rientra in scope in una iterazione successiva.

### Session 2026-04-11

- Q: Un utente può spottare un altro OM (stile DX cluster)? → A: Sì. Esistono due tipi di spot: **self-spot** ("sono in ascolto", con durata obbligatoria 1–600 min) e **other-spot** ("ho sentito il callsign X su questo ponte", senza durata). L'other-spot non ha stato attivo/scaduto — è solo un record storico visibile nella sezione "Ultimi spot" ma MAI nella lista "in ascolto ora" di un ponte. Il vincolo "1 attivo per utente" si applica solo ai self-spot. Le notifiche push ai favoriti scattano per entrambi i tipi.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Dichiararsi "in ascolto" su un ponte (Priority: P1)

Un radioamatore con callsign valorizzato apre la scheda di un ponte, tocca "Mettiti in ascolto", inserisce una durata in minuti (1–60) e opzionalmente seleziona uno degli access disponibili per quel ponte (es. DMR TG222, Analog FM). Da quel momento risulta "in ascolto" su quel ponte. Se aveva già uno spot attivo altrove, quello viene automaticamente sostituito dal nuovo. Può chiudere manualmente lo spot in qualsiasi momento. Allo scadere della durata lo spot diventa automaticamente "concluso".

**Why this priority**: È il cuore della feature — senza la creazione e il ciclo di vita di uno spot, nessun'altra funzionalità ha senso. Da sola fornisce già valore in scenari di test/dimostrazione: un singolo utente può vedere il proprio stato cambiare e pianificare la transizione di stato senza dipendere da alcun altro componente.

**Independent Test**: Un utente con callsign valorizzato crea uno spot di 10 minuti su un ponte qualsiasi, osserva il proprio stato "attivo", lo chiude manualmente prima della scadenza e verifica che diventi "chiuso". Crea un secondo spot da 5 minuti su un altro ponte e verifica che il proprio spot precedente (se ancora attivo) venga sostituito. Lascia scadere uno spot e verifica la transizione automatica a "concluso".

**Acceptance Scenarios**:

1. **Given** un utente autenticato con callsign valorizzato e nessuno spot attivo, **When** crea uno spot su un ponte indicando una durata di 30 minuti, **Then** lo spot risulta attivo, associato a quell'utente e a quel ponte, con orario di inizio = ora corrente e scadenza = ora corrente + 30 minuti.
2. **Given** un utente autenticato senza callsign nel proprio profilo, **When** tenta di creare uno spot, **Then** la creazione viene rifiutata con un messaggio di errore esplicito che invita a valorizzare il callsign.
3. **Given** un utente che indica una durata fuori dal range 1–600 minuti (es. 0 o 700), **When** invia la richiesta di creazione, **Then** la creazione viene rifiutata con un messaggio che indica i limiti consentiti.
4. **Given** un utente con uno spot attivo sul ponte A, **When** crea un nuovo spot sul ponte B, **Then** lo spot sul ponte A diventa automaticamente "sostituito" (non più attivo) e lo spot sul ponte B diventa l'unico spot attivo dell'utente.
5. **Given** un utente con uno spot attivo, **When** richiede la chiusura manuale del proprio spot, **Then** lo spot diventa "chiuso" e non risulta più attivo, mantenendo traccia dell'orario di chiusura.
6. **Given** uno spot attivo la cui durata sta per scadere, **When** trascorre l'orario di scadenza, **Then** lo spot diventa "scaduto" automaticamente senza richiedere alcuna azione da parte dell'utente, entro al massimo 60 secondi dall'orario teorico di scadenza.
7. **Given** un utente, **When** seleziona opzionalmente un access dichiarato durante la creazione dello spot, **Then** l'access deve appartenere alla lista degli access configurati per quel ponte; access non valido ⇒ creazione rifiutata.
8. **Given** un utente, **When** crea uno spot senza specificare l'access, **Then** lo spot viene creato come "generico" sul ponte e risulta visibile come tale.

---

### User Story 1b - Spottare un altro OM su un ponte (Priority: P1)

Un radioamatore con callsign valorizzato apre la scheda di un ponte e segnala "Ho sentito IZ0XYZ su questo ponte", specificando il callsign dell'OM sentito e opzionalmente l'access. Non indica alcuna durata. Lo spot compare nella sezione "Ultimi spot" (24h) ma NON nella lista "in ascolto ora" della scheda ponte (perché non è l'OM segnalato a dichiararsi in ascolto — è una segnalazione di terzi). Il vincolo "1 spot attivo per utente" NON si applica agli other-spot: un utente può segnalare più OM diversi senza che questo chiuda il suo eventuale self-spot attivo. Le notifiche push ai favoriti scattano normalmente.

**Why this priority**: Estende il modello DX cluster classico — senza la possibilità di spottare altri OM, la feature copre solo l'auto-dichiarazione, che è un sottoinsieme del valore informativo. Va in P1 perché è lo stesso endpoint (`create-spot`) con un parametro in più, nessuna nuova infrastruttura.

**Independent Test**: Un utente con callsign crea un other-spot (con `spotted_callsign`) su un ponte → il record esiste con `duration_minutes = NULL`, `expires_at = NULL`, `spotted_callsign = 'IZ0XYZ'`. Creando un self-spot successivo, l'other-spot NON viene chiuso. L'other-spot compare in "Ultimi spot" ma NON nella lista "in ascolto ora".

**Acceptance Scenarios**:

1. **Given** un utente autenticato con callsign, **When** crea uno spot con `spotted_callsign = 'IZ0XYZ'` su un ponte, **Then** lo spot viene creato con `duration_minutes = NULL`, `expires_at = NULL`, `spotted_callsign = 'IZ0XYZ'`, `callsign_snapshot` = callsign del creatore (chi segnala).
2. **Given** un utente che specifica `spotted_callsign` E `duration_minutes`, **When** invia la richiesta, **Then** la creazione viene rifiutata con errore (un other-spot non può avere durata).
3. **Given** un utente con un self-spot attivo sul ponte A, **When** crea un other-spot sul ponte B, **Then** il self-spot sul ponte A resta attivo (non viene sostituito).
4. **Given** un utente, **When** crea 3 other-spot diversi su 3 ponti diversi, **Then** tutti e 3 esistono contemporaneamente (nessun vincolo di unicità per gli other-spot).
5. **Given** un other-spot, **When** un utente visualizza la lista "in ascolto ora" del ponte, **Then** l'other-spot NON compare (compare solo nella sezione "Ultimi spot" 24h).
6. **Given** un other-spot, **When** un utente che ha il ponte tra i preferiti con notifiche attive, **Then** riceve la notifica push come per un self-spot.

---

### User Story 2 - Vedere chi è in ascolto su un ponte (Priority: P1)

Un radioamatore apre la scheda di un ponte e vede in tempo reale l'elenco degli utenti che si sono dichiarati in ascolto su quel ponte. Per ciascuno spot vede callsign, eventuale access dichiarato, orario di inizio e tempo residuo. La lista si aggiorna istantaneamente al cambiare degli spot attivi sul ponte (creazione, chiusura, scadenza, sostituzione) senza necessità di refresh manuale.

**Why this priority**: È indispensabile insieme a User Story 1 perché lo spot abbia valore: senza un consumatore della informazione, non c'è effetto "anti ponte vuoto". Insieme a US1 forma l'MVP utile (creo uno spot ↔ qualcuno lo vede). Va in P1 perché è l'altra metà del "patto" della feature.

**Independent Test**: Due utenti A e B osservano la scheda dello stesso ponte; A crea uno spot e B lo vede comparire entro pochi secondi senza ricaricare; A lo chiude manualmente e B vede sparire la marcatura "attivo" entro pochi secondi.

**Acceptance Scenarios**:

1. **Given** un utente sta visualizzando la scheda di un ponte, **When** un altro utente crea uno spot attivo su quel ponte, **Then** il nuovo spot appare nell'elenco "in ascolto ora" del primo utente in tempo reale (entro pochi secondi) senza alcun refresh manuale.
2. **Given** uno spot attivo è elencato su una scheda ponte, **When** lo spot viene chiuso (manualmente, sostituzione o scadenza), **Then** scompare dalla sezione "in ascolto ora" della scheda ponte in tempo reale.
3. **Given** uno spot ha un access dichiarato, **When** viene visualizzato sulla scheda ponte, **Then** mostra in chiaro l'access dichiarato; **otherwise** lo mostra come "generico".
4. **Given** un ponte ha 0 spot attivi, **When** un utente apre la scheda, **Then** è chiaramente visibile lo stato "nessuno in ascolto al momento" (assenza esplicita, non sezione vuota silenziosa).

---

### User Story 3 - Sezione globale "Ultimi spot" (Priority: P2)

Un radioamatore apre una sezione globale dell'app chiamata "Ultimi spot" e vede in tempo reale tutti gli spot delle ultime 24 ore, ordinati dal più recente, indipendentemente dal ponte. Gli spot attivi e quelli scaduti recentemente sono distinti visivamente con un badge. Toccando uno spot si apre la scheda del ponte di destinazione.

**Why this priority**: Estende il valore della feature dall'attuale "guardo se c'è qualcuno sul mio ponte" a "scopro dove c'è attività in giro". È una porta d'ingresso primaria per nuovi QSO, ma è strettamente subordinata alle US1 e US2: senza di loro non avrebbe contenuto.

**Independent Test**: Generare alcuni spot su ponti diversi negli ultimi 30 minuti e verificare che compaiano tutti nella sezione "Ultimi spot", ordinati dal più recente, con il badge corretto (attivo vs concluso); creare un nuovo spot e verificarne la comparsa in cima senza refresh manuale; cambiare lo stato di uno spot esistente (chiusura/scadenza) e verificare l'aggiornamento del badge in tempo reale.

**Acceptance Scenarios**:

1. **Given** esistono spot creati nelle ultime 24 ore, **When** un utente apre la sezione "Ultimi spot", **Then** vede tutti gli spot delle ultime 24 ore (sia attivi sia conclusi) ordinati dal più recente al più vecchio.
2. **Given** uno spot è stato creato 25 ore fa, **When** un utente apre la sezione "Ultimi spot", **Then** quello spot non viene mostrato (resta nello storico permanente ma fuori dalla finestra visibile).
3. **Given** un utente sta visualizzando "Ultimi spot", **When** un altro utente crea uno spot, **Then** il nuovo spot compare in cima alla lista in tempo reale, senza refresh.
4. **Given** la lista mostra sia spot attivi sia conclusi, **When** un utente la visualizza, **Then** ogni spot ha un badge che ne distingue chiaramente lo stato (es. "in ascolto ora" vs "concluso").
5. **Given** un utente tocca uno spot in lista, **When** segue il tap, **Then** viene portato alla scheda del ponte cui lo spot si riferisce.

---

### User Story 4 - Notifiche push ai preferiti con opt-out (Priority: P2)

Un radioamatore mette nei preferiti i ponti che gli interessano. Quando un altro utente crea uno spot su uno di quei ponti, l'utente riceve una notifica push istantanea. L'utente può silenziare globalmente le notifiche cluster da impostazioni profilo, oppure silenziarle solo per un singolo preferito mantenendolo nei preferiti. Una notifica viene inviata solo se entrambi i flag (globale + per-preferito) sono attivi. L'autore dello spot non riceve notifica del proprio spot.

**Why this priority**: È il moltiplicatore principale di valore: trasforma un comportamento "pull" (apro l'app per vedere se c'è qualcuno) in uno "push" (la radio si accende perché qualcun altro è sul mio ponte). Da sola però non basta — richiede US1 esistente. Quindi P2.

**Independent Test**: L'utente A mette nei preferiti il ponte X, l'utente B crea uno spot sul ponte X, l'utente A riceve la notifica push entro pochi secondi. L'utente A disattiva il flag globale "Notifiche cluster": un nuovo spot di B su X non genera notifica. L'utente A riattiva il globale ma disattiva il flag per il singolo preferito X: nessuna notifica. Riattivando entrambi i flag, le notifiche tornano. L'utente B (autore) non riceve notifica del proprio spot anche se ha X tra i preferiti.

**Acceptance Scenarios**:

1. **Given** un utente A ha il ponte X tra i preferiti con notifiche cluster attive sia globalmente sia per il singolo preferito, **When** un utente B crea uno spot su X, **Then** A riceve una notifica push contenente almeno: callsign di B, identificativo del ponte X, durata dichiarata.
2. **Given** un utente A ha il flag globale "Notifiche cluster" disattivato, **When** un utente B crea uno spot su un ponte tra i preferiti di A, **Then** A non riceve alcuna notifica.
3. **Given** un utente A ha il flag globale attivo ma il flag "notifiche cluster" disattivato per quel singolo preferito, **When** un utente B crea uno spot su quel ponte, **Then** A non riceve notifica.
4. **Given** l'utente B crea uno spot su un ponte che ha lui stesso tra i preferiti, **When** lo spot viene creato, **Then** B non riceve alcuna notifica del proprio spot.
5. **Given** un nuovo preferito viene aggiunto da un utente, **When** il preferito viene salvato, **Then** il flag "notifiche cluster" per quel preferito è attivo per default.
6. **Given** un nuovo profilo utente, **When** viene creato, **Then** il flag globale "Notifiche cluster" è attivo per default.
7. **Given** uno spot viene aggiornato (chiusura manuale, scadenza, sostituzione automatica), **When** il cambio di stato avviene, **Then** non viene inviata alcuna notifica push aggiuntiva (le notifiche sono solo sulla creazione).

---

### Edge Cases

- **Callsign rimosso dopo creazione**: l'utente crea uno spot, poi azzera il proprio callsign nel profilo. Lo spot già attivo continua il suo ciclo di vita normalmente fino a scadenza/chiusura; un eventuale nuovo spot sarebbe rifiutato.
- **Ponte disattivato/eliminato**: un utente con uno spot attivo su un ponte che viene successivamente disattivato/eliminato dal catalogo conserva lo spot **attivo fino a scadenza naturale o chiusura manuale**. Il sistema NON esegue alcuna auto-chiusura, NON introduce stati intermedi tipo "ponte rimosso", e NON impedisce alla disattivazione del ponte di avvenire mentre esistono spot attivi su di esso. L'utente può comunque chiudere manualmente il proprio spot in qualsiasi momento. Le viste devono gestire elegantemente la presenza di uno spot riferito a un ponte non più attivo (es. mostrare il record con un indicatore visivo "ponte non più disponibile" e disabilitare l'azione "apri scheda ponte").
- **Access rimosso dal ponte dopo creazione spot**: se l'access dichiarato viene eliminato dal catalogo, il riferimento nello spot diventa nullo e lo spot viene trattato come "generico" sul ponte (coerente con la FK `ON DELETE SET NULL` nel data model). Lo storico perde il dettaglio dell'access specifico; la UI deve gestire `access_id = null` mostrando "(modalità non più disponibile)" o equivalente.
- **Doppia creazione concorrente**: l'utente invia due richieste di creazione spot in parallelo (es. doppio tap, race condition). Il sistema deve garantire che alla fine resti un solo spot attivo per utente, in modo deterministico.
- **Orologio del client errato**: il sistema considera autorevole il proprio orologio per inizio e scadenza, non quello del client.
- **Connessione persa durante la creazione**: lo spot deve essere creato in modo atomico — o esiste e sostituisce il precedente, o non esiste; non si può finire con due spot attivi né con il precedente perso senza il nuovo.
- **Stato in transizione "scaduto"**: tra l'orario teorico di scadenza e l'effettivo cambio di stato lato server, lo spot deve comunque essere considerato non più attivo dalle viste consumate.
- **Spot creato a 1 minuto dalla mezzanotte**: la finestra "ultime 24 ore" è scorrevole rispetto all'ora corrente, non al giorno solare.
- **Notifiche push a un dispositivo non più registrato**: l'errore di consegna a un singolo dispositivo non deve interrompere l'invio agli altri destinatari.
- **Volume notifiche su ponte molto popolare**: nessun rate limiting in v1 per design — il sistema deve essere in grado di servire l'intero fan-out anche se un ponte ha centinaia di preferiti, ma se la consegna è asincrona ciò è accettabile.
- **Utente con preferiti ma senza dispositivi/token push registrati**: nessuna notifica viene tentata; non genera errori.
- **Cancellazione account di un utente con spot attivo**: alla richiesta di cancellazione account, l'eventuale spot ancora attivo dell'utente viene rimosso fisicamente insieme allo storico; eventuali viste realtime ("scheda ponte", "Ultimi spot") aperte da altri utenti devono propagare la sparizione dello spot in tempo reale come per una chiusura ordinaria.

## Requirements *(mandatory)*

### Functional Requirements

#### Lifecycle dello spot

- **FR-001**: Il sistema DEVE permettere a un utente autenticato di creare uno spot su un ponte radio. Lo spot può essere di due tipi: **self-spot** ("sono in ascolto", con durata obbligatoria) oppure **other-spot** ("ho sentito il callsign X", senza durata, specificando `spotted_callsign`).
- **FR-002**: Per i **self-spot**, il sistema DEVE accettare solo durate intere comprese tra 1 e 600 minuti (estremi inclusi); qualsiasi altro valore deve essere rifiutato. Per gli **other-spot**, la durata DEVE essere assente (null); se fornita, la creazione è rifiutata.
- **FR-002a**: Gli other-spot NON hanno stato attivo/scaduto: sono record storici puri, visibili nella sezione "Ultimi spot" (24h) ma MAI nella lista "in ascolto ora" di un ponte.
- **FR-003**: Il sistema DEVE permettere all'utente di indicare opzionalmente, in fase di creazione, uno degli access configurati per il ponte di destinazione; se omesso lo spot è "generico".
- **FR-004**: Il sistema DEVE rifiutare la creazione dello spot se l'utente non ha un callsign valorizzato nel proprio profilo, restituendo un messaggio di errore esplicito. "Valorizzato" significa **stringa non vuota dopo trim degli spazi**: la feature spot NON esegue alcuna validazione strutturale del formato callsign (no regex ITU, no whitelist prefissi, no lookup esterni). Eventuale validazione strutturale è responsabilità del sottosistema profilo utente.
- **FR-005**: Il sistema DEVE rifiutare la creazione dello spot se l'access dichiarato non appartiene alla configurazione corrente del ponte indicato.
- **FR-006**: Ogni utente PUÒ avere al massimo **un solo self-spot attivo** in qualsiasi momento, su qualsiasi ponte. Gli other-spot non sono soggetti a questo vincolo: un utente può creare un numero illimitato di other-spot senza influenzare il proprio self-spot attivo.
- **FR-007**: Quando un utente crea un nuovo **self-spot** mentre ne ha già uno attivo, il sistema DEVE chiudere automaticamente il self-spot precedente come "sostituito" e attivare quello nuovo, in modo atomico. La creazione di un other-spot NON chiude il self-spot attivo.
- **FR-008**: Il sistema DEVE permettere all'utente di chiudere manualmente in qualsiasi momento il proprio spot attivo; lo spot diventa "chiuso dall'utente" e non più attivo.
- **FR-009**: Il sistema NON DEVE offrire alcuna funzione di estensione/rinnovo della durata di uno spot esistente: per restare in ascolto più a lungo l'utente deve crearne uno nuovo (che sostituirà il precedente).
- **FR-010**: Allo scadere dell'orario di scadenza teorico (`expires_at`), lo spot DEVE risultare non più "attivo" in qualsiasi vista o query consumata dai client, senza richiedere alcuna azione dell'utente né alcuna scrittura periodica nel database. Lo stato "scaduto" è derivato dal confronto `expires_at <= now()` al momento della lettura (vedi [research.md §1](specs/001-cluster-spots/research.md) — stato derivato, non persistito).
- **FR-011**: Il sistema DEVE conservare permanentemente tutti gli spot (attivi, scaduti, chiusi manualmente, sostituiti) senza cancellazione automatica basata sul tempo.
- **FR-011a**: Quando un utente cancella il proprio account, il sistema DEVE eliminare fisicamente in cascata tutti gli spot creati da quell'utente (sia attivi sia storici), senza anonimizzazione né conservazione a fini di analytics. L'eliminazione deve essere atomica rispetto alla cancellazione dell'account.
- **FR-012**: Il sistema DEVE registrare per ciascuno spot almeno: utente autore, ponte di destinazione, **snapshot del callsign al momento della creazione** (valore immutabile, preservato anche se l'utente modifica successivamente il proprio callsign nel profilo), eventuale access dichiarato, orario di inizio, durata dichiarata (null per other-spot), orario di scadenza teorico (null per other-spot), orario di chiusura effettivo (quando applicabile), **callsign dell'OM spottato** (null per self-spot). Lo stato corrente (attivo / scaduto / chiuso) è derivabile dai campi persistiti e non richiede una colonna dedicata; gli other-spot non hanno stato attivo/scaduto.

#### Visualizzazione

- **FR-013**: Il sistema DEVE esporre, per ogni ponte, l'elenco corrente degli spot **attivi** su quel ponte, includendo callsign, eventuale access dichiarato, orario di inizio e durata residua.
- **FR-014**: Il sistema DEVE esporre una vista globale "Ultimi spot" che mostri tutti gli spot delle ultime 24 ore (sia attivi sia non attivi), ordinati dal più recente.
- **FR-015**: La vista "Ultimi spot" DEVE distinguere visivamente tra spot attivi e spot non più attivi (badge o equivalente).
- **FR-016**: La vista "Ultimi spot" e la lista "in ascolto su un ponte" NON espongono filtri lato server in v1 (no filtro "solo preferiti", no filtro per modo operativo).
- **FR-017**: La vista "Ultimi spot" NON espone paginazione lato server in v1.
- **FR-017a**: In v1 NON esiste alcuna vista personale "I miei spot". L'autore vede il proprio spot attivo esclusivamente nelle stesse viste pubbliche degli altri utenti (scheda ponte e sezione "Ultimi spot" 24h); nessuno storico personale dell'autore è esposto in app, anche per spot creati dall'autore stesso oltre la finestra di 24h.
- **FR-018**: Il sistema DEVE propagare in tempo reale (≤5 s nel 95° percentile, vedi SC-002) le seguenti modifiche ai client che stanno guardando una scheda ponte o la sezione "Ultimi spot": creazione spot, chiusura manuale, sostituzione automatica. La transizione a "scaduto" (scadenza naturale) NON genera un evento realtime dal server: è calcolata lato client da `expires_at` (vedi FR-010).
- **FR-019**: Il sistema DEVE propagare in tempo reale (≤5 s nel 95° percentile, vedi SC-009) al solo utente autore l'evento "il tuo spot non è più attivo" in caso di sostituzione automatica. La scadenza naturale NON genera un evento realtime: il client dell'autore ricalcola localmente lo stato da `expires_at`.
- **FR-020**: Il sistema NON DEVE esporre messaggi liberi associati allo spot.
- **FR-021**: Il sistema NON DEVE esporre alcuna posizione GPS dell'utente associata allo spot.

#### Notifiche push

- **FR-022**: Alla creazione di uno spot, il sistema DEVE inviare una notifica push a tutti gli utenti che hanno il ponte di destinazione tra i preferiti e per i quali entrambi i flag "notifiche cluster" (globale del profilo e specifico del singolo preferito) sono attivi.
- **FR-023**: L'autore dello spot NON DEVE ricevere notifica del proprio spot, anche se ha quel ponte tra i preferiti.
- **FR-024**: Il sistema DEVE supportare a livello di profilo utente un flag globale "Notifiche cluster" attivo per default.
- **FR-025**: Il sistema DEVE supportare per ciascun preferito-ponte di ciascun utente un flag "notifiche cluster per questo preferito" attivo per default.
- **FR-026**: Il sistema NON DEVE inviare notifiche push in occasione di chiusura manuale, scadenza o sostituzione automatica di uno spot — solo alla creazione.
- **FR-027**: Il sistema NON DEVE applicare alcun rate limiting / cooldown sulle notifiche push da spot in v1.
- **FR-028**: Il sistema NON DEVE applicare quiet hours lato server in v1.
- **FR-029**: Il sistema NON DEVE applicare alcun filtro di prossimità geografica nella selezione dei destinatari delle notifiche.
- **FR-030**: Il fallimento della consegna di una notifica a un singolo dispositivo o utente NON DEVE impedire la consegna agli altri destinatari della stessa notifica.

> **Nota**: FR-031..FR-035 rimossi intenzionalmente dalla sessione di clarification 2026-04-10 Q5 (moderazione admin fuori scope v1).

#### Anti-abuso (v1)

- **FR-036**: Il sistema NON DEVE applicare alcun rate limit specifico sulla frequenza di creazione di nuovi spot da parte di un singolo utente in v1; il limite "1 attivo per utente" è considerato sufficiente.
- **FR-037**: Il sistema NON DEVE offrire alcun meccanismo di report o block utente lato cliente in v1, NÉ alcuna funzione di chiusura forzata di spot da parte di amministratori. Eventuali abusi nella v1 sono gestiti out-of-band (fuori app).

#### Sicurezza e privacy

- **FR-038**: Solo utenti autenticati possono creare, chiudere o consultare gli spot.
- **FR-039**: Solo l'autore di uno spot può chiuderlo manualmente; nessun altro utente può modificarne lo stato.
- **FR-040**: I flag personali di notifica (globale e per-preferito) sono visibili e modificabili solo dall'utente stesso.
- **FR-041**: Lo spot non DEVE memorizzare né esporre alcuna informazione di posizione, contatto esterno o identità oltre a callsign e identificativo utente.

### Key Entities *(include if feature involves data)*

- **Spot**: rappresenta una segnalazione radio su un ponte. Può essere di due tipi: **self-spot** ("sono in ascolto", con durata) o **other-spot** ("ho sentito X", senza durata). Attributi chiave concettuali: utente autore, ponte di destinazione, **snapshot immutabile del callsign del creatore**, callsign dell'OM spottato (null per self-spot), access dichiarato (opzionale), orario di inizio, durata in minuti (null per other-spot), orario di scadenza teorico (null per other-spot), stato derivabile (attivo / scaduto / chiuso / sostituito — solo per self-spot; gli other-spot sono sempre storico), orario di chiusura effettivo (se applicabile). Vincolo logico: al massimo un solo **self-spot** in stato "attivo" per utente.
- **Profilo utente**: estende le informazioni utente esistenti con almeno: callsign (prerequisito per creare spot, riusato dalla feature esistente) e flag globale "Notifiche cluster" (default attivo).
- **Preferito (favorite)**: rappresenta l'associazione esistente utente↔ponte estesa con un flag "notifiche cluster per questo preferito" (default attivo).
- **Notifica cluster**: evento di notifica push generato dalla creazione di uno spot, destinato a una specifica intersezione di "ha il ponte tra i preferiti" + "entrambi i flag attivi" + "non è l'autore".
- **Access del ponte**: configurazione pre-esistente delle modalità di accesso per ciascun ponte (DMR talkgroup, frequenza analogica, ecc.); lo spot può fare riferimento opzionale a uno di questi.
- **Ponte radio (repeater)**: entità pre-esistente. Lo spot vi fa riferimento.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un radioamatore con callsign valorizzato può completare la dichiarazione "sono in ascolto su questo ponte per N minuti" in **non più di 10 secondi** dall'apertura della scheda del ponte (3 tap massimo: bottone, durata, conferma).
- **SC-002**: Un nuovo spot creato da un utente compare nella scheda del ponte e nella sezione "Ultimi spot" di tutti gli altri utenti che le stanno guardando in **meno di 5 secondi** in almeno il 95% di 20 misurazioni consecutive in ambiente locale/staging.
- **SC-003**: Una notifica push generata da un nuovo spot raggiunge il provider push (accodata a OneSignal) in **meno di 30 secondi** in almeno il 95% di 20 misurazioni consecutive in ambiente staging (non verificabile in locale senza credenziali OneSignal valide — in locale verificato fino all'INSERT in `user_notifications` + `pg_net` call).
- **SC-004**: Allo scadere dell'orario teorico di scadenza, lo spot risulta non più "attivo" in ogni query consumata dai client con **latenza intrinseca pari a zero** (stato derivato, non persistito; nessun job periodico).
- **SC-005**: Il **100%** degli utenti senza callsign che tentano di creare uno spot ricevono un messaggio di errore esplicito che indica come risolvere (valorizzare il callsign nel profilo).
- **SC-006**: Il **100%** dei tentativi di creazione di un secondo spot mentre uno è già attivo risulta in: lo spot precedente non è più attivo, lo spot nuovo è l'unico attivo (atomicità garantita; nessun caso di "due spot attivi" osservabile da alcun client).
- **SC-007**: Il numero di notifiche push erroneamente inviate a utenti con flag globale o per-preferito disattivato è **0** nelle verifiche end-to-end.
- **SC-008**: Il numero di notifiche push inviate all'autore stesso del proprio spot è **0** nelle verifiche end-to-end.
- **SC-009**: Una sostituzione automatica di spot dovuta alla creazione di un nuovo spot da parte dello stesso utente è propagata ai client connessi che stanno visualizzando il ponte o "Ultimi spot" in **meno di 5 secondi** in almeno il 95% di 20 misurazioni consecutive, e l'autore vede in app che lo spot precedente non è più attivo nello stesso intervallo di tempo.
- **SC-010**: Tutti gli spot delle ultime 24 ore sono visibili nella sezione "Ultimi spot" senza che il client necessiti di refresh manuale; gli spot più vecchi di 24 ore non sono presenti nella stessa vista ma restano consultabili in eventuali viste storiche/analytics future.
- **SC-011**: La feature regge un evento di "ponte popolare con 500 preferiti": creazione di uno spot non degrada la latenza percepita di creazione (l'autore vede il proprio spot attivo in **meno di 2 secondi**) anche quando il fan-out di notifiche è elevato.
- **SC-012**: **0 messaggi liberi** e **0 dati di posizione** sono memorizzati associati agli spot, verificabile per ispezione dei dati persistiti.

## Out of Scope (v1)

Le seguenti funzionalità sono **esplicitamente escluse** da questa versione e non sono coperte da nessun requisito sopra:

- Estensione della durata di uno spot già attivo.
- Avere più spot attivi contemporaneamente (multi-ponte) per lo stesso utente.
- Filtro geografico delle notifiche per prossimità al ponte.
- Rate limiting / cooldown sulle notifiche o sulla creazione spot.
- Quiet hours configurabili lato server.
- Chat in-app o messaggistica diretta tra utenti.
- Profili pubblici con contatti esterni (email/Telegram/QRZ/...).
- Sistema di logging o conferma QSO.
- Sistema di report o block utenti lato client.
- Funzione di chiusura forzata di spot da parte di amministratori (tutta la moderazione cluster è fuori scope v1; eventuali abusi gestiti out-of-band).
- Filtro "solo preferiti" e filtro per modo operativo nella sezione "Ultimi spot".
- Pull-to-refresh / paginazione (sostituiti da realtime).
- Cancellazione automatica dello storico spot.
- Esposizione in app dello storico oltre le 24 ore (riservato a future viste analytics).
- Vista personale "I miei spot" / dashboard storico per l'autore (riservata a iterazione futura, eventualmente assieme al QSO log).

## Assumptions

- L'autenticazione degli utenti, il modello di profilo utente e il campo callsign **esistono già** nel sistema e vengono riusati così come sono — questa feature aggiunge il flag globale "Notifiche cluster" al profilo.
- Le entità "ponti radio", "access del ponte" e "preferiti" **esistono già** e vengono riusate; questa feature estende i preferiti con il flag per-preferito "notifiche cluster".
- Esiste già un meccanismo di consegna di notifiche push agli utenti (registrazione device token, dispatcher) **riutilizzabile** da questa feature; il fan-out a tutti i destinatari può essere gestito in modo asincrono.
- Esiste già un meccanismo realtime per la propagazione di eventi ai client (riutilizzabile per scheda ponte e "Ultimi spot").
- L'app cliente è autorevole sulla UX di selezione durata e access; la specifica si concentra sui contratti di backend (validazione, persistenza, fan-out, propagazione).
- "Ultime 24 ore" è una finestra scorrevole rispetto all'ora corrente del server, non al giorno solare.
- La feature non introduce alcun nuovo ruolo né riusa il ruolo "admin": in v1 nessuna funzione di moderazione cluster è esposta in app o backend.
- "In tempo reale" significa "entro pochi secondi nella maggioranza dei casi", non "consegna sincrona garantita istantanea": è accettabile un piccolo ritardo dovuto al canale realtime e alla coda push.
- L'autorevolezza degli orari è del server: il client non può imporre orari di inizio o scadenza differenti.
- Nessuna integrazione con sistemi terzi (DX cluster esterni, QRZ, ecc.) è prevista in v1.
- Il sistema esistente fornisce gli identificativi univoci necessari per ponte, utente e access; la spec riusa quegli identificativi.
- La ricezione di una notifica push a livello di sistema operativo (notifica visiva sul dispositivo) dipende dai permessi di sistema: la spec considera "consegnata" una notifica una volta correttamente accodata al provider push, non l'effettiva visualizzazione sullo schermo.
