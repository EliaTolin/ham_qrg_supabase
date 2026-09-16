#!/usr/bin/env python3
"""Parse the AREC/ZL1SKL radio-programming workbook into normalised repeater rows.

The workbook is a radio codeplug (channel list), not a repeater database:
it carries label / rx / tx / tones but NO coordinates. This parser normalises
what is there and leaves geo resolution to a later enrichment step.

Usage: parse_nz_xlsx.py <workbook.xlsx> [out.json]
"""
import json
import re
import sys

import openpyxl

# sheet -> (band hint, island hint)
SHEETS = {
    'AR2M-NI': ('VHF', 'North Island'),
    'AR2M-SI': ('VHF', 'South Island'),
    'AR70-NI': ('UHF', 'North Island'),
    'AR70-SI': ('UHF', 'South Island'),
    'ZL TRBO': ('UHF', None),
    'MMDVM': ('UHF', None),
    # 'Mobile' scratch sheet: holds a few real repeaters (HOTEO, AUCK
    # Brandmeister) that appear nowhere else in the workbook.
    'Sheet1': (None, None),
}
DMR_SHEETS = ('ZL TRBO', 'MMDVM')
# Deliberately excluded, each for a different reason:
#   *-SIMPLEX : simplex/APRS/ISS calling channels, no repeater involved
#   PRS       : NZ Personal Radio Service (licence-free PMR), not amateur
#   STSP      : short-term special-purpose portable repeaters — frequency
#               allocations for events, not permanent installations
# 'ZL-TRBO - Details' is not a channel list but a site table; it is read
# separately by load_trbo_sites() to recover DMR locality names.
SKIP = {'AR2M-SIMPLEX', 'AR70-SIMPLEX', 'PRS', 'STSP', 'ZL-TRBO - Details'}


def find_headers(ws):
    """Return every header row in the sheet.

    Sheet1 stacks two independent channel blocks, each with its own header,
    so a single-header scan would silently drop the second block.
    """
    out = []
    for r in range(1, ws.max_row + 1):
        vals = [str(c.value).strip() if c.value is not None else '' for c in ws[r]]
        if 'Label' in vals and 'Rx Freq' in vals:
            out.append((r, {v: i for i, v in enumerate(vals) if v}))
    return out


def band_of(hz):
    mhz = hz / 1e6
    if 50 <= mhz < 54:
        return '6m'
    if 144 <= mhz < 148:
        return 'VHF'
    if 420 <= mhz < 450:
        return 'UHF'
    if 900 <= mhz < 930:
        return '33cm'
    return None


def to_hz(v):
    if v is None or v == '':
        return None
    try:
        mhz = float(str(v).strip())
    except ValueError:
        return None
    if mhz <= 0:
        return None
    return int(round(mhz * 1_000_000))


def tone(v):
    """'C123.0' -> 123.0 CTCSS; 'D023N' -> DCS; 'None' -> None."""
    if v is None:
        return None
    s = str(v).strip()
    if not s or s.lower() == 'none':
        return None
    m = re.fullmatch(r'[Cc]?(\d+(?:\.\d+)?)', s)
    if m:
        return {'type': 'ctcss', 'value': float(m.group(1))}
    m = re.fullmatch(r'[Dd](\d+)([NnIi]?)', s)
    if m:
        return {'type': 'dcs', 'value': m.group(1), 'polarity': (m.group(2) or 'N').upper()}
    return {'type': 'raw', 'value': s}


def mode_of(sheet, network, notes):
    """Classify a channel as FM or DMR.

    Careful: the 'Notes' header is not present on every sheet (in AR70-NI the
    text 'TS1 - Brandmeister' falls under 'Voice Annunciation File Name'), so
    the Network column has to carry the decision on its own. NZ codeplugs use
    vendor names there: '5 - TRBO' is MotoTRBO, i.e. DMR.
    """
    n = (str(network or '')).lower()
    t = (str(notes or '')).lower()
    if 'analog' in t or t.strip() == 'fm':
        return 'FM'
    if any(k in n for k in ('dmr', 'trbo', 'brandmeister')):
        return 'DMR'
    if sheet in DMR_SHEETS:
        return 'DMR'
    if any(k in t for k in ('dmr', 'trbo', 'brandmeister')):
        return 'DMR'
    return 'FM'


