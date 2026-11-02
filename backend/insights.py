"""Read-only diagnostics, auction scenarios and explicitly experimental estimates.

All errors use actual minus forecast. Historical fits exclude the incomplete
previous delivery day and actual publications later than the simulated cutoff.
"""
from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone
from math import floor
from backend.analysis import LONDON, iso, metrics, timestamp

AUCTIONS = [
    {'id': 'epex-60', 'name': 'EPEX hourly', 'gate': '09:20',
     'source': 'https://www.epexspot.com/sites/default/files/2024-09/Trading%20Brochure%202024%20August.pdf'},
    {'id': 'n2ex', 'name': 'N2EX hourly', 'gate': '09:50',
     'source': 'https://support.nordpoolgroup.com/support/solutions/folders/8000087216'},
    {'id': 'epex-30', 'name': 'EPEX half-hourly', 'gate': '15:30',
     'source': 'https://www.epexspot.com/sites/default/files/download_center_files/20-01-24_TradingBrochure.pdf'},
]


def auction_cutoff(auction, prep):
    gate = next(a['gate'] for a in AUCTIONS if a['id'] == auction)
    return (datetime.combine(date(2026, 1, 1), time.fromisoformat(gate)) - timedelta(minutes=prep)).time()


def quantile(values, q):
    values = sorted(values)
    if not values:
        return None
    x = (len(values) - 1) * q
    i = int(x)
    return values[i] + (values[min(i + 1, len(values) - 1)] - values[i]) * (x - i)


def diagnostics(rows):
    paired = [r for r in rows if r['error_mw'] is not None]
    errors = [r['error_mw'] for r in paired]
    return {**metrics(rows),
            'p90_shortfall_mw': max(0, -quantile(errors, .1)) if errors else None,
            'worst_shortfall_mw': max(0, -min(errors)) if errors else None,
            'worst_surplus_mw': max(0, max(errors)) if errors else None}


def energy(rows):
    """Only report full-period energy if every hour is present; MW * one hour / 1000."""
    return {name.replace('_mw', '_gwh'): sum(r[name] for r in rows) / 1000
            if rows and all(r[name] is not None for r in rows) else None
            for name in ('forecast_mw', 'actual_mw')}


def evolution(data, decision_date, cutoff):
    day = data.day(decision_date, cutoff)
    decision = timestamp(day['cutoff'])
    start = timestamp(day['rows'][0]['start_time'])
    end = start + timedelta(hours=len(day['rows']))
    runs = defaultdict(dict)
    for row in day['rows']:
        target = timestamp(row['start_time'])
        for pub, value in data.forecasts.get(target, []):
            if pub < end:
                runs[pub][row['start_time']] = value
    output = []
    for pub, values in sorted(runs.items()):
        points = [{'hour': r['hour'], 'start_time': r['start_time'], 'forecast_mw': values.get(r['start_time'])} for r in day['rows']]
        output.append({'publish_time': iso(pub), 'available': pub <= decision,
                       'selected_hours': sum(r['publish_time'] == iso(pub) for r in day['rows']),
                       'forecast_hours': len(values), 'points': points})
    return {'decision_date': day['decision_date'], 'cutoff': day['cutoff'], 'runs': output, 'energy': energy(day['rows'])}


