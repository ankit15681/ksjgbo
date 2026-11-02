import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Analytics, Comparison } from "../types";
import { useApi } from "../api";
import { number, dateLabel } from "../format";
import { Panel, chartAxis, LoadState } from "../components/charts";
export function AccuracyView({
  data,
  prep,
  onDay,
  onAuction,
}: {
  data: Analytics;
  prep: number;
  onDay: (d: string) => void;
  onAuction: (id: string) => void;
}) {
  const compare = useApi<Comparison>(`/api/compare?prep=${prep}`);
  return (
    <>
      <section className="panel comparison">
        <div className="panel-heading">
          <div>
            <h2>Compare auction decision times</h2>
            <p>
              Official forecasts only · {prep} minutes of preparation · select
              an auction to apply it.
            </p>
          </div>
        </div>
        <LoadState {...compare} />
        {compare.data && (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Auction</th>
                  <th>Cutoff (GMT)</th>
                  <th>MAE (MW)</th>
                  <th>RMSE (MW)</th>
                  <th>Bias (MW)</th>
                  <th>Matched hours</th>
                </tr>
              </thead>
              <tbody>
                {compare.data.auctions.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <button
                        className="text-link"
                        onClick={() => onAuction(a.id)}
                      >
                        {a.name}
                      </button>
                    </td>
                    <td>{a.cutoff}</td>
                    <td>{number(a.metrics.mae_mw, 1)}</td>
                    <td>{number(a.metrics.rmse_mw, 1)}</td>
                    <td>{number(a.metrics.bias_mw, 1)}</td>
                    <td>
                      {a.metrics.paired_hours}/{a.metrics.expected_hours}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <div className="diagnostic-summary">
        <span>
          90th percentile shortfall{" "}
          <strong>{number(data.metrics.p90_shortfall_mw)} MW</strong>
        </span>
        <span>
          Largest shortfall{" "}
          <strong>{number(data.metrics.worst_shortfall_mw)} MW</strong>
        </span>
        <span>
          Largest surplus{" "}
          <strong>{number(data.metrics.worst_surplus_mw)} MW</strong>
        </span>
        <small>
          Historical national forecast differences; not a customer purchase
          recommendation.
        </small>
      </div>
      <div className="analysis-grid">
        <Panel
          title="Error by decision day"
          note="Mean absolute error and signed bias; delivery is the following day."
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.days} accessibilityLayer>
              <CartesianGrid vertical={false} stroke="#edf0f3" />
              <XAxis
                dataKey="decision_date"
                tickFormatter={(v) => String(Number(v.slice(-2)))}
                {...chartAxis}
              />
              <YAxis width={65} {...chartAxis} />
              <Tooltip />
              <ReferenceLine y={0} stroke="#aab7c0" />
              <Bar
                dataKey="bias_mw"
                name="Bias MW"
                fill="#cf8655"
                isAnimationActive={false}
              />
              <Line
                dataKey="mae_mw"
                name="MAE MW"
                stroke="#258595"
                dot={false}
                strokeWidth={2}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>
        <Panel
          title="Error by forecast horizon"
          note="Every nonnegative-lead publication, grouped in 6-hour bins. Samples repeat delivery targets; this is descriptive, not a causal test."
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.horizon} accessibilityLayer>
              <CartesianGrid vertical={false} stroke="#edf0f3" />
              <XAxis
                dataKey="from_h"
                tickFormatter={(v) => `${v}h`}
                {...chartAxis}
              />
              <YAxis width={65} {...chartAxis} />
              <Tooltip />
              <Area
                dataKey="mae_mw"
                name="MAE MW"
                stroke="#258595"
                fill="#e2f1f2"
                isAnimationActive={false}
              />
              <Line
                dataKey="bias_mw"
                name="Bias MW"
                stroke="#cf8655"
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>
        <Panel
          title="Error by delivery hour"
          note="Hourly mean absolute error across all January decisions."
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.by_hour} accessibilityLayer>
              <CartesianGrid vertical={false} stroke="#edf0f3" />
              <XAxis dataKey="hour" interval={5} {...chartAxis} />
              <YAxis width={65} {...chartAxis} />
              <Tooltip />
              <Bar
                dataKey="mae_mw"
                name="MAE MW"
                fill="#5b9da6"
                isAnimationActive={false}
              />
              <Line
                dataKey="bias_mw"
                name="Bias MW"
                stroke="#cf8655"
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>
        <Panel
          title="How errors are distributed"
          note="500 MW bins. Negative error means actual wind was below forecast."
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.histogram} accessibilityLayer>
              <CartesianGrid vertical={false} stroke="#edf0f3" />
              <XAxis
                dataKey="mid_mw"
                tickFormatter={(v) => `${number(v / 1000, 1)} GW`}
                minTickGap={25}
                {...chartAxis}
              />
              <YAxis width={45} {...chartAxis} />
              <Tooltip labelFormatter={(v) => `Bin midpoint ${v} MW`} />
              <Bar dataKey="count" name="Hours" isAnimationActive={false}>
                {data.histogram.map((b) => (
                  <Cell
                    key={b.from_mw}
                    fill={b.mid_mw < 0 ? "#cf8655" : "#5b9da6"}
                  />
                ))}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>
        <Panel
          title="Forecast against actual"
          note="One point per matched hour. Points below the diagonal have less wind than forecast."
        >
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart accessibilityLayer>
              <CartesianGrid stroke="#edf0f3" />
              <XAxis
                type="number"
                dataKey="forecast_mw"
                name="Forecast"

                tickFormatter={(v) => `${v / 1000} GW`}
                domain={[0, "dataMax"]}
                {...chartAxis}
              />
              <YAxis
                type="number"
                dataKey="actual_mw"
                name="Actual"

                width={65}
                tickFormatter={(v) => `${v / 1000} GW`}
                domain={[0, "dataMax"]}
                {...chartAxis}
              />
              <Tooltip />
              <ReferenceLine
                segment={[
                  { x: 0, y: 0 },
                  { x: 25000, y: 25000 },
                ]}
                stroke="#778a97"
                strokeDasharray="4 4"
                ifOverflow="extendDomain"
              />
              <Scatter
                data={data.scatter}
                fill="#258595"
                fillOpacity={0.35}
                isAnimationActive={false}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </Panel>
        <section className="panel reading-notes">
          <h2>Keep the interpretation grounded</h2>
          <p>
            Bias is actual minus forecast. A negative value means wind was
            overforecast. Shortfall and surplus summaries are clamped at zero,
            so “no surplus” never appears as a negative surplus.
          </p>
          <p>
            National forecast errors do not establish the cause of a miss.
            Weather, generation coverage and curtailment can matter, but these
            two datasets alone cannot separate their effects.
          </p>
          <p>
            The forecast correction and historical ranges live in the separate
            Experimental lab. The charts on this page always evaluate the
            official forecast.
          </p>
        </section>
      </div>
      <section className="panel month-table">
        <div className="panel-heading">
          <div>
            <h2>Inspect each decision</h2>
            <p>
              Full-day energy uses both actual half-hours. Incomplete periods
              show no energy total.
            </p>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Decision date</th>
                <th>Delivery date</th>
                <th>MAE MW</th>
                <th>Bias MW</th>
                <th>Forecast GWh</th>
                <th>Actual GWh</th>
                <th>Matched hours</th>
              </tr>
            </thead>
            <tbody>
              {data.days.map((d) => (
                <tr key={d.decision_date}>
                  <td>
                    <button
                      className="text-link"
                      onClick={() => onDay(d.decision_date)}
                    >
                      {dateLabel(d.decision_date, {
                        day: "numeric",
                        month: "short",
                      })}
                    </button>
                  </td>
                  <td>
                    {dateLabel(d.delivery_date, {
                      day: "numeric",
                      month: "short",
                    })}
                  </td>
                  <td>{number(d.mae_mw, 1)}</td>
                  <td>{number(d.bias_mw, 1)}</td>
                  <td>{number(d.forecast_gwh, 1)}</td>
                  <td>{number(d.actual_gwh, 1)}</td>
                  <td>
                    {d.paired_hours}/{d.expected_hours}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
