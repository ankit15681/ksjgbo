# Wind desk

A day-ahead wind forecast dashboard for a GB electricity procurement team. Replay January 2026 decisions using only forecasts published before a configurable cutoff, then compare them with actual generation.

- **Live app:** _Vercel URL to be added_
- **Demo video:** _unlisted YouTube URL to be added_

## Start with Docker

```sh
docker compose up --build
```

Open http://localhost:8000. API documentation is at http://localhost:8000/docs. The image builds the React application, serves it from FastAPI and runs as a non-root user. The committed Elexon snapshot means no credentials or initial download are required.

## Local development

Use Python 3.12 and Node.js 22 or newer. Python 3.14 was also tested locally, but 3.12 matches the container and deployment target.

```sh
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
npm ci --prefix frontend
uvicorn backend.main:app --reload --port 8000
```

In a second terminal:

```sh
npm run dev --prefix frontend
```

Open http://localhost:5173. Vite forwards `/api` requests to the Python server. For a single-server production preview, run `npm run build --prefix frontend`, then start/restart Uvicorn and open port 8000.

## What the application does

- Decision desk: next-day hourly forecast, optional actual overlay, error chart, publication provenance and CSV export.
- Forecast accuracy: January-wide MAE, RMSE, signed bias and matched coverage, auction comparisons, horizon and hour-of-day analysis, error distributions and scatter plots; drill into individual decisions.
- Forecast evolution: inspect publications before and after the cutoff, with hindsight clearly marked and full-day energy reported only for complete periods.
- Experimental lab: optional rolling linear correction plus separately evaluated historical hourly ranges. Official forecasts elsewhere remain unchanged.
- Methodology: source definitions, timing assumptions, aggregation, missing-data policy and business limitations.
- Loading, unavailable-data and retry states; responsive desktop/mobile layouts and keyboard-accessible native controls.

The default scenario is EPEX hourly at 09:20 with 30 minutes of preparation, giving an 08:50 Europe/London decision cutoff. N2EX hourly (09:50), EPEX half-hourly (15:30), and a custom cutoff are available. These are historical pilot presets, not live market schedules. All January times are GMT (UTC+0); all forecast comparisons remain hourly. Source links are returned by `/api/auctions`.

## Analytical contract

1. A decision on date D concerns delivery on D+1. January 1–31 decisions therefore cover January 2–February 1 delivery.
2. For **each target hour**, select the latest WINDFOR record with `publishTime <= decision cutoff`. Later revisions are excluded even though they are present in the snapshot.
3. Forecast values are hourly MW. Actual FUELHH values are half-hourly MW. Compare the forecast with the arithmetic mean of the actuals at HH:00 and HH:30. Treating the hourly forecast as representative of the hour is a modelling assumption, not interpolation or a claim of exact temporal equivalence.
4. Use the latest published actual value in the snapshot for each half-hour. Actuals are retrospective outcomes, not information available at decision time.
5. If a forecast or either actual half-hour is missing, exclude that hour from error metrics and report reduced coverage. Never fill with zero. Genuine zero values remain valid.
6. Error = actual − forecast. MAE = mean absolute error; RMSE = square root of mean squared error; bias = mean signed error. Negative bias means overforecast wind. Monthly calculations weight every matched hour equally, not every day equally.
7. Publication time is a proxy for availability. Data transmission delays are not modelled. Historical publications and actuals include a December warm-up window. Experimental fitting also checks actual publication availability and excludes incomplete D−1 delivery data.

These datasets describe Elexon's visible wind generation, not a customer's demand or contractual position. Dataset coverage and temporal alignment can contribute to measured differences. Do not attribute all error to weather or translate it directly into a purchase recommendation. No confidence intervals or price forecasts are claimed.

## Experimental analysis

The lab fits `actual = intercept + slope × forecast` on the previous 14 eligible complete delivery days (D−15 through D−2), requiring at least 48 matched hours and nonzero forecast variance. Estimates are clipped at zero. Only actual records published before the current simulated decision enter training; if the only saved revision is later, that hour is excluded. The fixed rule is illustrative and was not chosen using a claimed independent development split. Official and corrected monthly scores use identical eligible hours.

A separate range uses the official forecast errors' 10th and 90th percentiles from that history, shifted by each forecast and clipped at zero. It is a nominal central 80% hourly range with a one-sided lower target of 90%; actual retrospective coverage is shown. These bounds are not summed into a daily GWh confidence claim. No curtailment causality or customer procurement requirement is inferred.

## Data and reproducibility

Source endpoints:

