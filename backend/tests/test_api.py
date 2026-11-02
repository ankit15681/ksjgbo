from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)


def test_day_and_real_snapshot():
    response = client.get('/api/day?decision_date=2026-01-31&cutoff=09:00')
    assert response.status_code == 200
    data = response.json()
    assert data['delivery_date'] == '2026-02-01'
    assert len(data['rows']) == 24
    for row in data['rows']:
        assert row['publish_time'] is None or row['publish_time'] <= data['cutoff']


def test_invalid_parameters():
    for query in ['decision_date=2026-02-01', 'cutoff=25:00', 'cutoff=09:00:01', 'cutoff=09:00Z']:
        assert client.get('/api/day?' + query).status_code == 422


def test_month_and_export():
    response = client.get('/api/month?cutoff=09:00')
    assert response.status_code == 200
    assert response.json()['metrics']['expected_hours'] == 744
    export = client.get('/api/export?scope=month')
    assert export.status_code == 200
    assert len(export.text.splitlines()) == 745
    assert 'decision_cutoff' in export.text.splitlines()[0]


def test_all_month_forecasts_obey_cutoff():
    for day in range(1, 32):
        response = client.get(f'/api/day?decision_date=2026-01-{day:02d}&cutoff=00:00').json()
        assert len(response['rows']) == 24
        for row in response['rows']:
            assert row['publish_time'] is None or row['publish_time'] <= response['cutoff']
