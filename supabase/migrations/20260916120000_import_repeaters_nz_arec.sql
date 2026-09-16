-- Import HamQRG: ripetitori Nuova Zelanda
-- Generato da tool/nz_import/gen_nz_import.py | source='arec_nz'
-- repeaters: 31 | access: 31
--
-- Fonte: workbook di programmazione del repeater controller AREC
-- (NZ Amateur Radio Emergency Communications), mantenuto da ZL1SKL,
-- inviato da Nick ZL2NEB a settembre 2026.
--
-- ATTENZIONE - COORDINATE ASSENTI
-- La sorgente e un codeplug radio (lista canali), non un database
-- geografico: non contiene lat/lon ne locator. Le righe entrano quindi
-- con geom nullo e is_active = false, e NON sono visibili in mappa
-- finche non vengono geolocalizzate. Nessuna coordinata e inventata.
-- Per attivarle serve una seconda migration che popoli lat/lon e metta
-- is_active = true (vedi docs/import-repeaters-nz-2026-09.md).

-- NB: supabase db push esegue ogni migration dentro una transazione,
-- quindi qui NON si apre un begin/commit esplicito (sarebbe annidato).

-- PostGIS in Supabase vive nello schema extensions.
set search_path = public, extensions;

set statement_timeout = '5min';

create temp table _imp_nz_rep (
  name text, frequency_hz bigint, shift_hz bigint,
  region text, province_code text, locality text,
  is_active boolean, external_id text
);

insert into _imp_nz_rep values
('HAM',145325000,-600000,'New Zealand','NZ',NULL,false,'hq_5ff84ecb49dd3d8a7167'),
('OPUNAKE',145400000,-600000,'New Zealand','NZ',NULL,false,'hq_edda8e25cffda2eb945b'),
('MANWTU',145725000,-600000,'New Zealand','NZ',NULL,false,'hq_b724c12a5c283a2c3825'),
('KAIPARA',438250000,-5000000,'New Zealand','NZ',NULL,false,'hq_82ecd5c4528083d76539'),
('WHEKE',439475000,-5000000,'New Zealand','NZ',NULL,false,'hq_cf69160b77fe1ae5cc99'),
('TGA',433025000,5000000,'New Zealand','NZ',NULL,false,'hq_fd8d6c7af758d16ea71c'),
('WKTNE',438400000,-5000000,'New Zealand','NZ',NULL,false,'hq_34ddbd8cfc5720ba6463'),
('COL KNOB',439250000,-5000000,'New Zealand','NZ',NULL,false,'hq_34a8ded6d6b63be768f6'),
('ADMIRAL',439300000,-5000000,'New Zealand','NZ',NULL,false,'hq_82842a8953093114de51'),
('CHCH MH',438400000,-5000000,'New Zealand','NZ',NULL,false,'hq_11a4db819a2cf2757884'),
('MOSGIEL',438200000,-5000000,'New Zealand','NZ',NULL,false,'hq_0bf3c575a21ad95c56f7'),
('QTOWN',439650000,-5000000,'New Zealand','NZ',NULL,false,'hq_339e675e300f9c9bff4a'),
('AK',439700000,-5000000,'New Zealand','NZ','Auckland',false,'hq_764eee9fc9bd516f5245'),
('WEI',439212500,-5000000,'New Zealand','NZ',NULL,false,'hq_c9ba4294eb3b2ef703e6'),
('WIS',439687500,-5000000,'New Zealand','NZ',NULL,false,'hq_8941582c23c05a8cc3e2'),
('HAM',439725000,-5000000,'New Zealand','NZ','Hamilton',false,'hq_8b0cca44580a78ad8ce5'),
('TGA',439750000,-5000000,'New Zealand','NZ','Tauranga',false,'hq_d1f45c33fef2d5d260b5'),
('TAUPO',439737500,-5000000,'New Zealand','NZ','Taupo',false,'hq_92d69ef709ff3cfa35e6'),
('HB/WGI',439237500,-5000000,'New Zealand','NZ',NULL,false,'hq_9159564a323a0a5fa78f'),
('PMN',439712500,-5000000,'New Zealand','NZ','Manawatu',false,'hq_f8b8e5654dcb1f228d9e'),
('MAST',433825000,5000000,'New Zealand','NZ','Wairarapa',false,'hq_b0e42ae26f8a0bb970af'),
('KAP',439700000,-5000000,'New Zealand','NZ','Kapiti',false,'hq_04ea935c85ad780a8dec'),
('POR 900',927800000,-12000000,'New Zealand','NZ','Porirua 33cm',false,'hq_81e5326b13c8bda017b6'),
('POR',439750000,-5000000,'New Zealand','NZ','Porirua',false,'hq_43e25b7ee06a59236611'),
('WGN 900',927850000,-12000000,'New Zealand','NZ','Wellington 33cm',false,'hq_c090285d7bd55c13cf29'),
('WGN',439725000,-5000000,'New Zealand','NZ','Wellington',false,'hq_032a8f98d2638879bb28'),
('TAS',439687500,-5000000,'New Zealand','NZ','Tasman',false,'hq_5b79d051c14cb25aedbf'),
('CHC',439700000,-5000000,'New Zealand','NZ','Christchurch',false,'hq_ab2e138238252cc6508d'),
('OAM',439237500,-5000000,'New Zealand','NZ','Oamaru',false,'hq_3ff29fedb4133a67b30f'),
('DUN',439700000,-5000000,'New Zealand','NZ','Dunedin',false,'hq_33ac6499b9837c4b4bdb'),
('MARL',145325000,-600000,'New Zealand','NZ','Marlborough 2m',false,'hq_09061b7797d94d504a8e');

