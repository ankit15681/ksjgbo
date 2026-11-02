from datetime import date, time
import pytest
from backend.analysis import WindData, metrics


def forecast(target, published, value):
    return {'startTime': target, 'publishTime': published, 'generation': value}


def test_cutoff_and_per_target_selection():
    target = '2026-01-02T00:00:00Z'
    later = '2026-01-02T01:00:00Z'
    data = WindData({'forecasts': [forecast(target, '2026-01-01T08:00:00Z', 100),
                                  forecast(target, '2026-01-01T09:00:00Z', 120),
                                  forecast(target, '2026-01-01T09:01:00Z', 999),
                                  forecast(later, '2026-01-01T07:00:00Z', 80)], 'actuals': []})
    rows = data.day(date(2026, 1, 1), time(9))['rows']
    assert rows[0]['forecast_mw'] == 120
    assert rows[1]['forecast_mw'] == 80
    assert rows[2]['forecast_mw'] is None
    assert rows[0]['actual_mw'] is None
    assert rows[0]['error_mw'] is None


def test_hourly_actuals_require_both_halves_and_preserve_zero():
    target = '2026-01-02T00:00:00Z'
    actuals = [forecast(target, '2026-01-02T01:00:00Z', 0),
               forecast('2026-01-02T00:30:00Z', '2026-01-02T01:00:00Z', 100),
               forecast('2026-01-02T01:00:00Z', '2026-01-02T02:00:00Z', 200)]
    data = WindData({'forecasts': [forecast(target, '2026-01-01T08:00:00Z', 70)], 'actuals': actuals})
    result = data.day(date(2026, 1, 1), time(9))
    assert result['rows'][0]['actual_mw'] == 50
    assert result['rows'][0]['error_mw'] == -20
    assert result['rows'][1]['actual_mw'] is None
    assert result['metrics']['paired_hours'] == 1


def test_metrics_known_values():
    rows = [{'forecast_mw': 10, 'actual_mw': 10 + e, 'error_mw': e} for e in [-3, 5]]
    result = metrics(rows)
    assert result['mae_mw'] == 4
    assert result['rmse_mw'] == 4.1
    assert result['bias_mw'] == 1
    assert metrics([])['mae_mw'] is None


def test_month_boundary():
    result = WindData({'forecasts': [], 'actuals': []}).day(date(2026, 1, 31), time(9))
    assert result['delivery_date'] == '2026-02-01'
    assert len(result['rows']) == 24
    assert result['rows'][-1]['start_time'] == '2026-02-01T23:00:00Z'
    assert result['metrics']['coverage_pct'] == 0


def test_conflicting_revisions_rejected():
    row = forecast('2026-01-02T00:00:00Z', '2026-01-01T08:00:00Z', 10)
    with pytest.raises(ValueError, match='Conflicting'):
        WindData({'forecasts': [row, {**row, 'generation': 20}], 'actuals': []})


def test_latest_actual_revision_used():
    rows = [forecast('2026-01-02T00:00:00Z', '2026-01-02T01:00:00Z', 10),
            forecast('2026-01-02T00:00:00Z', '2026-01-03T01:00:00Z', 30),
            forecast('2026-01-02T00:30:00Z', '2026-01-02T01:00:00Z', 50)]
    result = WindData({'forecasts': [], 'actuals': rows}).day(date(2026, 1, 1), time(9))
    assert result['rows'][0]['actual_mw'] == 40


def test_adding_future_revisions_cannot_change_historical_decision():
    rows = [forecast('2026-01-02T00:00:00Z', '2026-01-01T07:30:00Z', 500)]
    before = WindData({'forecasts': rows, 'actuals': []}).day(date(2026, 1, 1), time(9))
    rows.append(forecast('2026-01-02T00:00:00Z', '2026-01-01T09:30:00Z', 1000))
    after = WindData({'forecasts': rows, 'actuals': []}).day(date(2026, 1, 1), time(9))
    assert before == after


def test_forecast_before_first_publication_is_missing():
    rows = [forecast('2026-01-02T00:00:00Z', '2026-01-01T07:30:00Z', 500)]
    result = WindData({'forecasts': rows, 'actuals': []}).day(date(2026, 1, 1), time(7))
    assert result['rows'][0]['forecast_mw'] is None
    assert result['metrics']['forecast_hours'] == 0
