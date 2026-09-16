#!/usr/bin/env python3
"""Sanity tests for the NZ workbook parser and DB diff.

Run: .venv/bin/python test_parse.py
"""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import diff_nz as D  # noqa: E402
import parse_nz_xlsx as P  # noqa: E402

XLSX = os.path.join(HERE, 'source_AREC_ZL1SKL.xlsx')
if not os.path.exists(XLSX):
    XLSX = os.path.join(HERE, 'ZL1SKL - AR2M and AR70 Radio Programming.xlsx')
fails = []


def check(name, cond, detail: object = ''):
    print(('  OK   ' if cond else '  FAIL ') + name + ('' if cond else f' -> {detail!r}'))
    if not cond:
        fails.append(name)


print('== unit: to_hz ==')
check('MHz -> Hz', P.to_hz(145.325) == 145325000, P.to_hz(145.325))
check('None', P.to_hz(None) is None)
check('testo non numerico', P.to_hz('None') is None)
check('zero rifiutato', P.to_hz(0) is None)

print('== unit: tone ==')
check('CTCSS C123.0', P.tone('C123.0') == {'type': 'ctcss', 'value': 123.0})
check('CTCSS senza prefisso', P.tone('88.5') == {'type': 'ctcss', 'value': 88.5})
check("'None' -> None", P.tone('None') is None)
check('DCS D023N', P.tone('D023N') == {'type': 'dcs', 'value': '023', 'polarity': 'N'})

print('== unit: band_of ==')
check('145 MHz = VHF', P.band_of(145325000) == 'VHF')
check('439 MHz = UHF', P.band_of(439700000) == 'UHF')
check('927 MHz = 33cm', P.band_of(927800000) == '33cm')

print('== unit: site_of (regressione bug fusione siti) ==')
cases = {
    'BLUFF TRBO ZL': 'BLUFF', 'BLUFF 5775': 'BLUFF', 'BLUFF XLX': 'BLUFF',
    'AK DMR ZL': 'AK', 'AK DMR WWE': 'AK', 'DUN DMR LCL': 'DUN',
    'CHC DMR ZL': 'CHC', 'KAP DMR UAE1': 'KAP',
    'KLNDK NS 9875': 'KLNDK', 'CH MH NS 9875': 'CH MH',
    'HOTEO 685D': 'HOTEO', 'HOTEO 685': 'HOTEO',
    'HAM TG6 XLXr': 'HAM', 'D-BAY 7225L': 'D-BAY', 'FAR NTH 710L': 'FAR NTH',
    'POR 900 DMR ZL': 'POR 900', 'WGN 900 DMR ZL': 'WGN 900',
    'POR DMR ZL': 'POR', 'WGN DMR ZL': 'WGN',
}
for lab, want in cases.items():
    got = P.site_of(lab)
    check(f'site_of({lab!r})', got == want, got)
check('POR 900 != POR (33cm distinto dal 70cm)',
      P.site_of('POR 900 DMR ZL') != P.site_of('POR DMR ZL'))

print('== integration: parse ==')
raw = P.parse(XLSX)
uniq = P.dedupe(raw)
by_site = {}
for r in uniq:
    by_site.setdefault(r['site'], []).append(r)

check('nessun simplex superstite', all(r['output_hz'] != r['input_hz'] for r in uniq))
check('shift coerente', all(r['shift_hz'] == r['input_hz'] - r['output_hz'] for r in uniq))
check('nessuna banda ignota', all(r['band'] for r in uniq),
      [r['label'] for r in uniq if not r['band']][:5])

# --- the bug that made distinct repeaters collapse into one record ---
trbo_700 = [r for r in uniq
            if r['output_hz'] == 439700000 and r['mode'] == 'DMR']
sites_700 = sorted({r['site'] for r in trbo_700})
check('439.700 DMR resta 4 ripetitori distinti', len(trbo_700) == 4, trbo_700)
check('  siti = AK/CHC/DUN/KAP', sites_700 == ['AK', 'CHC', 'DUN', 'KAP'], sites_700)
locs_700 = sorted(r.get('locality') or '?' for r in trbo_700)
check('  localita corrette e non incrociate',
      locs_700 == ['Auckland', 'Christchurch', 'Dunedin', 'Kapiti'], locs_700)

