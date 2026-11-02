import type { Meta } from "../types";
import { number, publication } from "../format";
import { ArrowUpRight } from "lucide-react";
export function Methodology({ meta }: { meta: Meta | null }) {
  return (
    <section className="methodology panel">
      <h2>Designed around the decision time</h2>
      <p>
        This pilot replays purchase decisions made from 1–31 January 2026, for
        delivery on the following day (2 January–1 February). It uses Elexon’s
        national wind datasets only.
      </p>
      <h3>What was known at the time?</h3>
      <p>
        For each delivery hour, we select the latest WINDFOR publication at or
        before the chosen cutoff on the previous day. Revisions published after
        the cutoff are excluded. The default is the EPEX hourly auction with 30
        minutes of preparation: 08:50 London time. Auction presets use gate
        closure minus preparation time; you can also enter a custom cutoff.
        Presets describe the January pilot, not live exchange schedules.
      </p>
      <h3>Aligning forecasts and actuals</h3>
      <p>
        WINDFOR is hourly. FUELHH reports half-hourly power in MW. We average
        the two half-hour actual readings for each hour before comparing them
        with the hourly forecast. This treats the forecast as representative of
        the hour; it is an explicit modelling assumption. If either half-hour is
        missing, the actual hour is unavailable. The most recently published
        actual in the saved snapshot is used.
      </p>
      <h3>How to read the metrics</h3>
      <dl>
        <dt>Mean absolute error (MAE)</dt>
        <dd>
          Average absolute difference between actual and forecast. Every matched
          hour has equal weight.
        </dd>
        <dt>Root mean square error (RMSE)</dt>
        <dd>
          Square root of the average squared error. Larger misses have a greater
          influence.
        </dd>
        <dt>Bias</dt>
        <dd>
          Average of actual minus forecast. Negative bias means less wind was
          generated than forecast; positive bias means more.
        </dd>
        <dt>Coverage</dt>
        <dd>
          Hours with both a forecast and a complete actual, divided by expected
          delivery hours. Missing values are never treated as zero.
        </dd>
      </dl>
      <h3>What this analysis cannot tell you</h3>
      <p>
        This is a historical accuracy analysis, not a calibrated prediction
        interval or an automated purchase recommendation. Elexon’s wind series
        cover the generation visible in these datasets, not every embedded wind
        asset. Customer demand, contracts, prices and other generation are
        outside the scope. Without them, the app cannot calculate your purchase
        requirement.
      </p>
      <h3>Experimental estimates</h3>
      <p>
        The separate Experimental lab uses a fixed 14-day rolling linear
        correction. For delivery D, training includes complete days D−15 through
        D−2 and only actual publications available before the decision cutoff. A
        minimum of 48 matched hours and nonzero forecast variance are required.
        Reported official and corrected monthly metrics use the same eligible
        hours.
      </p>
      <p>
        Historical hourly ranges use the official forecast errors’ 10th and 90th
        percentiles, shifted by the forecast and clipped at zero. This is a
        nominal central 80% range with a 90% one-sided lower target. Measured
        coverage is shown, and no daily-energy confidence claim is made. The
        rule was not selected on an independent development set; results are
        descriptive rolling evaluations.
      </p>
      <h3>Reproducible source data</h3>
      <p>
        The app serves a saved Elexon snapshot, so reviewing a decision does not
        depend on a live upstream API. Publication time is used as the
        availability proxy; transmission latency is not modelled. Timestamps are
        stored in UTC and displayed in Europe/London, which is GMT throughout
        this study.
      </p>
      {meta && (
        <p className="snapshot-detail">
          Retrieved {publication(meta.retrieved_at)} GMT ·{" "}
          {number(meta.forecast_count)} forecast records ·{" "}
          {number(meta.actual_count)} actual records.
        </p>
      )}
      <div className="source-links">
        <a
          href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream"
          target="_blank"
          rel="noreferrer"
        >
          WINDFOR documentation
          <ArrowUpRight size={14} />
        </a>
        <a
          href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream"
          target="_blank"
          rel="noreferrer"
        >
          FUELHH documentation
          <ArrowUpRight size={14} />
        </a>
      </div>
    </section>
  );
}
