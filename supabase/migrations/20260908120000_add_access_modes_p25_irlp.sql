-- Nuovi access_mode per l'import internazionale (RepeaterBook).
-- Volumi attesi al primo import: IRLP 2.612, P25 469.
-- M17 (16) e TETRA (1) scartati: troppo pochi per giustificare l'enum.
--
-- NB: nessun blocco begin/commit esplicito.
-- Su PostgreSQL >= 12 ALTER TYPE ... ADD VALUE puo' girare in transazione, ma
-- il valore NON e' utilizzabile nella stessa transazione che lo crea:
--   ERROR: unsafe use of new value "P25" of enum type access_mode
--   HINT:  New enum values must be committed before they can be used
-- Tenendo il file fuori transazione i valori sono subito usabili dalle
-- migration successive. Stesso pattern di 20260131180000_sync_prerequisites.sql.
--
-- ATTENZIONE: non reversibile. Postgres non implementa DROP VALUE su enum
-- ("ERROR: dropping an enum value is not implemented"): una volta aggiunti,
-- P25 e IRLP restano. Sono comunque valori inerti finche' nessuna sorgente li
-- produce (TIPOLOGIA_MAP non li genera), quindi la migration e' sicura da
-- applicare anche prima del rilascio dei client.
--
-- Verificato su postgres:17.11 con la baseline enum ricostruita dalle migration
-- di questo repo: applicazione OK, riesecuzione idempotente, insert di 30.431
-- access riuscito.

ALTER TYPE public.access_mode ADD VALUE IF NOT EXISTS 'P25';
ALTER TYPE public.access_mode ADD VALUE IF NOT EXISTS 'IRLP';
