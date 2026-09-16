#!/usr/bin/env python3
"""Genera la migration SQL di import dei ripetitori NZ (fonte AREC/ZL1SKL).

Input : nz_new_repeaters.json (output di diff_nz.py, chiave "new")
Output : supabase/migrations/<ts>_import_repeaters_nz_arec.sql

Coerente con 20260908130000_import_repeaters_worldwide.sql:
  - external_id opaco e deterministico: blake2s(namespace | paese | sorgente | chiave)
  - namespace congelato 'hamqrg.repeater.v1' (cambiarlo rigenera tutti gli id)
  - insert adattivo allo schema reale di repeater_access
  - on conflict do nothing, nessun begin/commit esplicito

Differenza sostanziale rispetto all'import mondiale: la sorgente e' un codeplug
radio e NON contiene coordinate. Le righe entrano quindi senza lat/lon (geom
nullo) e con is_active = false, cosi non compaiono in mappa finche' qualcuno
non le geolocalizza. Nessuna coordinata viene inventata.

Uso: gen_nz_import.py [nz_new_repeaters.json] [output.sql]
"""
import hashlib
import json
import os
import sys

NAMESPACE = 'hamqrg.repeater.v1'
SOURCE = 'arec_nz'
COUNTRY = 'New Zealand'
PROVINCE = 'NZ'

HERE = os.path.dirname(os.path.abspath(__file__))


def external_id(row):
    """Id opaco e deterministico: stesso input -> stesso id, import ripetibile.

    Include il SITO: in NZ la stessa coppia di frequenze e usata da piu
    ripetitori fisici (439.700 = Auckland, Kapiti, Christchurch, Dunedin),
    quindi senza il sito quattro macchine diverse collasserebbero in un
    unico id e ne importeremmo una sola.
    """
    key = '|'.join([NAMESPACE, COUNTRY, SOURCE,
                    str(row['output_hz']), str(row['input_hz']),
                    row['mode'], row['site']])
    return 'hq_' + hashlib.blake2s(key.encode(), digest_size=10).hexdigest()


