from datetime import date, datetime, time, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from backend.analysis import WindData, iso
from backend.insights import (auction_cutoff, diagnostics, energy, evolution,
                              experiment_day, experiment_month, quantile)
from backend.main import app, dataset

client = TestClient(app)


def synthetic():
    forecasts, actuals = [], []
    for d in range(1, 7):
        day = datetime(2026, 1, d, tzinfo=timezone.utc)
        for h in range(24):
            target = day + timedelta(hours=h)
            f = 2000 + h * 400
            forecasts.append({'startTime': iso(target), 'publishTime': iso(day-timedelta(hours=16)), 'generation': f})
            for minute in (0, 30):
                t = target + timedelta(minutes=minute)
                actuals.append({'startTime': iso(t), 'publishTime': iso(t+timedelta(minutes=30)), 'generation': 1000+.5*f})
    return {'forecasts': forecasts, 'actuals': actuals}


def test_auction_cutoffs():
    assert auction_cutoff('epex-60', 30) == time(8, 50)
    assert auction_cutoff('n2ex', 0) == time(9, 50)
    assert auction_cutoff('epex-30', 90) == time(14)


def test_known_linear_correction_and_no_lookahead():
    snapshot = synthetic()
    base = experiment_day(WindData(snapshot), date(2026, 1, 3), time(9))
    assert base['history_hours'] == 48
    assert base['slope'] == pytest.approx(.5)
    assert base['intercept_mw'] == pytest.approx(1000)
    assert base['rows'][0]['corrected_mw'] == pytest.approx(2000)
    # D-1 is incomplete at decision time; target day and future outcomes also excluded.
    for row in snapshot['actuals']:
        if row['startTime'] >= '2026-01-03':
            row['generation'] = 99999
    changed = experiment_day(WindData(snapshot), date(2026, 1, 3), time(9))
    assert changed['slope'] == base['slope']
    assert changed['intercept_mw'] == base['intercept_mw']
    assert [r['lower_mw'] for r in changed['rows']] == [r['lower_mw'] for r in base['rows']]


def test_actual_publication_availability_is_checked():
    snapshot = synthetic()
    for row in snapshot['actuals']:
        row['publishTime'] = '2026-01-10T00:00:00Z'
    result = experiment_day(WindData(snapshot), date(2026, 1, 3), time(9))
    assert result['history_hours'] == 0
    assert result['slope'] is None
    assert all(r['corrected_mw'] is None and r['lower_mw'] is None for r in result['rows'])


def test_insufficient_history_has_no_fabricated_estimates():
    result = experiment_day(WindData(synthetic()), date(2026, 1, 2), time(9))
    assert result['history_hours'] == 24
    assert result['slope'] is None
    assert result['corrected_metrics']['paired_hours'] == 0


def test_empty_data_retains_expected_hours():
    empty = WindData({'forecasts': [], 'actuals': []})
    result = experiment_month(empty, time(9))
    assert result['expected_hours'] == 744
    assert result['evaluation_hours'] == 0
    assert result['band_hit_pct'] is None


def test_energy_requires_complete_hours_and_directions_are_nonnegative():
    rows = [{'forecast_mw': 100, 'actual_mw': 80, 'error_mw': -20},
            {'forecast_mw': 200, 'actual_mw': 220, 'error_mw': 20}]
    assert energy(rows) == {'forecast_gwh': .3, 'actual_gwh': .3}
    assert diagnostics(rows[:1])['worst_surplus_mw'] == 0
    assert diagnostics(rows[1:])['worst_shortfall_mw'] == 0
    rows[0]['actual_mw'] = None
    assert energy(rows)['actual_gwh'] is None


def test_empirical_quantiles_interpolate_and_empty_is_null():
    assert quantile([0, 100], .1) == 10
    assert quantile([], .9) is None


def test_evolution_marks_hindsight_and_per_hour_provenance():
    data = dataset()[0]
    result = evolution(data, date(2026, 1, 14), time(9))
    assert sum(r['selected_hours'] for r in result['runs']) == 24
    assert any(not r['available'] for r in result['runs'])
    for run in result['runs']:
        assert run['available'] == (run['publish_time'] <= result['cutoff'])
        assert len(run['points']) == 24


def test_missing_hour_is_visible_in_evolution_energy():
    data = synthetic()
    data['forecasts'] = [r for r in data['forecasts'] if r['startTime'] != '2026-01-04T12:00:00Z']
    result = evolution(WindData(data), date(2026, 1, 3), time(9))
    assert result['energy']['forecast_gwh'] is None
    assert len(result['runs'][0]['points']) == 24
    assert result['runs'][0]['points'][12]['forecast_mw'] is None


def test_analytics_energy_matches_day_and_histogram_counts():
    response = client.get('/api/analytics?cutoff=08:50')
    assert response.status_code == 200
    result = response.json()
    assert sum(b['count'] for b in result['histogram']) == result['metrics']['paired_hours'] == 744
    day = next(d for d in result['days'] if d['decision_date'] == '2026-01-14')
    evolution = client.get('/api/evolution?decision_date=2026-01-14&cutoff=08:50').json()
    assert day['actual_gwh'] == evolution['energy']['actual_gwh'] == 253.626
    assert len(result['by_hour']) == 24


def test_experiment_is_separate_and_physically_bounded():
    result = client.get('/api/experiment?decision_date=2026-01-31&cutoff=08:50')
    assert result.status_code == 200
    result = result.json()
    assert result['month']['evaluation_hours'] == 744
    assert result['month']['corrected_same_hours']['paired_hours'] == result['month']['official_same_hours']['paired_hours']
    for r in result['day']['rows']:
        assert r['lower_mw'] >= 0 and r['upper_mw'] >= r['lower_mw']
        assert r['corrected_mw'] >= 0
    official = client.get('/api/day?decision_date=2026-01-31&cutoff=08:50').json()
    assert all('corrected_mw' not in r for r in official['rows'])


def test_new_routes_validate_inputs():
    for path in ['/api/analytics?cutoff=25:00', '/api/experiment?decision_date=2026-02-01', '/api/compare?prep=-1', '/api/evolution?cutoff=09:00Z']:
        assert client.get(path).status_code == 422
    assert len(client.get('/api/auctions').json()['auctions']) == 3


def test_first_january_decision_has_full_warmup():
    result = experiment_day(dataset()[0], date(2026, 1, 1), time(8, 50))
    assert result['history_hours'] == 14 * 24
