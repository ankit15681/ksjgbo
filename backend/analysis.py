"""Pure, point-in-time forecast selection and hourly accuracy calculations."""
from bisect import bisect_right
from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone
from math import isfinite, sqrt
from zoneinfo import ZoneInfo

LONDON = ZoneInfo('Europe/London')


def timestamp(value):
    result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if result.tzinfo is None:
        raise ValueError('Timestamps must include a timezone')
    return result.astimezone(timezone.utc)


def iso(value):
    return value.isoformat().replace('+00:00', 'Z')


def metrics(rows):
    errors = [r['error_mw'] for r in rows if r['error_mw'] is not None]
    n = len(errors)
    return {
        'expected_hours': len(rows), 'paired_hours': n,
        'forecast_hours': sum(r['forecast_mw'] is not None for r in rows),
        'actual_hours': sum(r['actual_mw'] is not None for r in rows),
        'coverage_pct': round(n / len(rows) * 100, 1) if rows else 0,
        'mae_mw': round(sum(abs(e) for e in errors) / n, 1) if n else None,
        'rmse_mw': round(sqrt(sum(e * e for e in errors) / n), 1) if n else None,
        'bias_mw': round(sum(errors) / n, 1) if n else None,
    }


class WindData:
    def __init__(self, snapshot):
        self.forecasts = defaultdict(list)
        self.actuals = {}
        seen = {}
        for kind in ('forecasts', 'actuals'):
            for row in snapshot[kind]:
                target, published = timestamp(row['startTime']), timestamp(row['publishTime'])
                value = row['generation']
                if isinstance(value, bool) or not isinstance(value, (int, float)) or not isfinite(value):
                    raise ValueError('Generation must be a finite number')
                if target.second or target.microsecond or target.minute not in ((0,) if kind == 'forecasts' else (0, 30)):
                    raise ValueError(f'Unexpected {kind} interval alignment')
                key = (kind, target, published)
                if key in seen:
                    if seen[key] != value:
                        raise ValueError('Conflicting data for the same publication')
                    continue
                seen[key] = value
                if kind == 'forecasts':
                    self.forecasts[target].append((published, value))
                elif target not in self.actuals or published > self.actuals[target][0]:
                    self.actuals[target] = (published, value)
        self.publications = {}
        for target, values in self.forecasts.items():
            values.sort()
            self.publications[target] = [v[0] for v in values]

    def day(self, decision_date: date, cutoff: time, actual_as_of=None):
        decision = datetime.combine(decision_date, cutoff, LONDON).astimezone(timezone.utc)
        delivery = decision_date + timedelta(days=1)
        start = datetime.combine(delivery, time(), LONDON).astimezone(timezone.utc)
        end = datetime.combine(delivery + timedelta(days=1), time(), LONDON).astimezone(timezone.utc)
        rows = []
        target = start
        while target < end:
            options = self.forecasts.get(target, [])
            index = bisect_right(self.publications.get(target, []), decision) - 1
            chosen = options[index] if index >= 0 else None
            halves = [self.actuals.get(target + timedelta(minutes=m)) for m in (0, 30)]
            if actual_as_of is not None:
                halves = [h if h and h[0] <= actual_as_of else None for h in halves]
            actual = sum(h[1] for h in halves) / 2 if all(h is not None for h in halves) else None
            forecast = chosen[1] if chosen else None
            rows.append({'start_time': iso(target), 'hour': target.astimezone(LONDON).strftime('%H:%M'),
                         'forecast_mw': forecast, 'actual_mw': actual,
                         'publish_time': iso(chosen[0]) if chosen else None,
                         'lead_hours': round((target - chosen[0]).total_seconds() / 3600, 1) if chosen else None,
                         'error_mw': actual - forecast if actual is not None and forecast is not None else None})
            target += timedelta(hours=1)
        return {'decision_date': str(decision_date), 'delivery_date': str(delivery),
                'cutoff': iso(decision), 'rows': rows, 'metrics': metrics(rows)}

    def month(self, cutoff: time):
        days = [self.day(date(2026, 1, d), cutoff) for d in range(1, 32)]
        return {'metrics': metrics([r for day in days for r in day['rows']]),
                'days': [{'decision_date': d['decision_date'], 'delivery_date': d['delivery_date'],
                          **d['metrics']} for d in days]}