# Tokens that denote a network/talkgroup or a channel number, never a place.
# Everything from the first such token onwards is dropped when deriving a site.
_NET_TOKENS = {
    'DMR', 'TRBO', 'BM', 'XLX', 'LCL', 'NS', 'MMDVM',
    'ZL', 'ZK', 'WW', 'WWE', 'UAE1', 'UAE2', '+SP', 'SP',
    'ANALOGUE', 'ANALOG', 'D',
}


def site_of(label, sheet=None):
    """Identify the physical site a channel row belongs to.

    CRITICAL, and the source of a real bug: a codeplug lists one row per
    talkgroup, and New Zealand reuses channels nationwide. Consequences:

      * the same frequency pair serves several DIFFERENT repeaters
        (439.700 = Auckland, Kapiti, Christchurch, Dunedin;
         145.775 = Musick, Abners, Bluff)
      * the same repeater appears under several labels
        ('BLUFF 5775', 'BLUFF TRBO ZL', 'BLUFF XLX' are one machine)

    So neither the frequency nor the raw label identifies a repeater. The site
    is the leading run of name tokens, stopping at the first channel number or
    network/talkgroup keyword:

        'BLUFF TRBO ZL'  -> 'BLUFF'      'AK DMR ZL'      -> 'AK'
        'KLNDK NS 9875'  -> 'KLNDK'      'CH MH NS 9875'  -> 'CH MH'
        'HOTEO 685D'     -> 'HOTEO'      'HAM TG6 XLXr'   -> 'HAM'
    """
    out = []
    for tok in str(label).strip().split():
        t = tok.upper()
        # '900' in 'POR 900 DMR ZL' is a band marker, not a channel number:
        # Porirua has both a 70 cm and a 33 cm machine and they are distinct.
        if out and t in ('900', '33CM', '23CM', '6M', '2M'):
            out.append(tok)
            continue
        if t[0].isdigit():                      # channel number: '5775', '685L'
            break
        if t in _NET_TOKENS:                    # network/talkgroup keyword
            break
        if re.fullmatch(r'TG\d+\w*', t):        # 'TG6', 'TG9'
            break
        if re.fullmatch(r'F?\d+', t.lstrip('+')):
            break
        out.append(tok)
        if len(out) == 3:                       # names are never longer
            break
    return ' '.join(out) if out else str(label).strip()


def _subseq(short, long_):
    """True if the letters of `short` appear in order inside `long_`."""
    it = iter(long_)
    return all(c in it for c in short)


def load_trbo_sites(wb):
    """Map (output_hz, input_hz) -> [locality, ...] from the ZL-TRBO details sheet."""
    sites = {}
    if 'ZL-TRBO - Details' not in wb.sheetnames:
        return sites
    for r in wb['ZL-TRBO - Details'].iter_rows(values_only=True):
        loc, out, inp = r[1], r[2], r[3]
        if not loc or not isinstance(out, (int, float)) or not isinstance(inp, (int, float)):
            continue
        sites.setdefault((to_hz(out), to_hz(inp)), []).append(str(loc).strip())
    return sites


def resolve_locality(site, candidates, n_sites=1):
    """Pick the locality matching a site prefix, or None if not certain.

    `n_sites` is how many distinct sites share this frequency pair. When more
    sites than known localities compete for the same pair (439.6875 carries
    both 'WIS' and 'TAS' but the detail sheet lists only 'Tasman'), a name
    match is required — otherwise the same place name would be stamped onto
    two different machines. Never guess: a wrong place name is worse than a
    missing one.
    """
    if not candidates:
        return None
    key = re.sub(r'[^a-z]', '', site.lower())
    hits = [c for c in candidates
            if _subseq(key, re.sub(r'[^a-z]', '', c.lower()))]
    if len(candidates) == 1 and n_sites <= 1:
        return candidates[0]
    return hits[0] if len(hits) == 1 else None


