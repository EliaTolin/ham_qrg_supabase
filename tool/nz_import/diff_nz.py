#!/usr/bin/env python3
"""Compare parsed NZ repeaters against what is already in the HamQRG DB.

Why this is not a simple frequency join
---------------------------------------
New Zealand reuses repeater channels nationwide: 159 of the 194 parsed rows
sit on a frequency pair shared by two or more sites (439.700 alone serves
Auckland, Kapiti, Christchurch and Dunedin). The workbook has no coordinates
and no callsigns, only radio-display abbreviations ('QTOWN 965', 'KLNDK').

So a row is classified as already-present ONLY when frequency, shift AND a
place-name match agree. Anything that matches on frequency but cannot be
resolved by name is reported as ambiguous for a human to decide — never
silently imported (would duplicate) and never silently dropped (would lose
real repeaters).

Usage: diff_nz.py <parsed.json> [out.json]
"""
import json
import os
import re
import subprocess
import sys

PROJECT = os.environ.get('HAMQRG_SUPABASE_REF', 'dhmzkhipxvxtbbchvquc')
SQL = ("select id,name,callsign,frequency_hz,shift_hz,locality,lat,lon "
       "from repeaters where province_code='NZ' or region ilike '%new zealand%';")
SB_QUERY = os.environ.get('SB_QUERY', 'sb_query.py')

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, 'db_nz_snapshot.json')

# Radio-label abbreviations -> place names, only where the expansion is
# unambiguous and verifiable from the workbook's own detail sheet or from
# standard NZ usage. Anything not listed here stays unresolved on purpose.
ABBREV = {
    'AK': 'auckland', 'AUCK': 'auckland', 'CHC': 'christchurch',
    'CHCH': 'christchurch', 'DUN': 'dunedin', 'DNDN': 'dunedin',
    'WGN': 'wellington', 'WLG': 'wellington', 'HAM': 'hamilton',
    'TGA': 'tauranga', 'KAP': 'kapiti', 'KAPATI': 'kapiti',
    'POR': 'porirua', 'MAST': 'masterton', 'PMN': 'palmerston north',
    'OAM': 'oamaru', 'TAS': 'tasman', 'NLSN': 'nelson', 'BLEN': 'blenheim',
    'QTOWN': 'queenstown', 'GYMTH': 'greymouth', 'WPORT': 'westport',
    'GISB': 'gisborne', 'RTRUA': 'rotorua', 'WREI': 'whangarei',
    'MOSGIEL': 'mosgiel', 'TAUPO': 'taupo', 'BLUFF': 'bluff',
    'MARL': 'marlborough', 'WIS': 'tasman', 'WEI': 'wellington',
}


def norm(s):
    return re.sub(r'[^a-z]', '', (s or '').lower())


def db_rows():
    """Fetch current NZ repeaters; fall back to the cached snapshot offline."""
    try:
        out = subprocess.run([sys.executable, SB_QUERY, PROJECT, SQL],
                             capture_output=True, text=True, check=True).stdout
        rows = json.loads(out)
        json.dump(rows, open(CACHE, 'w'), indent=1)
        return rows
    except (subprocess.CalledProcessError, FileNotFoundError, json.JSONDecodeError) as exc:
        if os.path.exists(CACHE):
            print(f'[warn] query live fallita ({exc.__class__.__name__}), uso snapshot')
            return json.load(open(CACHE))
        raise


def _subseq(short, long_):
    """True if the letters of `short` appear in order inside `long_`."""
    it = iter(long_)
    return all(c in it for c in short)


def _initials(s):
    return ''.join(w[0] for w in re.findall(r'[A-Za-z]+', s or ''))


