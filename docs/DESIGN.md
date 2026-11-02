# Design and architecture

The customer needs to understand the wind position at a specific purchase decision time and assess how much confidence to place in the forecast. A decision date and visible cutoff lead the interface; the forecast curve is the primary visual, with retrospective accuracy clearly distinguished.

## Visual direction

Use a slate navigation rail (`#263e54`), cool grey canvas (`#f5f7f9`), white work surfaces (`#ffffff`), teal forecast (`#258595`), blue actuals (`#344e74`) and muted orange errors (`#cf8655`). DM Sans supplies a compact, readable information hierarchy, with a system-font fallback. Tabular numerals keep measurements aligned. The wide curve comparison is the main visual; explanatory context occupies a narrower right column. Small screens collapse to one column.

The initial generic four-metric layout was retained only as a compact summary beneath the date controls; it does not replace the primary forecast chart. No decorative animation, gradients outside the chart fill, or unrelated stock imagery are used.

## Data flow

```text
Elexon WINDFOR / FUELHH
          |
 offline ingestion + provenance manifest
          |
 normalized JSON snapshot + checksum
          |
 FastAPI -> indexed forecast publications -> selection at cutoff
          |                                  |
          |                     hourly actual averages + metrics
          |                                  |
          +---------------------- read-only JSON / CSV
                                             |
                                      React dashboard
```

A fixed JSON snapshot is simpler to review and deploy than a database for a one-month, read-only pilot. It also isolates demo availability from upstream API uptime. All business calculations live in the Python layer. React formats values and renders API results without reimplementing accuracy logic.

Forecast lists are indexed per target timestamp, sorted by publication time, and searched with `bisect_right`. Actuals are deduplicated by latest publication. The dataset is loaded once per process and up to 64 monthly cutoff results are cached. Refreshing data requires restarting the API; there is no writable service filesystem dependency after deployment.

Views, controls, types and formatting are separate modules. The request hook keys responses by URL and retry identity during render, cancels obsolete requests with AbortController, and hides previous results while new settings load, so a changed date/cutoff cannot silently display stale metrics. Failed requests replace the result area with an explicit retry action.

## Boundaries and next steps

The pilot has no login, user uploads, live refresh, price model, portfolio model or purchase recommendations. Public data does not need authentication. Production expansion would require explicit market/cutoff configuration, source-coverage reconciliation, observability, ingestion scheduling, rate limiting and portfolio access control. None of these should obscure the assignment's core point-in-time analysis.

The forecast-hour to half-hour-actual alignment is documented as an assumption. For production decisions, confirm the forecast's exact period semantics and generation coverage with the data owner. Historical error alone does not establish a future risk distribution.

## Added analytical views

Auction presets subtract preparation time from gate closure; custom cutoffs remain available. Month and metadata requests are separate from day requests, so changing a day does not reload unchanged monthly data. Failure of secondary analysis does not suppress the primary decision view.

`insights.py` owns historical distributions, hourly/horizon grouping, complete-period energy and a separately cached experiment. Experimental training checks actual publication timestamps in addition to excluding incomplete days. The UI keeps official and corrected estimates in separate views, reports matched sample sizes, and measures hourly range coverage without promising daily-energy confidence.

The calendar strip reports errors by **decision** date, so January 31 consistently opens February 1 delivery. Forecast evolution uses a publication selector with available/hindsight states and per-target nulls. Partial publications never connect through missing points. Full-period energy requires every hour, and both the decision view and accuracy view call the same energy calculation.
