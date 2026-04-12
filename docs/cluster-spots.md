# Cluster / Spot — Specifica funzionale

> Specifica **funzionale** della feature. Per i dettagli implementativi (schema DB, RLS, RPC, migrazioni, trigger, codice SQL) vedi [`cluster-spots-technical.md`](./cluster-spots-technical.md).

## Obiettivo

Permettere a un radioamatore di **dichiararsi in ascolto su un ponte radio** per un certo numero di minuti, in modo che gli altri utenti dell'app possano vederlo, raggiungerlo via radio e iniziare un QSO. Lo scopo è incentivare l'attività radioamatoriale sui ripetitori riducendo l'effetto "ponte vuoto".

## Concetto in 5 punti

1. Un utente apre la scheda di un ponte e dichiara: "sono in ascolto qui per N minuti"
2. Lo spot diventa visibile in tempo reale agli altri utenti dell'app, sia nella scheda del ponte che in una sezione "ultimi spot"
3. Gli utenti che hanno quel ponte tra i preferiti ricevono una notifica push
4. Chi vuole può mettersi in ascolto a sua volta o chiamare l'utente via radio sul ponte
5. Allo scadere del tempo dichiarato lo spot non è più "attivo", ma resta visibile come storico

## Decisioni di design

### 1. Durata dello spot

- L'utente deve **obbligatoriamente** specificare una durata al momento della creazione
- **Range consentito**: da 1 a 60 minuti
- L'input è libero (non preset fissi) e si effettua dall'app
- Allo scadere del tempo lo spot diventa "concluso" automaticamente, senza azioni dell'utente

### 2. Un solo spot attivo per utente

- Ogni utente può avere **un solo spot attivo alla volta**, su qualsiasi ponte
- Se crea un nuovo spot mentre ne ha già uno attivo, quello precedente viene **automaticamente sostituito** dal nuovo
- Razionale: semplifica l'UX (un solo "stato attivo" da mostrare), evita spam multi-ponte e spot fantasma su ponti dove l'utente non è più realmente in ascolto

### 3. Chiusura manuale e niente estensione

- L'utente può **chiudere manualmente** in qualsiasi momento il proprio spot prima della scadenza naturale (es. ha spento la radio prima del previsto)
- Non è prevista alcuna funzione di **estensione** della durata: per restare in ascolto più a lungo l'utente crea un nuovo spot, che sostituisce automaticamente il precedente
- Razionale: una sola finestra temporale ben definita per spot, UI più semplice

### 4. Storico permanente, visibile per 24 ore

- Tutti gli spot (attivi, scaduti e chiusi) **restano permanentemente nel sistema** — non vengono mai cancellati automaticamente
- La sezione "ultimi spot" mostra **solo gli spot delle ultime 24 ore**
- Lo storico più vecchio resta disponibile per future analytics (orari di attività, ponti più popolari, statistiche personali) ma non è esposto in app in v1

### 5. Contenuto dello spot

Oltre ai dati identificativi (utente, ponte, orario di inizio, durata), lo spot può **opzionalmente** includere:

- **L'access dichiarato**: su quale modalità del ponte l'utente è in ascolto (es. "DMR TG222" vs "Analog FM" su un ponte misto). L'utente sceglie da una lista degli access disponibili per quel ponte. È facoltativo: se non specificato, lo spot è "generico" sul ponte.

Esplicitamente **NON** inclusi:
- Nessun **messaggio libero** (per evitare spam, contenuti inappropriati, necessità di moderazione)
- Nessuna **posizione GPS** dell'utente (privacy + non necessaria al valore della feature)

### 6. Notifiche push: chi le riceve

- Quando viene creato uno spot, ricevono notifica push **tutti gli utenti che hanno il ponte tra i preferiti**, indipendentemente dalla loro distanza geografica dal ponte
- L'utente che CREA lo spot non riceve la notifica del proprio spot
- Non è previsto in v1 alcun filtro per prossimità geografica: l'aver messo il ponte nei preferiti è considerato segnale di interesse esplicito qualunque sia la motivazione

### 7. Notifiche push: opt-out

L'utente ha **due livelli di controllo** sulle notifiche cluster:

1. **Globale**: nelle impostazioni del profilo c'è un interruttore "Notifiche cluster" che disattiva completamente tutte le notifiche cluster (default: attivo)
2. **Per singolo preferito**: per ogni ponte preferito si può scegliere se ricevere o no notifiche cluster da quel ponte specifico, mantenendolo comunque tra i preferiti (default: attivo)

Una notifica viene inviata solo se entrambi gli interruttori (globale + del preferito specifico) sono attivi.

**Non implementati in v1**:
- Nessun rate limiting (cooldown tra notifiche dallo stesso utente / dallo stesso ponte)
- Nessuna quiet hours (sempre attive 24/7); eventuale gestione lato dispositivo a discrezione dell'utente

### 8. "Contattare direttamente": via radio