def q(v):
    if v is None:
        return 'NULL'
    if isinstance(v, bool):
        return 'true' if v else 'false'
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def access_rows(row):
    """Un repeater puo' esporre piu' modi; qui il codeplug ne da' uno solo."""
    mode = 'DMR' if row['mode'] == 'DMR' else 'ANALOG'
    tx = row.get('tone_tx') or {}
    rx = row.get('tone_rx') or {}
    ctcss_tx = tx.get('value') if tx.get('type') == 'ctcss' else None
    ctcss_rx = rx.get('value') if rx.get('type') == 'ctcss' else None
    dcs = None
    for t in (tx, rx):
        if t.get('type') == 'dcs':
            dcs = int(t['value'])
            break
    notes = []
    if row.get('aliases'):
        notes.append('alias: ' + ', '.join(row['aliases'][:4]))
    if row.get('notes'):
        notes.append(str(row['notes'])[:80])
    return {
        'mode': mode,
        'ctcss_tx_hz': ctcss_tx,
        'ctcss_rx_hz': ctcss_rx,
        'dcs_code': dcs,
        'notes': '; '.join(notes) or None,
    }


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'nz_new_repeaters.json')
    rows = json.load(open(src))['new']

    seen = set()
    reps, accs = [], []
    for r in rows:
        eid = external_id(r)
        if eid in seen:
            raise SystemExit(f'collisione external_id su {r["label"]}')
        seen.add(eid)
        reps.append((r, eid))
        accs.append((eid, access_rows(r)))

    n_dmr = sum(1 for r, _ in reps if r['mode'] == 'DMR')
    n_tone = sum(1 for _, a in accs if a['ctcss_tx_hz'] or a['ctcss_rx_hz'])
    n_loc = sum(1 for r, _ in reps if r.get('locality'))

    L = []
    L.append('-- Import HamQRG: ripetitori Nuova Zelanda')
    L.append(f'-- Generato da tool/nz_import/gen_nz_import.py | source={SOURCE!r}')
    L.append(f'-- repeaters: {len(reps)} | access: {len(accs)}')
    L.append('--')
    L.append('-- Fonte: workbook di programmazione del repeater controller AREC')
    L.append('-- (NZ Amateur Radio Emergency Communications), mantenuto da ZL1SKL,')
    L.append('-- inviato da Nick ZL2NEB a settembre 2026.')
    L.append('--')
    L.append('-- ATTENZIONE - COORDINATE ASSENTI')
    L.append('-- La sorgente e un codeplug radio (lista canali), non un database')
    L.append('-- geografico: non contiene lat/lon ne locator. Le righe entrano quindi')
    L.append('-- con geom nullo e is_active = false, e NON sono visibili in mappa')
    L.append('-- finche non vengono geolocalizzate. Nessuna coordinata e inventata.')
    L.append('-- Per attivarle serve una seconda migration che popoli lat/lon e metta')
    L.append('-- is_active = true (vedi docs/import-repeaters-nz-2026-09.md).')
    L.append('')
    L.append('-- NB: supabase db push esegue ogni migration dentro una transazione,')
    L.append('-- quindi qui NON si apre un begin/commit esplicito (sarebbe annidato).')
    L.append('')
    L.append('-- PostGIS in Supabase vive nello schema extensions.')
    L.append('set search_path = public, extensions;')
    L.append('')
    L.append("set statement_timeout = '5min';")
    L.append('')
    L.append('create temp table _imp_nz_rep (')
    L.append('  name text, frequency_hz bigint, shift_hz bigint,')
    L.append('  region text, province_code text, locality text,')
    L.append('  is_active boolean, external_id text')
    L.append(');')
    L.append('')
    L.append('insert into _imp_nz_rep values')
    vals = []
    for r, eid in reps:
        vals.append('(' + ','.join([
            q(r.get('site') or r['label']), q(r['output_hz']), q(r['shift_hz']),
            q(COUNTRY), q(PROVINCE), q(r.get('locality')),
            'false', q(eid),
        ]) + ')')
    L.append(',\n'.join(vals) + ';')
    L.append('')
    L.append('create temp table _imp_nz_acc (')
    L.append('  external_id text, mode public.access_mode,')
    L.append('  ctcss_tx_hz numeric(6,1), ctcss_rx_hz numeric(6,1),')
    L.append('  dcs_code integer, notes text')
    L.append(');')
    L.append('')
    L.append('insert into _imp_nz_acc values')
    vals = []
    for eid, a in accs:
        vals.append('(' + ','.join([
            q(eid), f"{q(a['mode'])}::public.access_mode",
            q(a['ctcss_tx_hz']), q(a['ctcss_rx_hz']),
            q(a['dcs_code']), q(a['notes']),
        ]) + ')')
    L.append(',\n'.join(vals) + ';')
    L.append('')
    L.append('-- 1) repeaters')
    L.append('-- Dedup su external_id (repeaters_external_id_unique). Le righe non')
    L.append('-- hanno locator, quindi repeaters_frequency_locator_unique non si')
    L.append('-- applica: e external_id a rendere l import ripetibile.')
    L.append('insert into public.repeaters')
    L.append('  (name, frequency_hz, shift_hz, region, province_code, locality,')
    L.append('   source, is_active, external_id, last_seen_at)')
    L.append('select name, frequency_hz, shift_hz, region, province_code, locality,')
    L.append(f'       {q(SOURCE)}, is_active, external_id, now()')
    L.append('from _imp_nz_rep')
    L.append('on conflict do nothing;')
    L.append('')
    L.append('-- 2) access: insert adattivo, come per l import mondiale, perche lo')
    L.append('-- schema di repeater_access e andato in drift rispetto alle migration.')
    L.append('do $$')
    L.append('declare')
    L.append("  v_cols text := 'repeater_id, mode';")
    L.append("  v_vals text := 'r.id, a.mode';")
    L.append('  v_sql  text;')
    L.append('  v_n    bigint;')
    L.append('begin')
    L.append("  if exists (select 1 from information_schema.columns")
    L.append("             where table_schema='public' and table_name='repeater_access'")
    L.append("               and column_name='ctcss_tx_hz') then")
    L.append("    v_cols := v_cols || ', ctcss_tx_hz';  v_vals := v_vals || ', a.ctcss_tx_hz';")
    L.append("    if exists (select 1 from information_schema.columns")
    L.append("               where table_schema='public' and table_name='repeater_access'")
    L.append("                 and column_name='ctcss_rx_hz') then")
    L.append("      v_cols := v_cols || ', ctcss_rx_hz';  v_vals := v_vals || ', a.ctcss_rx_hz';")
    L.append('    end if;')
    L.append("  elsif exists (select 1 from information_schema.columns")
    L.append("                where table_schema='public' and table_name='repeater_access'")
    L.append("                  and column_name='ctcss_hz') then")
    L.append("    v_cols := v_cols || ', ctcss_hz';")
    L.append("    v_vals := v_vals || ', coalesce(a.ctcss_tx_hz, a.ctcss_rx_hz)';")
    L.append('  else')
    L.append("    raise exception 'repeater_access: nessuna colonna CTCSS riconosciuta';")
    L.append('  end if;')
    L.append('')
    for col in ('dcs_code', 'notes'):
        L.append(f"  if exists (select 1 from information_schema.columns")
        L.append(f"             where table_schema='public' and table_name='repeater_access'")
        L.append(f"               and column_name='{col}') then")
        L.append(f"    v_cols := v_cols || ', {col}';  v_vals := v_vals || ', a.{col}';")
        L.append('  end if;')
        L.append('')
    L.append("  if exists (select 1 from information_schema.columns")
    L.append("             where table_schema='public' and table_name='repeater_access'")
    L.append("               and column_name='source') then")
    L.append("    v_cols := v_cols || ', source';")
    L.append(f"    v_vals := v_vals || ', ' || quote_literal({q(SOURCE)});")
    L.append('  end if;')
    L.append('')
    L.append("  if exists (select 1 from information_schema.columns")
    L.append("             where table_schema='public' and table_name='repeater_access'")
    L.append("               and column_name='tone_direction') then")
    L.append("    v_cols := v_cols || ', tone_direction';")
    L.append("    v_vals := v_vals || ', case when a.ctcss_tx_hz is not null and a.ctcss_rx_hz is not null then ''both''::public.tone_direction'")
    L.append("           || ' when a.ctcss_tx_hz is not null then ''tx''::public.tone_direction'")
    L.append("           || ' when a.ctcss_rx_hz is not null then ''rx''::public.tone_direction'")
    L.append("           || ' else ''unknown''::public.tone_direction end';")
    L.append('  end if;')
    L.append('')
    L.append("  if exists (select 1 from information_schema.columns")
    L.append("             where table_schema='public' and table_name='repeater_access'")
    L.append("               and column_name='tone_scope') then")
    L.append("    v_cols := v_cols || ', tone_scope';")
    L.append("    v_vals := v_vals || ', case when a.ctcss_tx_hz is not null or a.ctcss_rx_hz is not null'")
    L.append("           || ' then ''local''::public.tone_scope else ''unknown''::public.tone_scope end';")
    L.append('  end if;')
    L.append('')
    L.append("  v_sql := 'insert into public.repeater_access (' || v_cols || ') '")
    L.append("        || 'select ' || v_vals || ' '")
    L.append("        || 'from _imp_nz_acc a '")
    L.append("        || 'join public.repeaters r on r.external_id = a.external_id '")
    L.append("        || 'on conflict do nothing';")
    L.append('')
    L.append("  raise notice 'NZ repeater_access colonne usate: %', v_cols;")
    L.append('  execute v_sql;')
    L.append('  get diagnostics v_n = row_count;')
    L.append("  raise notice 'NZ repeater_access inseriti: %', v_n;")
    L.append('end $$;')
    L.append('')
    L.append('drop table _imp_nz_rep;')
    L.append('drop table _imp_nz_acc;')
    L.append('')

    out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, 'import_nz.sql')
    open(out, 'w').write('\n'.join(L))
    print(f'repeaters : {len(reps)} (DMR {n_dmr}, FM {len(reps) - n_dmr})')
    print(f'access    : {len(accs)} (con tono CTCSS: {n_tone})')
    print(f'localita  : {n_loc}/{len(reps)}')
    print(f'coordinate: 0/{len(reps)} -> tutte is_active=false')
    print(f'scritto   : {out}')


if __name__ == '__main__':
    main()