def name_matches(site, db_row):
    """True when the radio label plausibly denotes the same place as the DB row.

    Radio labels are consonant skeletons or initialisms of the place name
    ('BRYNDN' = Brynderwyn, 'D-BAY' = Doubtless Bay, 'FAR NTH' = Far North).
    Three strategies, all requiring a strong signal:

      1. explicit expansion table (highest confidence)
      2. exact / prefix match on the normalised name
      3. letter-subsequence or initials match, min 3 letters

    Strategy 3 is weak on its own, which is why the caller only accepts it when
    it singles out exactly ONE candidate among those sharing the frequency.
    """
    loc = norm(db_row.get('locality'))
    if not loc:
        return False
    key = site.upper().strip()
    exp = ABBREV.get(key) or ABBREV.get(key.split()[0])
    if exp and (norm(exp) == loc or loc.startswith(norm(exp))):
        return True
    s = norm(site)
    if len(s) >= 4 and (s == loc or loc.startswith(s) or s.startswith(loc)):
        return True
    if len(s) >= 3:
        # Subsequence matching is powerful but produces confident nonsense:
        # 'GORE' (Southland) is a subsequence of 'Gisborne'. Require the first
        # two letters to agree as well, which kills that class of false match
        # while still accepting consonant skeletons ('BRYNDN' -> Brynderwyn).
        if _subseq(s, loc) and loc[:2] == s[:2]:
            return True
        ini = norm(_initials(db_row.get('locality')))
        if len(ini) >= 2 and s.startswith(ini):
            return True
    return False


def main():
    parsed = json.load(open(sys.argv[1]))
    existing = db_rows()

    by_pair = {}
    for e in existing:
        f, s = e.get('frequency_hz'), e.get('shift_hz')
        if f is None:
            continue
        by_pair.setdefault((f, s), []).append(e)

    new, dup, ambiguous, conflict = [], [], [], []
    for r in parsed:
        cands = by_pair.get((r['output_hz'], r['shift_hz']), [])
        if not cands:
            # frequency unknown to the DB: check whether the QRG exists at all
            same_freq = [e for e in existing if e.get('frequency_hz') == r['output_hz']]
            if same_freq:
                r['db_candidates'] = [e['id'] for e in same_freq]
                r['db_shifts'] = sorted({e['shift_hz'] for e in same_freq})
                conflict.append(r)
            else:
                new.append(r)
            continue
        hits = [e for e in cands if name_matches(r['site'], e)]
        if len(hits) == 1:
            r['db_match'] = hits[0]['id']
            r['db_locality'] = hits[0].get('locality')
            dup.append(r)
        elif len(cands) == 1 and not hits:
            # single DB row on this exact pair, names disagree: cannot tell
            # whether it is the same machine under another name.
            r['db_candidates'] = [cands[0]['id']]
            r['db_localities'] = [cands[0].get('locality')]
            ambiguous.append(r)
        else:
            r['db_candidates'] = [e['id'] for e in cands]
            r['db_localities'] = [e.get('locality') for e in cands]
            ambiguous.append(r)

    print(f'in DB (NZ)              : {len(existing)}')
    print(f'nel file (siti distinti): {len(parsed)}')
    print(f'GIA PRESENTI (nome+QRG) : {len(dup)}')
    print(f'AMBIGUI (QRG condivisa) : {len(ambiguous)}')
    print(f'CONFLITTO shift         : {len(conflict)}')
    print(f'NUOVI (QRG sconosciuta) : {len(new)}')
    print()
    agg = {}
    for r in new:
        k = f"{r['mode']}/{r['band']}"
        agg[k] = agg.get(k, 0) + 1
    print(f'nuovi per modo/banda: {agg}')
    print()
    print('--- primi 15 nuovi ---')
    for r in new[:15]:
        print(f"  {r['site']:<14} out={r['output_hz'] / 1e6:9.4f} "
              f"shift={r['shift_hz'] / 1e6:+.3f} {r['mode']:<4} {r.get('locality') or ''}")
    print()
    print('--- primi 10 ambigui ---')
    for r in ambiguous[:10]:
        print(f"  {r['site']:<14} out={r['output_hz'] / 1e6:9.4f} "
              f"vs DB {r.get('db_localities')}")

    if len(sys.argv) > 2:
        json.dump({'new': new, 'ambiguous': ambiguous,
                   'conflict': conflict, 'duplicate': dup},
                  open(sys.argv[2], 'w'), indent=1)
        print(f'\nscritto {sys.argv[2]}')


if __name__ == '__main__':
    main()