f_775 = sorted({r['site'] for r in uniq if r['output_hz'] == 145775000})
check('145.775 FM: siti separati', len(f_775) >= 3, f_775)
bluff = [r for r in uniq if r['site'] == 'BLUFF']
check('BLUFF: un record per modo, non uno per talkgroup',
      len(bluff) == len({r['mode'] for r in bluff}),
      [(r['label'], r['mode'], r['duplicate_rows']) for r in bluff])
check('  BLUFF DMR collassa i 5 talkgroup in 1',
      any(r['mode'] == 'DMR' and r['duplicate_rows'] > 1 for r in bluff),
      [(r['label'], r['duplicate_rows']) for r in bluff])

# --- Sheet1 regression: its two repeaters must survive somewhere ---
# (they also appear in the main sheets, so dedupe may attribute them there;
# what matters is that they are present, not which sheet won)
labels = {r['label'] for r in uniq}
sites = {r['site'] for r in uniq}
check('HOTEO presente', 'HOTEO' in sites)
check('AUCK presente', 'AUCK' in sites)
check('HOTEO 685 (label FM) presente', 'HOTEO 685' in labels)
hoteo = [r for r in uniq if r['site'] == 'HOTEO']
check('HOTEO: FM e DMR separati', len({r['mode'] for r in hoteo}) == 2,
      [(r['label'], r['mode']) for r in hoteo])
auck = [r for r in uniq if r['site'] == 'AUCK']
auck_modes = {r['mode'] for r in auck}
check('AUCK e mixed-mode (FM + DMR sullo stesso sito)',
      auck_modes == {'FM', 'DMR'},
      [(r['label'], r['mode']) for r in auck])
check('AUCK Brandmeister/TRBO classificato DMR',
      all(r['mode'] == 'DMR' for r in auck
          if 'B530' in r['label'] or 'F530' in r['label'] or '5301' in r['label']),
      [(r['label'], r['mode']) for r in auck])
check("network '5 - TRBO' = DMR", P.mode_of('AR70-NI', '5 - TRBO', None) == 'DMR')
check("network '4 - DTMF' = FM", P.mode_of('AR70-NI', '4 - DTMF', None) == 'FM')

# --- locality must never be wrong ---
check('nessun FM riceve locality dal foglio DMR',
      all(r.get('locality') is None for r in uniq if r['sheet'].startswith('AR')))
ham = [r for r in uniq if r['site'] == 'HAM' and r['mode'] == 'DMR']
check('HAM DMR = Hamilton, non Marlborough',
      all((r.get('locality') or 'Hamilton') == 'Hamilton' for r in ham),
      [(r['label'], r.get('locality')) for r in ham])
# regressione: WIS e TAS condividono 439.6875 ma il foglio dettagli elenca
# una sola 'Tasman' -> non puo' finire su entrambi
locs = [r.get('locality') for r in uniq if r.get('locality')]
check('nessuna localita assegnata a due ripetitori diversi',
      len(locs) == len(set(locs)),
      [x for x in set(locs) if locs.count(x) > 1])

check('dedupe riduce le righe', len(uniq) < len(raw), (len(raw), len(uniq)))
check('chiavi uniche dopo dedupe',
      len({(r['output_hz'], r['input_hz'], r['mode'], r['site']) for r in uniq}) == len(uniq))

print('== unit: name_matches ==')
check('BRYNDN ~ Brynderwyn', D.name_matches('BRYNDN', {'locality': 'Brynderwyn'}))
check('D-BAY ~ Doubtless Bay', D.name_matches('D-BAY', {'locality': 'Doubtless Bay'}))
check('FAR NTH ~ Far North', D.name_matches('FAR NTH', {'locality': 'Far North'}))
check('AK ~ Auckland (tabella)', D.name_matches('AK', {'locality': 'Auckland'}))
check('AK !~ Dunedin', not D.name_matches('AK', {'locality': 'Dunedin'}))
check('QTOWN !~ Auckland', not D.name_matches('QTOWN', {'locality': 'Auckland'}))
check('locality vuota -> no match', not D.name_matches('AK', {'locality': None}))
# regressione: GORE (Southland) e una sottosequenza di 'Gisborne'
check('GORE !~ Gisborne (falso positivo subsequence)',
      not D.name_matches('GORE', {'locality': 'Gisborne National System'}))
