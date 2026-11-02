import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useApi } from "../api";
import type { Day, Evolution } from "../types";
import { number, publication } from "../format";
import { chartAxis, LoadState } from "./charts";
export function EvolutionView({ day }: { day: Day }) {
  const query = useApi<Evolution>(
    `/api/evolution?decision_date=${day.decision_date}&cutoff=${day.cutoff.slice(11, 16)}`,
  );
  const [selected, setSelected] = useState("");
  const data = query.data;
  const run =
    data?.runs.find((r) => r.publish_time === selected) ??
    [...(data?.runs ?? [])].reverse().find((r) => r.selected_hours > 0);
  const points = day.rows.map((r, i) => ({
    ...r,
    run_mw: run?.points[i]?.forecast_mw ?? null,
  }));
  return (
    <section className="panel evolution">
      <div className="panel-heading">
        <div>
          <h2>How the forecast evolved</h2>
          <p>
            Choose a publication to compare it with the forecast available at
            your cutoff.
          </p>
        </div>
      </div>
      <LoadState {...query} />
      {data && (
        <>
          <div className="energy-strip">
            <span>
              Full-day forecast{" "}
              <strong>{number(data.energy.forecast_gwh, 1)} GWh</strong>
            </span>
            <span>
              Actual energy{" "}
              <strong>{number(data.energy.actual_gwh, 1)} GWh</strong>
            </span>
            <small>Totals are unavailable if any hour is missing.</small>
          </div>
          <div
            className="run-list"
            role="group"
            aria-label="Forecast publications"
          >
            {data.runs.map((r) => (
              <button
                key={r.publish_time}
                className={`${r.available ? "available" : "later"} ${run?.publish_time === r.publish_time ? "active" : ""}`}
                aria-pressed={run?.publish_time === r.publish_time}
                onClick={() => setSelected(r.publish_time)}
              >
                <span>{publication(r.publish_time)}</span>
                <small>
                  {r.selected_hours
                    ? `Used for ${r.selected_hours}h`
                    : r.available
                      ? "Available before decision"
                      : "After decision · hindsight"}
                </small>
              </button>
            ))}
          </div>
          {run && !run.available && (
            <p className="notice">
              This publication was unavailable at the decision cutoff. It is
              shown only for retrospective comparison.
            </p>
          )}
          <div className="chart-legend">
            <span>
              <i className="legend-forecast" />
              Decision forecast
            </span>
            <span>
              <i className="legend-run" />
              Selected publication ({run?.forecast_hours ?? 0}/24 hours)
            </span>
          </div>
          <div className="analysis-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} accessibilityLayer>
                <CartesianGrid vertical={false} stroke="#edf0f3" />
                <XAxis dataKey="hour" interval={3} {...chartAxis} />
                <YAxis width={65} {...chartAxis} />
                <Tooltip />
                <Line
                  dataKey="forecast_mw"
                  name="Decision forecast MW"
                  stroke="#258595"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  dataKey="run_mw"
                  name="Selected publication MW"
                  stroke="#a56d35"
                  strokeDasharray="5 3"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </section>
  );
}