create temp table _imp_nz_acc (
  external_id text, mode public.access_mode,
  ctcss_tx_hz numeric(6,1), ctcss_rx_hz numeric(6,1),
  dcs_code integer, notes text
);

insert into _imp_nz_acc values
('hq_5ff84ecb49dd3d8a7167','ANALOG'::public.access_mode,NULL,NULL,NULL,NULL),
('hq_edda8e25cffda2eb945b','ANALOG'::public.access_mode,NULL,NULL,NULL,NULL),
('hq_b724c12a5c283a2c3825','ANALOG'::public.access_mode,NULL,NULL,NULL,NULL),
('hq_82ecd5c4528083d76539','ANALOG'::public.access_mode,88.5,NULL,NULL,NULL),
('hq_cf69160b77fe1ae5cc99','ANALOG'::public.access_mode,162.2,NULL,NULL,NULL),
('hq_fd8d6c7af758d16ea71c','ANALOG'::public.access_mode,NULL,NULL,NULL,NULL),
('hq_34ddbd8cfc5720ba6463','ANALOG'::public.access_mode,NULL,NULL,NULL,NULL),
('hq_34a8ded6d6b63be768f6','ANALOG'::public.access_mode,123.0,123.0,NULL,NULL),
('hq_82842a8953093114de51','ANALOG'::public.access_mode,NULL,NULL,NULL,NULL),
('hq_11a4db819a2cf2757884','ANALOG'::public.access_mode,88.5,NULL,NULL,NULL),
('hq_0bf3c575a21ad95c56f7','ANALOG'::public.access_mode,88.5,NULL,NULL,NULL),
('hq_339e675e300f9c9bff4a','ANALOG'::public.access_mode,123.0,123.0,NULL,NULL),
('hq_764eee9fc9bd516f5245','DMR'::public.access_mode,NULL,NULL,NULL,'alias: AK DMR ZK, AK DMR LCL, AK DMR WW, AK DMR WWE'),
('hq_c9ba4294eb3b2ef703e6','DMR'::public.access_mode,NULL,NULL,NULL,'alias: WEI DMR ZK, WEI DMR LCL, WEI DMR WW, WEI DMR WWE'),
('hq_8941582c23c05a8cc3e2','DMR'::public.access_mode,NULL,NULL,NULL,'alias: WIS DMR ZK, WIS DMR LCL, WIS DMR WW, WIS DMR WWE'),
('hq_8b0cca44580a78ad8ce5','DMR'::public.access_mode,NULL,NULL,NULL,'alias: HAM DMR ZK, HAM DMR LCL, HAM DMR WW, HAM DMR WWE'),
('hq_d1f45c33fef2d5d260b5','DMR'::public.access_mode,NULL,NULL,NULL,'alias: TGA DMR ZK, TGA DMR LCL, TGA DMR WW, TGA DMR WWE'),
('hq_92d69ef709ff3cfa35e6','DMR'::public.access_mode,NULL,NULL,NULL,'alias: TAUPO DMR ZK, TAUPO DMR LCL, TAUPO DMR WW, TAUPO DMR WWE'),
('hq_9159564a323a0a5fa78f','DMR'::public.access_mode,NULL,NULL,NULL,'alias: HB/WGI DMR ZK, HB/WGI DMR LCL, HB/WGI DMR WW, HB/WGI DMR WWE'),
('hq_f8b8e5654dcb1f228d9e','DMR'::public.access_mode,NULL,NULL,NULL,'alias: PMN DMR ZK, PMN DMR LCL, PMN DMR WW, PMN DMR WWE'),
('hq_b0e42ae26f8a0bb970af','DMR'::public.access_mode,NULL,NULL,NULL,'alias: MAST DMR ZK, MAST DMR LCL, MAST DMR WW, MAST DMR WWE'),
('hq_04ea935c85ad780a8dec','DMR'::public.access_mode,NULL,NULL,NULL,'alias: KAP DMR ZK, KAP DMR LCL, KAP DMR WW, KAP DMR WWE'),
('hq_81e5326b13c8bda017b6','DMR'::public.access_mode,NULL,NULL,NULL,'alias: POR 900 DMR ZK, POR 900 DMR LCL, POR 900 DMR WW, POR 900 DMR WWE'),
('hq_43e25b7ee06a59236611','DMR'::public.access_mode,NULL,NULL,NULL,'alias: POR DMR ZK, POR DMR LCL, POR DMR WW, POR DMR WWE'),
('hq_c090285d7bd55c13cf29','DMR'::public.access_mode,NULL,NULL,NULL,'alias: WGN 900 DMR ZK, WGN 900 DMR LCL, WGN 900 DMR WW, WGN 900 DMR WWE'),
('hq_032a8f98d2638879bb28','DMR'::public.access_mode,NULL,NULL,NULL,'alias: WGN DMR ZK, WGN DMR LCL, WGN DMR WW, WGN DMR WWE'),
('hq_5b79d051c14cb25aedbf','DMR'::public.access_mode,NULL,NULL,NULL,'alias: TAS DMR ZK, TAS DMR LCL, TAS DMR WW, TAS DMR WWE'),
('hq_ab2e138238252cc6508d','DMR'::public.access_mode,NULL,NULL,NULL,'alias: CHC DMR ZK, CHC DMR LCL, CHC DMR WW, CHC DMR WWE'),
('hq_3ff29fedb4133a67b30f','DMR'::public.access_mode,NULL,NULL,NULL,'alias: OAM DMR ZK, OAM DMR LCL, OAM DMR WW, OAM DMR WWE'),
('hq_33ac6499b9837c4b4bdb','DMR'::public.access_mode,NULL,NULL,NULL,'alias: DUN DMR ZK, DUN DMR LCL, DUN DMR WW, DUN DMR WWE'),
('hq_09061b7797d94d504a8e','DMR'::public.access_mode,NULL,NULL,NULL,'alias: MARL DMR ZK, MARL DMR LCL, MARL DMR WW, MARL DMR WWE');