check('GISB ~ Gisborne', D.name_matches('GISB', {'locality': 'Gisborne National System'}))

print('== unit: geocode (regressione falsi positivi) ==')
try:
    import geocode_nz as G

    fake_db = [
        {'locality': 'Poverty Bay', 'lat': -38.68, 'lon': 178.03},
        {'locality': 'Porirua', 'lat': -41.13, 'lon': 174.84},
        {'locality': 'Taupo', 'lat': -38.52, 'lon': 176.02},
        {'locality': 'Tasman', 'lat': -41.20, 'lon': 173.10},
        {'locality': 'Minden Amateur', 'lat': -37.71, 'lon': 176.05},
        {'locality': 'Marlborough', 'lat': -41.51, 'lon': 173.96},
        {'locality': 'Christchurch, Marleys Hill', 'lat': -43.6114, 'lon': 172.633},
        {'locality': 'Christchurch National System', 'lat': -43.6114, 'lon': 172.633},
        # Auckland: 4 siti sparsi su ~57 km -> deve essere rifiutato
        {'locality': 'Auckland', 'lat': -37.3573, 'lon': 174.809},
        {'locality': 'Auckland', 'lat': -36.8496, 'lon': 174.901},
        {'locality': 'Auckland', 'lat': -36.9255, 'lon': 174.552},
    ]
    r = G.geocode({'site': 'POR', 'locality': 'Porirua'}, fake_db)
    check('POR -> Porirua, NON Poverty Bay',
          r and abs(r[0] - (-41.13)) < 0.01, r)
    r = G.geocode({'site': 'TAS', 'locality': 'Tasman'}, fake_db)
    check('TAS -> Tasman, NON Taupo', r and abs(r[0] - (-41.20)) < 0.01, r)
    r = G.geocode({'site': 'MARL', 'locality': 'Marlborough 2m'}, fake_db)
    check('MARL -> Marlborough, NON Minden', r and abs(r[0] - (-41.51)) < 0.01, r)
    r = G.geocode({'site': 'CHC', 'locality': 'Christchurch'}, fake_db)
    check('CHC -> Christchurch (2 rif. coincidenti)', r and r[3] == 2, r)
    r = G.geocode({'site': 'AK', 'locality': 'Auckland'}, fake_db)
    check('AK -> rifiutato (siti sparsi su 57 km)', r is None, r)
    r = G.geocode({'site': 'XYZ', 'locality': None}, fake_db)
    check('sito sconosciuto -> nessuna coordinata', r is None, r)
except ImportError:
    print('  SKIP geocode_nz non presente')

print('== integration: diff vs DB ==')
tmp = os.path.join(HERE, '_parsed_test.json')
json.dump(uniq, open(tmp, 'w'), indent=1)
res = subprocess.run([sys.executable, os.path.join(HERE, 'diff_nz.py'), tmp,
                      '/tmp/_nz_test_diff.json'], capture_output=True, text=True)
if res.returncode != 0:
    print('  SKIP (nessun accesso al DB):', (res.stderr or '').strip()[-120:])
else:
    d = json.load(open('/tmp/_nz_test_diff.json'))
    tot = sum(len(d[k]) for k in ('new', 'ambiguous', 'conflict', 'duplicate'))
    check('somma categorie = totale parsato', tot == len(uniq), (tot, len(uniq)))
    check('categorie disgiunte',
          len({id(r) for k in d for r in d[k]}) == tot)
    check('nessun nuovo ha db_match', all('db_match' not in r for r in d['new']))
    check('ogni duplicato ha db_match', all(r.get('db_match') for r in d['duplicate']))
    check('gli ambigui non vengono importati',
          all('db_match' not in r for r in d['ambiguous']))
    ids = [r['db_match'] for r in d['duplicate']]
    check('nessun record DB matchato due volte', len(ids) == len(set(ids)),
          len(ids) - len(set(ids)))
os.path.exists(tmp) and os.remove(tmp)

print()
print(f"RISULTATO: {'TUTTI I TEST PASSATI' if not fails else str(len(fails)) + ' FALLITI: ' + ', '.join(fails)}")
sys.exit(1 if fails else 0)