- [WINDFOR forecast publications](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream)
- [FUELHH actual generation](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream), filtered to `fuelType=WIND`
- [Elexon wind generation context](https://bmrs.elexon.co.uk/wind-generation)

`data/snapshot.json` contains real, normalized Elexon records, not generated demonstration data. `data/metadata.json` records every request URL, retrieval timestamp, record counts and the SHA-256 checksum verified by the API at startup/first use.

Refresh from the repository root (internet access required):

```sh
python scripts/ingest.py
```

The script downloads daily publication windows from December 15 through January 31 and actuals for December 18 through February 1, validates duplicate keys and preserves the existing snapshot if a request fails. Restart the server after refresh to clear the in-memory cache. Refresh is an offline maintenance operation; the public API exposes no write endpoint.

At 09:00, the initial snapshot has 744/744 matched hours, MAE 2,038.9 MW, RMSE 2,504.8 MW and bias −1,747.9 MW. These are descriptive retrospective results for this snapshot and aggregation policy.

## Structure

| Path | Purpose |
| --- | --- |
| `frontend/src/main.tsx`, `App.tsx` | Entry point, navigation and shared decision settings |
| `frontend/src/views/` | Decision, accuracy, experiment and methodology views |
| `frontend/src/components/` | Auction settings, publication selector, metrics and chart helpers |
| `frontend/src/api.ts`, `types.ts`, `format.ts` | Abortable request hook, contracts and display formatting |
| `frontend/src/style.css` | Responsive layout and visual system |
| `frontend/vite.config.ts` | Development proxy and production build |
| `backend/analysis.py` | Pure forecast selection, hourly alignment and metric calculations |
| `backend/insights.py` | Auction scenarios, diagnostics, energy, forecast evolution and experimental analysis |
| `.github/workflows/ci.yml` | Backend, production build and browser checks on push/PR |
| `backend/main.py` | FastAPI routes, snapshot integrity check, CSV and static hosting |
| `backend/tests/` | Selection, missing data, revisions, boundaries and API tests |
| `scripts/ingest.py` | Reproducible Elexon data ingestion with bounded retries |
| `scripts/browser-smoke.cjs` | Browser interaction and responsive smoke checks |
| `data/` | Normalized source snapshot and provenance metadata |
| `api/index.py`, `vercel.json` | Vercel Python entry point and frontend routing configuration |
| `Dockerfile`, `compose.yaml` | Container build and local orchestration |
| `docs/` | Design decisions and verification notes |

## API

- `GET /api/day?decision_date=2026-01-14&cutoff=09:00`
- `GET /api/month?cutoff=09:00`
- `GET /api/export?decision_date=2026-01-14&cutoff=09:00&scope=day` (or `scope=month`)
- `GET /api/auctions`
- `GET /api/evolution?decision_date=2026-01-14&cutoff=08:50`
- `GET /api/analytics?cutoff=08:50`
- `GET /api/compare?prep=30`
- `GET /api/experiment?decision_date=2026-01-14&cutoff=08:50`
- `GET /api/metadata`
- `GET /api/health`

Dates outside January and malformed cutoffs return 422. Missing or invalid snapshots return 503. The API is read-only and needs no authentication for the public pilot data.

## Tests

```sh
python -m pytest backend/tests -q
npm run build --prefix frontend
```

Browser smoke test, with the production preview running on port 8000:

```sh
cd frontend
npx playwright install chromium
cd ..
NODE_PATH=frontend/node_modules node scripts/browser-smoke.cjs
```

If Google Chrome is already installed, set `BROWSER_CHANNEL=chrome` instead of downloading Chromium. The smoke test checks cutoff changes, monthly drilldown, January 31, CSV download, the detail table, methodology, mobile overflow and recovery from a failed API request. Screenshots are written to the system temporary directory.

Container verification:

```sh
docker build -t wind-desk:local .
docker run --rm wind-desk:local python -m pytest backend/tests -q -p no:cacheprovider
```

## Deployment and submission

The intended deployment is Vercel, with a Vite static build and a Python FastAPI function. Keep the repository root as the project root so `vercel.json`, `api/`, `backend/`, `data/` and `requirements.txt` are included. Validate `/api/health`, all three views and CSV exports after deployment. The deployment configuration has not yet been exercised on Vercel.

The Docker image is also compatible with a host that supplies `PORT`, including a Heroku container deployment. No deployment has been created automatically.

After deploying, add the app and video links at the top of this README and open each submitted link in an incognito window to confirm public access.

## AI assistance

AI tools were used in building this project:

- **OpenAI Codex** assisted with planning, Elexon API exploration, implementation, test creation, documentation and local verification.
- **Claude** was used for an earlier prototype of this assignment; its auction workflow, forecast-history and analytical ideas were reimplemented here with separate experimental outputs and additional data and state checks.
- **Claude Code** assisted with the demo video (slides, editing and captions) and repository clean-up.
