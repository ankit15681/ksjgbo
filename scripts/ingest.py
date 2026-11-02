"""Fetch a reproducible January decision-window snapshot from public Elexon APIs."""
import hashlib
import json
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://data.elexon.co.uk/bmrs/api/v1/datasets/'


def fetch(dataset, params):
    url = BASE + dataset + '/stream?' + urlencode(params)
    for attempt in range(4):
        try:
            with urlopen(url, timeout=60) as response:
                rows = json.load(response)
            if not isinstance(rows, list):
                raise ValueError(f'Unexpected {dataset} response')
            return rows, url
        except Exception:
            if attempt == 3:
                raise
            time.sleep(2 ** attempt)


def main():
    forecasts, actuals, sources = [], [], []
    # Prior publications are needed for early January 1 cutoffs.
    for offset in range(48):
        day = date(2025, 12, 15) + timedelta(days=offset)
        end = day + timedelta(days=1)
        rows, url = fetch('WINDFOR', {'publishDateTimeFrom': f'{day}T00:00:00Z',
                                     'publishDateTimeTo': f'{end}T00:00:00Z'})
        forecasts.extend(r for r in rows if '2025-12-18' <= r['startTime'][:10] <= '2026-02-01'
                         and r['publishTime'] < '2026-02-01T00:00:00Z')
        sources.append(url)
        print(f'Forecast publications {day}: {len(rows)}', flush=True)
    for offset in range(46):
        day = date(2025, 12, 18) + timedelta(days=offset)
        rows, url = fetch('FUELHH', {'settlementDateFrom': str(day),
                                   'settlementDateTo': str(day), 'fuelType': 'WIND'})
        actuals.extend(r for r in rows if r['fuelType'] == 'WIND')
        sources.append(url)
        print(f'Actuals {day}: {len(rows)}', flush=True)
    def unique(rows):
        found = {}
        for r in rows:
            key = (r['startTime'], r['publishTime'])
            value = {k: r[k] for k in ('startTime', 'publishTime', 'generation')}
            if key in found and found[key] != value:
                raise ValueError(f'Conflicting records: {key}')
            found[key] = value
        return sorted(found.values(), key=lambda r: (r['startTime'], r['publishTime']))
    payload = {'forecasts': unique(forecasts), 'actuals': unique(actuals)}
    encoded = json.dumps(payload, separators=(',', ':')).encode()
    metadata = {'source': 'Elexon Insights Solution', 'retrieved_at': datetime.now(timezone.utc).isoformat(),
                'forecast_count': len(payload['forecasts']), 'actual_count': len(payload['actuals']),
                'sha256': hashlib.sha256(encoded).hexdigest(), 'requests': sources,
                'decision_dates': ['2026-01-01', '2026-01-31'],
                'history_start': '2025-12-18',
                'delivery_dates': ['2026-01-02', '2026-02-01']}
    target = ROOT / 'data'
    target.mkdir(exist_ok=True)
    # Write only after every request succeeds, so a failed refresh preserves the old snapshot.
    (target / 'snapshot.tmp').write_bytes(encoded)
    (target / 'snapshot.tmp').replace(target / 'snapshot.json')
    (target / 'metadata.json').write_text(json.dumps(metadata, indent=2) + '\n')
    print(json.dumps({k: v for k, v in metadata.items() if k != 'requests'}, indent=2))


if __name__ == '__main__':
    main()