def analytics(data, cutoff):
    days = [data.day(date(2026, 1, d), cutoff) for d in range(1, 32)]
    rows = [r for d in days for r in d['rows']]
    hours = [{'hour': f'{h:02}:00', **diagnostics([r for r in rows if r['hour'] == f'{h:02}:00'])} for h in range(24)]
    bins = defaultdict(int)
    for row in rows:
        if row['error_mw'] is not None:
            bins[floor(row['error_mw'] / 500) * 500] += 1
    histogram = [{'from_mw': k, 'to_mw': k + 500, 'mid_mw': k + 250, 'count': bins[k]} for k in range(min(bins), max(bins)+500, 500)] if bins else []
    # All nonnegative-lead publications, not just those used for purchases.
    horizon = defaultdict(list)
    for row in rows:
        if row['actual_mw'] is None:
            continue
        target = timestamp(row['start_time'])
        for published, value in data.forecasts.get(target, []):
            lead = (target - published).total_seconds()/3600
            if 0 <= lead < 72:
                horizon[int(lead // 6) * 6].append({**row, 'forecast_mw': value, 'error_mw': row['actual_mw']-value})
    return {'metrics': diagnostics(rows), 'by_hour': hours, 'histogram': histogram,
            'scatter': [{'forecast_mw': r['forecast_mw'], 'actual_mw': r['actual_mw'], 'start_time': r['start_time']} for r in rows if r['error_mw'] is not None],
            'horizon': [{'from_h': h, 'to_h': h+6, **diagnostics(rs)} for h, rs in sorted(horizon.items())],
            'days': [{'decision_date': d['decision_date'], 'delivery_date': d['delivery_date'], **diagnostics(d['rows']), **energy(d['rows'])} for d in days]}


def experiment_day(data, decision_date, cutoff):
    day = data.day(decision_date, cutoff)
    as_of = timestamp(day['cutoff'])
    history = [r for offset in range(2, 16)
               for r in data.day(decision_date-timedelta(days=offset), cutoff, actual_as_of=as_of)['rows']
               if r['error_mw'] is not None]
    slope, intercept = None, None
    if len(history) >= 48:
        mx = sum(r['forecast_mw'] for r in history)/len(history)
        my = sum(r['actual_mw'] for r in history)/len(history)
        variance = sum((r['forecast_mw']-mx)**2 for r in history)
        if variance > 0:
            slope = sum((r['forecast_mw']-mx)*(r['actual_mw']-my) for r in history)/variance
            intercept = my-slope*mx
    # Quantiles describe official-forecast historical errors. They are not fitted
    # residuals of the correction model and are not attached to corrected forecasts.
    errors = [r['error_mw'] for r in history]
    low = quantile(errors, .1) if len(history) >= 48 else None
    high = quantile(errors, .9) if len(history) >= 48 else None
    result = []
    for row in day['rows']:
        f = row['forecast_mw']
        corrected = max(0, intercept+slope*f) if slope is not None and f is not None else None
        result.append({**row, 'corrected_mw': corrected,
                       'lower_mw': max(0, f+low) if f is not None and low is not None else None,
                       'upper_mw': max(0, f+high) if f is not None and high is not None else None})
    corrected_rows = [{**r, 'forecast_mw': r['corrected_mw'],
                       'error_mw': r['actual_mw']-r['corrected_mw'] if r['actual_mw'] is not None and r['corrected_mw'] is not None else None} for r in result]
    paired = [r for r in result if r['actual_mw'] is not None and r['lower_mw'] is not None]
    return {'decision_date': str(decision_date), 'cutoff': day['cutoff'], 'history_hours': len(history),
            'slope': slope, 'intercept_mw': intercept, 'rows': result,
            'official_metrics': diagnostics(day['rows']), 'corrected_metrics': diagnostics(corrected_rows),
            'lower_hit_hours': sum(r['actual_mw'] >= r['lower_mw'] for r in paired),
            'band_hit_hours': sum(r['lower_mw'] <= r['actual_mw'] <= r['upper_mw'] for r in paired),
            'band_paired_hours': len(paired)}


def experiment_month(data, cutoff):
    days = [experiment_day(data, date(2026, 1, d), cutoff) for d in range(1, 32)]
    rows = [r for d in days for r in d['rows']]
    eligible = [r for r in rows if r['corrected_mw'] is not None and r['actual_mw'] is not None]
    corrected = [{**r, 'forecast_mw': r['corrected_mw'], 'error_mw': r['actual_mw']-r['corrected_mw']} for r in eligible]
    n = sum(d['band_paired_hours'] for d in days)
    return {'official_same_hours': diagnostics(eligible), 'corrected_same_hours': diagnostics(corrected),
            'expected_hours': len(rows), 'evaluation_hours': len(eligible),
            'band_paired_hours': n,
            'lower_hit_pct': sum(d['lower_hit_hours'] for d in days)/n*100 if n else None,
            'band_hit_pct': sum(d['band_hit_hours'] for d in days)/n*100 if n else None}