- Lo spot espone il **callsign** dell'utente in ascolto, e gli altri OM lo chiamano **via radio sul ponte stesso** (è il flusso radioamatoriale classico, in stile DX cluster)
- L'app NON gestisce chat in-app, messaggistica privata, link a contatti esterni (email, Telegram, QRZ, ...) — è solamente un "tabellone" informativo
- Razionale: lo scopo della feature è incentivare i QSO via radio, non sostituirli con canali di comunicazione alternativi

### 9. Aggiornamenti in tempo reale

- Quando un utente sta guardando la schermata di un ponte o la lista degli ultimi spot, **i nuovi spot devono comparire istantaneamente**, senza che debba ricaricare manualmente
- Anche le chiusure manuali e le sostituzioni di spot sono propagate in tempo reale
- L'utente che ha uno spot attivo riceve immediatamente in app la notifica visiva quando il proprio spot viene sostituito o forzatamente chiuso

### 10. Sezione "ultimi spot"

- È una sezione globale dell'app che mostra **tutti gli spot recenti**, ordinati dal più recente
- Mostra sia gli spot **attivi (in ascolto ora)** che quelli **scaduti recentemente**, distinti visivamente con un badge
- Finestra temporale visibile: ultime **24 ore**
- Niente filtri lato server in v1 (no "solo preferiti", no filtri per modo operativo)
- Niente paginazione: la lista 24h è sufficientemente piccola e gli aggiornamenti arrivano via realtime
- Tap su uno spot → apre la scheda del ponte di destinazione

### 11. Anti-abuso

- **Prerequisito per creare uno spot**: l'utente deve avere il **callsign valorizzato** nel proprio profilo. Senza callsign lo spot non avrebbe valore informativo (gli altri OM non saprebbero chi chiamare via radio). L'utente che tenta di creare uno spot senza callsign riceve un messaggio di errore esplicito.
- **Nessun rate limit** sulla creazione spot in v1: la regola "1 spot attivo per utente" già impedisce l'accumulo
- **Nessun sistema di report o block utenti** in v1: la gestione abusi è demandata agli **admin via dashboard**, che possono **forzare la chiusura di uno spot abusivo** (lo spot resta visibile come storico ma marcato come chiuso, mantenendo la traccia dell'azione di moderazione)

### 12. QSO log

**Fuori scope.** La specifica tratta esclusivamente gli spot. Eventuali sistemi di logging o conferma dei QSO saranno progettati come feature indipendente in futuro, senza vincoli sul design attuale.

## User stories

### Come radioamatore voglio dichiarare la mia presenza su un ponte
> Apro l'app, cerco il ponte X, tocco "Mettiti in ascolto", scelgo 30 minuti e (opzionalmente) il modo operativo. Da quel momento sono visibile come "in ascolto" agli altri utenti.

### Come radioamatore voglio sapere quando qualcuno è attivo sui miei ponti preferiti
> Ricevo una notifica push istantanea quando qualcuno fa uno spot su uno dei ponti che ho nei preferiti, così posso accendere la radio e provare a contattarlo.

### Come radioamatore voglio scoprire dove c'è attività radio
> Apro la sezione "Ultimi spot" e vedo in tempo reale chi è in ascolto, su quale ponte e con quale modalità. Tocco uno spot per aprire la scheda del ponte e accordare la radio.

### Come radioamatore non disturbabile a una certa ora
> Voglio mantenere i miei ponti preferiti ma non ricevere notifiche cluster di notte. Disattivo l'interruttore globale "Notifiche cluster" nelle impostazioni quando non voglio essere disturbato. Oppure, per silenziare solo un ponte particolarmente attivo che non mi interessa più, disattivo l'interruttore per quel singolo preferito.

### Come admin voglio rimuovere uno spot abusivo
> Dalla dashboard vedo gli spot recenti, identifico quello abusivo (callsign falso, condotta scorretta) e lo chiudo forzatamente. Lo spot resta visibile come "chiuso" nello storico ma non è più attivo né visibile in cima alla lista.

## Out of scope (v1)

Le seguenti funzionalità sono **esplicitamente escluse** da questa versione:

- Estensione della durata di uno spot già attivo
- Avere più spot attivi contemporaneamente (multi-ponte)
- Filtro geografico delle notifiche per prossimità al ponte
- Rate limiting / cooldown sulle notifiche
- Quiet hours configurabili lato server
- Chat in-app o messaggistica diretta tra utenti
- Profili pubblici con contatti esterni (email/Telegram/QRZ/...)
- Sistema di logging o conferma QSO
- Sistema di report o block utenti
- Filtro "solo preferiti" e filtro per modo operativo nella sezione ultimi spot
- Pull-to-refresh / paginazione (sostituiti da realtime)
- Cancellazione automatica dello storico spot

## Riferimenti

- Specifica tecnica: [`cluster-spots-technical.md`](./cluster-spots-technical.md)
