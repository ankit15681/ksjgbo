import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useApi } from "../api";
import type { Experiment } from "../types";
import { number, dateLabel } from "../format";
import { Metric } from "../components/Metric";
import { chartAxis, LoadState } from "../components/charts";
export function ExperimentView({
  date,
  cutoff,
}: {
  date: string;
  cutoff: string;
}) {
  const query = useApi<Experiment>(
    `/api/experiment?decision_date=${date}&cutoff=${cutoff}`,
  );
  const data = query.data;
  return (
    <>
      <div className="experiment-intro">
        <strong>Experimental analysis · not a purchase recommendation</strong>
        <p>
          The official forecast remains unchanged everywhere else. This lab
          tests a fixed rolling linear correction and a separate historical
          hourly range. Neither is a guaranteed prediction interval.
        </p>
      </div>
      <LoadState {...query} />
      {data && (
        <>
          <div className="metrics">
            <Metric
              label="Official MAE · matched experiment hours"
              value={number(data.month.official_same_hours.mae_mw)}
              unit="MW"
              note={`${data.month.evaluation_hours}/${data.month.expected_hours} January hours evaluated`}
            />
            <Metric
              label="Rolling correction MAE · same hours"
              value={number(data.month.corrected_same_hours.mae_mw)}
              unit="MW"
              note="Descriptive walk-forward evaluation"
            />
            <Metric
              label="Above historical lower estimate"
              value={number(data.month.lower_hit_pct, 1)}
              unit="%"
              note="Observed hourly rate; nominal target 90%"
            />
            <Metric
              label="Inside historical hourly range"
              value={number(data.month.band_hit_pct, 1)}
              unit="%"
              note="Observed rate; nominal central range 80%"
            />
          </div>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>
                  Correction for{" "}
                  {dateLabel(data.day.decision_date, {
                    day: "numeric",
                    month: "short",
                  })}
                  ’s decision
                </h2>
                <p>
                  {data.day.history_hours} eligible history hours · only
                  complete delivery days through D−2 · actual publications must
                  precede the cutoff.
                </p>
              </div>
            </div>
            {data.day.slope === null && (
              <p className="notice">
                Insufficient or constant forecast history. No corrected estimate
                is produced.
              </p>
            )}
            <div className="chart-legend">
              <span>
                <i className="legend-forecast" />
                Official forecast
              </span>
              <span>
                <i className="legend-run" />
                Rolling correction
              </span>
              <span>
                <i className="legend-actual" />
                Actual
              </span>
            </div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data.day.rows} accessibilityLayer>
                  <CartesianGrid vertical={false} stroke="#edf0f3" />
                  <XAxis dataKey="hour" interval={3} {...chartAxis} />
                  <YAxis width={65} {...chartAxis} />
                  <Tooltip />
                  <Line
                    dataKey="forecast_mw"
                    name="Official MW"
                    stroke="#258595"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    dataKey="corrected_mw"
                    name="Corrected MW"
                    stroke="#a56d35"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    dataKey="actual_mw"
                    name="Actual MW"
                    stroke="#344e74"
                    strokeDasharray="4 4"
                    dot={false}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="chart-caption">
              {data.day.slope !== null
                ? `Fit: actual ≈ ${number(data.day.intercept_mw)} + ${number(data.day.slope, 3)} × forecast, clipped at zero.`
                : "A fit requires at least 48 matched history hours and nonzero forecast variance."}
            </p>
          </section>
          <section className="panel evolution">
            <div className="panel-heading">
              <div>
                <h2>Historical hourly range around the official forecast</h2>
                <p>
                  Previous 14 complete eligible days’ 10th–90th error
                  percentiles, shifted by each official forecast and clipped at
                  zero.
                </p>
              </div>
            </div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={data.day.rows.map((r) => ({
                    ...r,
                    range:
                      r.lower_mw === null || r.upper_mw === null
                        ? null
                        : [r.lower_mw, r.upper_mw],
                  }))}
                  accessibilityLayer
                >
                  <CartesianGrid vertical={false} stroke="#edf0f3" />
                  <XAxis dataKey="hour" interval={3} {...chartAxis} />
                  <YAxis width={65} {...chartAxis} />
                  <Tooltip />
                  <Area
                    dataKey="range"
                    name="Historical range MW"
                    fill="#dfecee"
                    stroke="#8db4bd"
                    isAnimationActive={false}
                  />
                  <Line
                    dataKey="forecast_mw"
                    name="Official MW"
                    stroke="#258595"
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    dataKey="actual_mw"
                    name="Actual MW"
                    stroke="#344e74"
                    dot={false}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </section>
          <section className="panel reading-notes experiment-notes">
            <h2>What was tested—and what wasn’t</h2>
            <p>
              For delivery D, fit actual = intercept + slope × forecast using
              delivery days D−15 through D−2. The fixed 14-day rule is
              illustrative; we do not claim it was selected on an independent
              development set. The monthly results are a rolling retrospective
              evaluation, not proof of future improvement.
            </p>
            <p>
              The hourly range uses errors of the official forecast, not fitted
              residuals from the correction. Its central 80% nominal range has a
              one-sided lower target of 90%. Observed rates are shown above.
              Hourly bounds are never summed into a daily GWh confidence claim.
            </p>
            <p>
              Saved actual publication timestamps are checked before training.
              If a later revision is the only saved value, the hour is excluded
              rather than assuming it was available earlier. No missing values
              become zero.
            </p>
          </section>
        </>
      )}
    </>
  );
}
