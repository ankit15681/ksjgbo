# Local verification

Updated 30 October 2026 for the combined implementation.

All 25 backend tests pass locally and inside the rebuilt Docker image. The production TypeScript/Vite build and final browser regression suite pass. The refreshed snapshot contains 26,624 forecast records and 2,208 half-hour actual records.

The regression suite covers point-in-time selection, actual publication availability for training, missing hours, complete-period energy, consistent error signs, physical lower bounds, experimental isolation, API validation and the January/February boundary. The first January decision is checked for a full 14-day warm-up window.

Browser smoke checks exercise auction selection, preparation/cutoff changes, monthly diagnostics and drilldown, forecast publication comparisons, hindsight labels, the separate experimental lab, CSV export, methodology, phone layouts and delayed/failed request isolation. A changed request identity hides old results immediately, so a new setting cannot relabel old data.

Desktop and mobile screenshots were inspected. Mobile navigation icon sizing and duplicate scatter-axis units were corrected. A GitHub Actions workflow now runs backend tests, the frontend build and browser smoke checks; hosted CI execution remains unverified until the repository is published.

The Docker image builds the React frontend and serves it using Python 3.12 as a non-root user. The API verifies the saved Elexon snapshot's checksum. Dependency deprecation notices may appear in test output; they are not failed tests.

The demo video has been recorded and edited to 9:35 (customer overview 4:57, technical overview 4:40).

The Vercel deployment at https://ksjgbo.vercel.app was checked without signing in: every API endpoint returns 200 (a February date correctly returns 422), January metrics match the local results (MAE 2,038.9 MW, bias −1,747.9 MW), January 31 maps to February 1 delivery, and the decision, accuracy and experimental views load without browser errors. The public repository opens without signing in.