def parse(path):
    wb = openpyxl.load_workbook(path, data_only=True)
    trbo = load_trbo_sites(wb)
    rows = []
    for ws in wb.worksheets:
        if ws.title in SKIP or ws.title not in SHEETS:
            continue
        band_hint, island = SHEETS[ws.title]
        headers = find_headers(ws)
        for bi, (hr, hdr) in enumerate(headers):
            end = headers[bi + 1][0] - 1 if bi + 1 < len(headers) else ws.max_row
            for r in ws.iter_rows(min_row=hr + 1, max_row=end, values_only=True):
                def g(key):
                    i = hdr.get(key)
                    return r[i] if i is not None and i < len(r) else None

                label = g('Label')
                if not label or not str(label).strip():
                    continue
                rx = to_hz(g('Rx Freq'))   # radio receives = repeater output
                tx = to_hz(g('Tx Freq'))   # radio transmits = repeater input
                if not rx or not tx:
                    continue
                if rx == tx:
                    continue  # simplex row that slipped into a repeater sheet
                notes = g('Notes')
                site = site_of(str(label), ws.title)
                rows.append({
                    'label': str(label).strip(),
                    'site': site,
                    'output_hz': rx,
                    'input_hz': tx,
                    'shift_hz': tx - rx,
                    'tone_rx': tone(g('Rx Sig') if 'Rx Sig' in hdr else g('RX CTCSS')),
                    'tone_tx': tone(g('Tx Sig') if 'Tx Sig' in hdr else g('TX CTCSS')),
                    'mode': mode_of(ws.title, g('Network'), notes),
                    'band': band_hint or band_of(rx),
                    'island': island,
                    'locality': None,
                    'sheet': ws.title,
                    'notes': (str(notes).strip() if notes else None),
                })

    # Second pass: localities can only be resolved once we know how many
    # distinct sites compete for each frequency pair.
    sites_per_pair = {}
    for r in rows:
        sites_per_pair.setdefault((r['output_hz'], r['input_hz']), set()).add(r['site'])
    for r in rows:
        if r['sheet'] not in DMR_SHEETS:
            continue
        pair = (r['output_hz'], r['input_hz'])
        r['locality'] = resolve_locality(r['site'], trbo.get(pair, []),
                                         len(sites_per_pair.get(pair, ())))
    return rows


def dedupe(rows):
    """Collapse rows describing the same physical repeater.

    Key is (output, input, mode, SITE). Including the site is what keeps four
    distinct ZL-TRBO repeaters on 439.700 from collapsing into one record.
    """
    seen = {}
    for row in rows:
        k = (row['output_hz'], row['input_hz'], row['mode'], row['site'])
        if k in seen:
            prev = seen[k]
            prev['duplicate_rows'] += 1
            prev.setdefault('aliases', [])
            if row['label'] not in prev['aliases'] and row['label'] != prev['label']:
                prev['aliases'].append(row['label'])
            if not prev.get('locality') and row.get('locality'):
                prev['locality'] = row['locality']
            for t in ('tone_rx', 'tone_tx'):
                if not prev.get(t) and row.get(t):
                    prev[t] = row[t]
            continue
        row['duplicate_rows'] = 1
        seen[k] = row
    return list(seen.values())


if __name__ == '__main__':
    src = sys.argv[1]
    raw = parse(src)
    uniq = dedupe(raw)
    out = sys.argv[2] if len(sys.argv) > 2 else None
    print(f'righe canale lette : {len(raw)}')
    print(f'ripetitori distinti: {len(uniq)}')
    by_mode = {}
    for r in uniq:
        by_mode[r['mode']] = by_mode.get(r['mode'], 0) + 1
    print(f'per modo           : {by_mode}')
    print(f'con localita       : {sum(1 for r in uniq if r.get("locality"))}')
    if out:
        json.dump(uniq, open(out, 'w'), indent=1)
        print(f'scritto {out}')
