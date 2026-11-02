import { useState } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Info, Clock3, Wind, Table2, ChevronRight } from "lucide-react";
import type { Day } from "../types";
import { number, dateLabel, publication } from "../format";
import { chartAxis } from "../components/charts";
import { EvolutionView } from "../components/EvolutionView";
export function DecisionView({
  day,
  onAccuracy,
}: {
  day: Day;
  onAccuracy: () => void;
}) {
  const [showActual, setShowActual] = useState(true);
  const [table, setTable] = useState(false);
  const forecasts = day.rows.filter((r) => r.forecast_mw !== null);
  const pubs = [...new Set(forecasts.map((r) => r.publish_time!))].sort();
  const peak = forecasts.length
    ? forecasts.reduce((a, b) => (a.forecast_mw! > b.forecast_mw! ? a : b))
    : null;
  return (
    <>
      <div className="chart-layout">
        <section className="panel main-chart">
          <div className="panel-heading">
            <div>
              <h2>Tomorrow’s wind, in focus</h2>
              <p>{dateLabel(day.delivery_date)} · hourly average power</p>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={showActual}
                onChange={(e) => setShowActual(e.target.checked)}
              />
              Show actuals
            </label>
          </div>
          <div className="chart-legend">
            <span>
              <i className="legend-forecast" />
              Available forecast
            </span>
            {showActual && (
              <span>
                <i className="legend-actual" />
                Actual generation
              </span>
            )}
            <span className="unit-label">MW</span>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={day.rows}
                margin={{
                  top: 10,
                  right: 15,
                  bottom: 10,
                  left: 4,
                }}
                accessibilityLayer
              >
                <defs>
                  <linearGradient id="windFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#388f9c" stopOpacity={0.17} />
                    <stop
                      offset="100%"
                      stopColor="#388f9c"
                      stopOpacity={0.01}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#edf0f3" />
                <XAxis dataKey="hour" interval={3} {...chartAxis} />
                <YAxis
                  {...chartAxis}
                  width={60}
                  tickFormatter={(v) => number(v)}
                />
                <Tooltip
                  formatter={(v, n) => [
                    `${number(typeof v === "number" ? v : null, 1)} MW`,
                    n,
                  ]}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #dbe3e8",
                  }}
                />
                <Area
                  name="Available forecast"
                  dataKey="forecast_mw"
                  type="linear"
                  stroke="#258595"
                  strokeWidth={2.5}
                  fill="url(#windFill)"
                  isAnimationActive={false}
                />
                {showActual && (
                  <Line
                    name="Actual generation"
                    dataKey="actual_mw"
                    type="linear"
                    stroke="#344e74"
                    strokeWidth={2.5}
                    strokeDasharray="5 4"
                    dot={false}
                    isAnimationActive={false}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-caption">
            <Info size={15} />
            Actuals are shown for retrospective evaluation and were not
            available at the decision cutoff.
          </div>
        </section>
        <aside className="insight-panel">
          <span className="insight-icon">
            <Wind size={25} />
          </span>
          <h2>The decision picture</h2>
          <p>National wind availability for the next delivery day.</p>
          <div className="insight-stat">
            <span>Peak forecast</span>
            <strong>
              {number(peak?.forecast_mw)} <small>MW</small>
            </strong>
            <span>
              {peak ? `At ${peak.hour} GMT` : "No forecast available"}
            </span>
          </div>
          <div className="insight-detail">
            <Clock3 size={17} />
            <div>
              <strong>Publication window</strong>
              <span>
                {pubs.length
                  ? publication(pubs[0])
                  : "No eligible publications"}
                {pubs.length > 1
                  ? ` to ${publication(pubs[pubs.length - 1])}`
                  : ""}
              </span>
            </div>
          </div>
          <p className="insight-note">
            Wind is one part of your position. Customer demand and existing
            purchases are needed to calculate a procurement volume.
          </p>
          <button onClick={onAccuracy}>
            Explore January accuracy
            <ChevronRight size={17} />
          </button>
        </aside>
      </div>
      <section className="panel error-chart">
        <div className="panel-heading">
          <div>
            <h2>Where the forecast missed</h2>
            <p>
              Actual minus forecast · negative values indicate less wind than
              expected
            </p>
          </div>
          <span className="error-key">
            <i />
            Error in MW
          </span>
        </div>
        <div className="small-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={day.rows}
              margin={{ right: 16, left: 4 }}
              accessibilityLayer
            >
              <CartesianGrid vertical={false} stroke="#edf0f3" />
              <XAxis dataKey="hour" interval={3} {...chartAxis} />
              <YAxis {...chartAxis} width={60} />
              <Tooltip
                formatter={(v) => [
                  `${number(typeof v === "number" ? v : null, 1)} MW`,
                  "Forecast error",
                ]}
              />
              <ReferenceLine y={0} stroke="#8d9aa6" />
              <Bar
                dataKey="error_mw"
                fill="#cf8655"
                radius={[2, 2, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section className="panel detail-panel">
        <button
          className="table-toggle"
          aria-expanded={table}
          onClick={() => setTable(!table)}
        >
          <span>
            <Table2 size={18} />
            Hourly data & forecast provenance
          </span>
          <span>
            {table ? "Hide details" : "View 24 hours"}
            <ChevronRight size={16} className={table ? "rotated" : ""} />
          </span>
        </button>
        {table && (
          <div className="table-scroll">
            <table>
              <caption className="sr-only">
                Hourly wind forecast and actual generation, MW. Publication
                times in London time.
              </caption>
              <thead>
                <tr>
                  <th>Delivery hour</th>
                  <th>Forecast MW</th>
                  <th>Actual MW</th>
                  <th>Error MW</th>
                  <th>Published (GMT)</th>
                  <th>Lead time</th>
                </tr>
              </thead>
              <tbody>
                {day.rows.map((r) => (
                  <tr key={r.start_time}>
                    <td>{r.hour}</td>
                    <td>{number(r.forecast_mw, 1)}</td>
                    <td>{number(r.actual_mw, 1)}</td>
                    <td>{number(r.error_mw, 1)}</td>
                    <td>{publication(r.publish_time)}</td>
                    <td>{r.lead_hours == null ? "—" : `${r.lead_hours} h`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <EvolutionView day={day} />
    </>
  );
}
