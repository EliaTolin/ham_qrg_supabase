#!/usr/bin/env python3
"""Recover coordinates for the NZ import by matching site names against the
repeaters already in the database.

Rationale
---------
The AREC codeplug has no coordinates, but a repeater SITE usually hosts more
than one machine, and the database already holds 166 NZ repeaters with
lat/lon. When a new repeater's site name resolves to a site already known to
the DB, its coordinates are the coordinates of that site.

This is inference, not measurement, so it is applied only when unambiguous:

  * the site name must resolve to exactly one place (same matcher used by
    diff_nz.py, which expands 'BRYNDN' -> Brynderwyn, 'D-BAY' -> Doubtless Bay)
  * every matching DB row must agree on position within CLUSTER_KM; 'Auckland'
    maps to four points 40 km apart, so it is rejected rather than averaged
  * the resulting coordinate is tagged in notes as derived, never presented as
    surveyed data

Anything that does not pass stays without coordinates and inactive.

Usage: geocode_nz.py <diff.json> [out.json]
"""
import json
import math
import re
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import diff_nz as D  # noqa: E402

# Max spread accepted among candidate positions for one site name.
# 3 km keeps a hilltop together while rejecting city-wide name collisions.
CLUSTER_KM = 3.0


def haversine(a, b):
    lat1, lon1, lat2, lon2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = (math.sin((lat2 - lat1) / 2) ** 2
         + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2)
    return 2 * 6371.0 * math.asin(math.sqrt(h))


def spread_km(points):
    return max((haversine(p, q) for i, p in enumerate(points)
                for q in points[i + 1:]), default=0.0)


def geocode(row, db):
    """Return (lat, lon, source_locality, n_refs) or None when not certain.

    STRICT BY DESIGN. An earlier fuzzy version — reusing diff_nz.name_matches
    without the frequency constraint to narrow candidates — produced confident
    nonsense: 'POR' (Porirua) matched Poverty Bay, 'TAS' (Tasman) matched
    Taupo, 'MARL' (Marlborough) matched Minden. Those abbreviations are simply
    too short to disambiguate against 151 place names.

    So inference starts from the locality recovered from the workbook's own
    ZL-TRBO detail sheet (real data, not a guess) and requires an exact or
    prefix match on the normalised place name. No subsequence, no initials.
    A site with no verified locality gets no coordinates.
    """
    loc = row.get('locality')
    if not loc:
        # No locality from the detail sheet (FM sheets have none). Fall back to
        # the hand-curated abbreviation table only — an explicit mapping a
        # human wrote and can audit, never a fuzzy guess.
        key0 = row['site'].upper().strip()
        loc = D.ABBREV.get(key0) or D.ABBREV.get(key0.split()[0])
        if not loc:
            return None
    # 'Porirua 33cm' / 'Marlborough 2m' carry a band suffix, not a place
    base = re.sub(r'\s*(33cm|23cm|70cm|2m|6m)\s*$', '', loc, flags=re.I).strip()
    key = D.norm(base)
    if len(key) < 4:
        return None

    hits = []
    for e in db:
        if e.get('lat') is None:
            continue
        dbl = D.norm(e.get('locality'))
        if not dbl:
            continue
        # exact, or DB name starts with ours ('Christchurch, Marleys Hill')
        if dbl == key or dbl.startswith(key):
            hits.append(e)
    if not hits:
        return None
    pts = [(e['lat'], e['lon']) for e in hits]
    if spread_km(pts) > CLUSTER_KM:
        return None                      # same name, different places
    lat = sum(p[0] for p in pts) / len(pts)
    lon = sum(p[1] for p in pts) / len(pts)
    locs = sorted({e.get('locality') for e in hits if e.get('locality')})
    return round(lat, 6), round(lon, 6), locs[0] if locs else None, len(hits)


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'nz_diff.json')
    data = json.load(open(src))
    rows = data['new']
    db = D.db_rows()

    ok = 0
    for r in rows:
        res = geocode(r, db)
        if res:
            r['lat'], r['lon'], r['geo_locality'], r['geo_refs'] = res
            r['geo_source'] = 'derived_from_site_match'
            if not r.get('locality'):
                r['locality'] = r['geo_locality']
            ok += 1
        else:
            r['lat'] = r['lon'] = None
            r['geo_source'] = None

    print(f'nuovi                 : {len(rows)}')
    print(f'GEOLOCALIZZATI        : {ok}')
    print(f'senza coordinate      : {len(rows) - ok}')
    print()
    print('--- geolocalizzati ---')
    for r in rows:
        if r['lat'] is not None:
            print(f"  {r['site']:<12} {r['output_hz'] / 1e6:9.4f} {r['mode']:<4} "
                  f"{r['lat']:9.4f},{r['lon']:9.4f}  <- {r['geo_locality']} "
                  f"({r['geo_refs']} rif.)")
    print()
    print('--- senza coordinate ---')
    for r in rows:
        if r['lat'] is None:
            print(f"  {r['site']:<12} {r['output_hz'] / 1e6:9.4f} {r['mode']}")

    out = sys.argv[2] if len(sys.argv) > 2 else src
    data['new'] = rows
    json.dump(data, open(out, 'w'), indent=1)
    print(f'\nscritto {out}')


if __name__ == '__main__':
    main()
