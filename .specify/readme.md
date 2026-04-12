# SpecKit

SpecKit è un workflow strutturato per trasformare un'idea di progetto in task implementabili, attraverso una serie di comandi sequenziali.

## Workflow principale

Eseguire i comandi in ordine:

1. **`/speckit-constitution`** — Definisce i principi fondamentali del progetto (architettura, tecnologie, convenzioni).
2. **`/speckit-specify`** — Crea la specifica di base a partire dai requisiti.
 *** `/speckit-clarify` *** | Prima di `/speckit-plan` | Pone domande strutturate per ridurre ambiguità e rischi. |
3. **`/speckit-plan`** — Genera il piano di implementazione con fasi e dipendenze.
 *** `/speckit-checklist` *** | Dopo `/speckit-plan` | Genera checklist di qualità per validare completezza e chiarezza dei requisiti. 
4. **`/speckit-tasks`** — Produce i task operativi pronti per lo sviluppo.
 *** `/speckit-analyze` *** | Dopo `/speckit-tasks`, prima di `/speckit-implement` | Verifica consistenza e allineamento tra tutti gli artifact generati. 
5. **`/speckit-implement`** — Esegue l'implementazione dei task generati.

## Comandi opzionali

| Comando | Quando usarlo | Descrizione |
|---|---|---|
| |
| |