-- 1) repeaters
-- Dedup su external_id (repeaters_external_id_unique). Le righe non
-- hanno locator, quindi repeaters_frequency_locator_unique non si
-- applica: e external_id a rendere l import ripetibile.
insert into public.repeaters
  (name, frequency_hz, shift_hz, region, province_code, locality,
   source, is_active, external_id, last_seen_at)
select name, frequency_hz, shift_hz, region, province_code, locality,
       'arec_nz', is_active, external_id, now()
from _imp_nz_rep
on conflict do nothing;

-- 2) access: insert adattivo, come per l import mondiale, perche lo
-- schema di repeater_access e andato in drift rispetto alle migration.
do $$
declare
  v_cols text := 'repeater_id, mode';
  v_vals text := 'r.id, a.mode';
  v_sql  text;
  v_n    bigint;
begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='repeater_access'
               and column_name='ctcss_tx_hz') then
    v_cols := v_cols || ', ctcss_tx_hz';  v_vals := v_vals || ', a.ctcss_tx_hz';
    if exists (select 1 from information_schema.columns
               where table_schema='public' and table_name='repeater_access'
                 and column_name='ctcss_rx_hz') then
      v_cols := v_cols || ', ctcss_rx_hz';  v_vals := v_vals || ', a.ctcss_rx_hz';
    end if;
  elsif exists (select 1 from information_schema.columns
                where table_schema='public' and table_name='repeater_access'
                  and column_name='ctcss_hz') then
    v_cols := v_cols || ', ctcss_hz';
    v_vals := v_vals || ', coalesce(a.ctcss_tx_hz, a.ctcss_rx_hz)';
  else
    raise exception 'repeater_access: nessuna colonna CTCSS riconosciuta';
  end if;

  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='repeater_access'
               and column_name='dcs_code') then
    v_cols := v_cols || ', dcs_code';  v_vals := v_vals || ', a.dcs_code';
  end if;

  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='repeater_access'
               and column_name='notes') then
    v_cols := v_cols || ', notes';  v_vals := v_vals || ', a.notes';
  end if;

  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='repeater_access'
               and column_name='source') then
    v_cols := v_cols || ', source';
    v_vals := v_vals || ', ' || quote_literal('arec_nz');
  end if;

  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='repeater_access'
               and column_name='tone_direction') then
    v_cols := v_cols || ', tone_direction';
    v_vals := v_vals || ', case when a.ctcss_tx_hz is not null and a.ctcss_rx_hz is not null then ''both''::public.tone_direction'
           || ' when a.ctcss_tx_hz is not null then ''tx''::public.tone_direction'
           || ' when a.ctcss_rx_hz is not null then ''rx''::public.tone_direction'
           || ' else ''unknown''::public.tone_direction end';
  end if;

  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='repeater_access'
               and column_name='tone_scope') then
    v_cols := v_cols || ', tone_scope';
    v_vals := v_vals || ', case when a.ctcss_tx_hz is not null or a.ctcss_rx_hz is not null'
           || ' then ''local''::public.tone_scope else ''unknown''::public.tone_scope end';
  end if;

  v_sql := 'insert into public.repeater_access (' || v_cols || ') '
        || 'select ' || v_vals || ' '
        || 'from _imp_nz_acc a '
        || 'join public.repeaters r on r.external_id = a.external_id '
        || 'on conflict do nothing';

  raise notice 'NZ repeater_access colonne usate: %', v_cols;
  execute v_sql;
  get diagnostics v_n = row_count;
  raise notice 'NZ repeater_access inseriti: %', v_n;
end $$;

drop table _imp_nz_rep;
drop table _imp_nz_acc;
