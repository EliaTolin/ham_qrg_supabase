-- =========================================================
-- Fix: il sync iz8wnh sovrascrive le correzioni manuali e
--      rigenera gli stessi conflitti ogni notte.
--
-- PROBLEMA OSSERVATO (01/10/2026)
--   sync_pending_changes: 1000 righe ma solo 191 external_id
--   distinti. Lo stesso conflitto si reinserisce ogni giorno con
--   diff identico (es. ext=59612: 11 giorni consecutivi, sempre
--   access.node_id local 652630 vs remote 529428).
--   Nessuna riga resta 'pending': 794 approved, 206 rejected,
--   e suggested_winner e' 'remote' 1000 volte su 1000.
--
-- CAUSA
--   L'indice di unicita' copriva solo le righe pending:
--     ON (external_id) WHERE status = 'pending'
--   Con auto_apply=true la riga passa subito ad 'approved',
--   esce dal predicato dell'indice e domani lo stesso conflitto
--   si reinserisce senza violare nulla. Il ramo di gestione
--   dell'unique_violation (23505 -> already_pending) nel
--   repository non viene quindi mai raggiunto.
--
-- SOLUZIONE
--   L'unicita' va sull'IDENTITA' del conflitto, non sul suo
--   stato: (external_id, change_type, hash del diff). Una
--   divergenza gia' decisa non si reinserisce piu'; se il
--   valore remoto cambia il diff cambia, la chiave e' nuova e
--   il conflitto torna correttamente in revisione.
--   Quando il remoto recepisce la nostra correzione il diff
--   si svuota, compare-with-local ritorna null e il conflitto
--   sparisce da se': e' il segnale di "riallineato".
-- =========================================================

-- 1) Colonna di identita' del conflitto, generata dal diff.
--    md5 del diff normalizzato: stabile a parita' di contenuto.
ALTER TABLE public.sync_pending_changes
  ADD COLUMN IF NOT EXISTS diff_hash TEXT
  GENERATED ALWAYS AS (md5(diff::text)) STORED;

COMMENT ON COLUMN public.sync_pending_changes.diff_hash IS
  'Hash del diff: identifica il conflitto a prescindere dallo stato di review. Serve a non reinserire una divergenza gia'' decisa.';

-- 2) Via il vecchio indice parziale, che lasciava passare
--    i reinserimenti appena la riga usciva da status=pending.
DROP INDEX IF EXISTS public.sync_pending_changes_one_pending_per_ext;

-- 3) Unicita' sull'identita' del conflitto, su TUTTI gli stati.
--    I 'new' hanno diff vuoto: per loro la chiave resta di fatto
--    (external_id, 'new'), che e' il comportamento voluto.
CREATE UNIQUE INDEX IF NOT EXISTS sync_pending_changes_identity_uniq
  ON public.sync_pending_changes (external_id, change_type, diff_hash);

-- 4) Indice per la dashboard: le pending da rivedere, piu' recenti prima.
CREATE INDEX IF NOT EXISTS sync_pending_changes_pending_review_idx
  ON public.sync_pending_changes (created_at DESC)
  WHERE status = 'pending';

-- 5) Deduplica lo storico: tiene la riga piu' vecchia per ogni
--    conflitto (la decisione originale) e scarta le ripetizioni
--    successive generate dai run notturni.
--    NB: le righe cancellate sono rumore, non decisioni perse —
--    ogni duplicato ha diff identico alla riga tenuta.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY external_id, change_type, md5(diff::text)
           ORDER BY created_at ASC
         ) AS rn
    FROM public.sync_pending_changes
)
DELETE FROM public.sync_pending_changes
 WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
