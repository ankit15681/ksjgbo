import csv
import hashlib
import io
import json
from datetime import date, time
from functools import lru_cache
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from backend.analysis import WindData

ROOT = Path(__file__).resolve().parents[1]
app = FastAPI(title='Wind desk API', version='1.0.0')


@lru_cache(maxsize=1)
def dataset():
    try:
        raw = (ROOT / 'data/snapshot.json').read_bytes()
        metadata = json.loads((ROOT / 'data/metadata.json').read_text())
        if hashlib.sha256(raw).hexdigest() != metadata['sha256']:
            raise ValueError('Snapshot checksum mismatch')
        return WindData(json.loads(raw)), metadata
    except (OSError, ValueError, KeyError) as error:
        raise HTTPException(503, 'Data snapshot unavailable or invalid. Run scripts/ingest.py and restart the API.') from error


def parameters(decision_date, cutoff):
    if not date(2026, 1, 1) <= decision_date <= date(2026, 1, 31):
        raise HTTPException(422, 'Decision date must be in January 2026.')
    if cutoff.tzinfo is not None or cutoff.second or cutoff.microsecond:
        raise HTTPException(422, 'Use a local London cutoff in HH:MM format.')
    return decision_date, cutoff


@app.get('/api/health')
def health():
    _, meta = dataset()
    return {'status': 'ok', 'source': meta['source'], 'retrieved_at': meta['retrieved_at']}


@app.get('/api/metadata')
def metadata():
    return dataset()[1]


@app.get('/api/day')
def day(decision_date: date = date(2026, 1, 14), cutoff: time = time(9)):
    parameters(decision_date, cutoff)
    return dataset()[0].day(decision_date, cutoff)


@app.get('/api/month')
def month(cutoff: time = time(9)):
    parameters(date(2026, 1, 1), cutoff)
    return cached_month(cutoff)


@lru_cache(maxsize=64)
def cached_month(cutoff):
    return dataset()[0].month(cutoff)


@app.get('/api/export')
def export(decision_date: date = date(2026, 1, 14), cutoff: time = time(9), scope: str = Query('day', pattern='^(day|month)$')):
    parameters(decision_date, cutoff)
    data = dataset()[0]
    days = [data.day(date(2026, 1, d), cutoff) for d in range(1, 32)] if scope == 'month' else [data.day(decision_date, cutoff)]
    output = io.StringIO()
    fields = ['decision_date', 'delivery_date', 'decision_cutoff', 'start_time', 'hour', 'forecast_mw', 'actual_mw', 'publish_time', 'lead_hours', 'error_mw']
    writer = csv.DictWriter(output, fieldnames=fields)
    writer.writeheader()
    for d in days:
        for row in d['rows']:
            writer.writerow({'decision_date': d['decision_date'], 'delivery_date': d['delivery_date'], 'decision_cutoff': d['cutoff'], **row})
    filename = f'wind-{scope}-{decision_date}-{cutoff.strftime("%H%M")}.csv'
    return Response(output.getvalue(), media_type='text/csv', headers={'Content-Disposition': f'attachment; filename="{filename}"'})


from backend import insights


@app.get('/api/auctions')
def auctions():
    return {'auctions': insights.AUCTIONS, 'timezone': 'Europe/London'}


@app.get('/api/evolution')
def evolution(decision_date: date = date(2026, 1, 14), cutoff: time = time(9)):
    parameters(decision_date, cutoff)
    return insights.evolution(dataset()[0], decision_date, cutoff)


@lru_cache(maxsize=64)
def cached_analytics(cutoff):
    return insights.analytics(dataset()[0], cutoff)


@app.get('/api/analytics')
def analytics(cutoff: time = time(9)):
    parameters(date(2026, 1, 1), cutoff)
    return cached_analytics(cutoff)


@app.get('/api/compare')
def compare(prep: int = Query(30, ge=0, le=240)):
    return {'prep_minutes': prep, 'auctions': [
        {**a, 'cutoff': insights.auction_cutoff(a['id'], prep).strftime('%H:%M'),
         'metrics': cached_analytics(insights.auction_cutoff(a['id'], prep))['metrics']}
        for a in insights.AUCTIONS]}


@lru_cache(maxsize=32)
def cached_experiment_month(cutoff):
    return insights.experiment_month(dataset()[0], cutoff)


@app.get('/api/experiment')
def experiment(decision_date: date = date(2026, 1, 14), cutoff: time = time(9)):
    parameters(decision_date, cutoff)
    return {'day': insights.experiment_day(dataset()[0], decision_date, cutoff),
            'month': cached_experiment_month(cutoff)}


if (ROOT / 'frontend/dist').exists():
    app.mount('/', StaticFiles(directory=ROOT / 'frontend/dist', html=True), name='frontend')
