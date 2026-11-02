import { useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Database,
  FlaskConical,
  Wind,
} from "lucide-react";
import { useApi } from "./api";
import type { Analytics, Auction, Day, Meta, Month } from "./types";
import { dateLabel, number } from "./format";
import {
  SettingsBar,
  cutoffFor,
  type Settings,
} from "./components/SettingsBar";
import { Metric } from "./components/Metric";
import { LoadState } from "./components/charts";
import { DecisionView } from "./views/DecisionView";
import { AccuracyView } from "./views/AccuracyView";
import { ExperimentView } from "./views/ExperimentView";
import { Methodology } from "./views/Methodology";
type View = "decision" | "accuracy" | "experiment" | "methodology";
const titles: Record<View, string> = {
  decision: "A clearer view of tomorrow.",
  accuracy: "Know your forecast error.",
  experiment: "Test the idea. Measure the result.",
  methodology: "Every number, explained.",
};
export default function App() {
  const [view, setView] = useState<View>("decision");
  const [date, setDate] = useState("2026-01-14");
  const [settings, setSettings] = useState<Settings>({
    auction: "epex-60",
    prep: 30,
    custom: "09:00",
  });
  const meta = useApi<Meta>("/api/metadata");
  const auctions = useApi<{ auctions: Auction[] }>("/api/auctions");
  const cutoff = cutoffFor(settings, auctions.data?.auctions ?? []);
  const month = useApi<Month>(
    view === "decision" ? `/api/month?cutoff=${cutoff}` : null,
  );
  const day = useApi<Day>(
    view === "decision"
      ? `/api/day?decision_date=${date}&cutoff=${cutoff}`
      : null,
  );
  const analytics = useApi<Analytics>(
    view === "accuracy" ? `/api/analytics?cutoff=${cutoff}` : null,
  );
  const metrics =
    view === "decision" ? day.data?.metrics : analytics.data?.metrics;
  const dataReady = view === "decision" ? !!day.data : !!analytics.data;
  const forecasts = day.data?.rows.filter((r) => r.forecast_mw !== null) ?? [];
  const avg = forecasts.length
    ? forecasts.reduce((sum, r) => sum + r.forecast_mw!, 0) / forecasts.length
    : null;
  const choose = (d: string) => {
    setDate(d);
    setView("decision");
  };
  const shift = (amount: number) =>
    setDate(
      new Date(new Date(date).getTime() + amount * 86400000)
        .toISOString()
        .slice(0, 10),
    );
  const navigation = [
    { id: "decision" as View, label: "Decision desk", icon: Wind },
    {
      id: "accuracy" as View,
      label: "Forecast accuracy",
      icon: ChartNoAxesCombined,
    },
    { id: "experiment" as View, label: "Experimental lab", icon: FlaskConical },
    { id: "methodology" as View, label: "Methodology", icon: CircleHelp },
  ];
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setView("decision");
          }}
        >
          <span className="brand-mark">
            <Wind size={27} />
          </span>
          <span>
            wind<span className="brand-light">desk</span>
          </span>
        </a>
        <div className="workspace">
          <span className="workspace-symbol">GB</span>
          <div>
            Great Britain<small>National wind portfolio</small>
          </div>
        </div>
        <nav aria-label="Main navigation">
          {navigation.map((n) => (
            <button
              key={n.id}
              title={n.label}
              className={view === n.id ? "selected" : ""}
              onClick={() => setView(n.id)}
            >
              <n.icon size={19} />
              {n.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="archive-label">
            <span />
            January 2026 pilot
          </div>
          <p>
            Historical decisions.
            <br />
            Real Elexon data.
          </p>
          <div className="profile">
            <span>WD</span>
            <div>
              Procurement workspace<small>Day-ahead planning</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            Workspace <span>/</span>
            {navigation.find((n) => n.id === view)?.label}
          </div>
          <span className="source-badge">
            <Database size={14} />
            Elexon snapshot
          </span>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <h1>{titles[view]}</h1>
              <p>
                {view === "decision"
                  ? "The forecast available at your decision time, with the evidence behind it."
                  : view === "accuracy"
                    ? "Official forecasts evaluated consistently across January purchase decisions."
                    : view === "experiment"
                      ? "A separate workspace for rolling correction and historical ranges."
                      : "Source data, assumptions and analytical boundaries."}
              </p>
            </div>
            {(view === "decision" || view === "accuracy") && (
              <a
                className={`button export ${!dataReady ? "disabled" : ""}`}
                aria-disabled={!dataReady}
                tabIndex={dataReady ? 0 : -1}
                href={
                  dataReady
                    ? `/api/export?decision_date=${date}&cutoff=${cutoff}&scope=${view === "accuracy" ? "month" : "day"}`
                    : undefined
                }
              >
                <ArrowDownToLine size={16} />
                Export CSV
              </a>
            )}
          </div>
          {view !== "methodology" && (
            <>
              <LoadState {...auctions} />
              {auctions.data && (
                <SettingsBar
                  value={settings}
                  onChange={setSettings}
                  auctions={auctions.data.auctions}
                  cutoff={cutoff}
                />
              )}
              {view !== "accuracy" && (
                <section className="controls">
                  <div className="control-field">
                    <label htmlFor="decision-date">Decision date</label>
                    <div className="date-control">
                      <CalendarDays size={17} />
                      <input
                        id="decision-date"
                        type="date"
                        min="2026-01-01"
                        max="2026-01-31"
                        value={date}
                        onChange={(e) => {
                          if (
                            e.target.value >= "2026-01-01" &&
                            e.target.value <= "2026-01-31"
                          )
                            setDate(e.target.value);
                        }}
                      />
                      <button
                        aria-label="Previous decision day"
                        disabled={date === "2026-01-01"}
                        onClick={() => shift(-1)}
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        aria-label="Next decision day"
                        disabled={date === "2026-01-31"}
                        onClick={() => shift(1)}
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="delivery">
                    <span>Delivery day</span>
                    <strong>
                      {dateLabel(
                        new Date(
                          new Date(date).getTime() + 86400000,
                        ).toISOString(),
                      )}
                    </strong>
                  </div>
                  <span className="timezone-note">
                    GMT (UTC+0)<small>All January decisions</small>
                  </span>
                </section>
              )}
            </>
          )}
          {view === "decision" && (
            <>
              <div className="day-strip" aria-label="January decision dates">
                {Array.from({ length: 31 }, (_, i) => {
                  const d = `2026-01-${String(i + 1).padStart(2, "0")}`;
                  const m = month.data?.days.find(
                    (x) => x.decision_date === d,
                  )?.mae_mw;
                  return (
                    <button
                      key={d}
                      aria-label={`Decision ${i + 1} January`}
                      aria-pressed={d === date}
                      title={
                        m == null
                          ? "Accuracy unavailable"
                          : `MAE ${number(m)} MW`
                      }
                      className={d === date ? "active" : ""}
                      style={
                        m == null
                          ? undefined
                          : {
                              backgroundColor: `rgba(207,134,85,${Math.min(0.6, m / 8000)})`,
                            }
                      }
                      onClick={() => setDate(d)}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
              <p className="strip-note">
                January decision dates · darker shading indicates larger
                historical error at this cutoff.
              </p>
              {month.error && <LoadState {...month} />}
            </>
          )}
          {view === "methodology" ? (
            <>
              <LoadState {...meta} />
              <Methodology meta={meta.data ?? null} />
            </>
          ) : view === "experiment" ? (
            <ExperimentView
              key={`${date}-${cutoff}`}
              date={date}
              cutoff={cutoff}
            />
          ) : (
            <>
              <LoadState {...(view === "decision" ? day : analytics)} />
              {dataReady && metrics && (
                <>
                  <div className="context-line">
                    <span className="status-dot" />
                    {view === "decision" ? (
                      <>
                        Forecasts published by{" "}
                        <strong>
                          {cutoff} GMT on{" "}
                          {dateLabel(date, { day: "numeric", month: "short" })}
                        </strong>
                      </>
                    ) : (
                      <>
                        Same <strong>{cutoff} GMT</strong> cutoff for all
                        January decisions
                      </>
                    )}
                    <span className="coverage">
                      {metrics.paired_hours}/{metrics.expected_hours} hours
                      matched
                    </span>
                  </div>
                  {metrics.coverage_pct < 100 && (
                    <p className="notice">
                      Incomplete data: only {metrics.paired_hours} of{" "}
                      {metrics.expected_hours} hours are matched. Missing values
                      are excluded, never filled with zero.
                    </p>
                  )}
                  <section className="metrics">
                    {view === "decision" && (
                      <Metric
                        label="Average wind forecast"
                        value={number(avg)}
                        unit="MW"
                        note={`${forecasts.length} of 24 delivery hours available`}
                        special
                      />
                    )}
                    <Metric
                      label="Mean absolute error"
                      value={number(metrics.mae_mw)}
                      unit="MW"
                      note="Average size of the forecast miss"
                    />
                    <Metric
                      label="Root mean square error"
                      value={number(metrics.rmse_mw)}
                      unit="MW"
                      note="Gives larger misses more weight"
                    />
                    <Metric
                      label="Forecast bias"
                      value={number(metrics.bias_mw)}
                      unit="MW"
                      note={
                        metrics.bias_mw == null
                          ? "No matched observations"
                          : metrics.bias_mw < 0
                            ? "Wind was overforecast on average"
                            : metrics.bias_mw > 0
                              ? "Wind was underforecast on average"
                              : "No average directional error"
                      }
                    />
                    {view === "accuracy" && (
                      <Metric
                        label="Matched coverage"
                        value={number(metrics.coverage_pct, 1)}
                        unit="%"
                        note={`${metrics.paired_hours}/${metrics.expected_hours} delivery hours`}
                      />
                    )}
                  </section>
                  {view === "decision" && day.data ? (
                    <DecisionView
                      key={`${date}-${cutoff}`}
                      day={day.data}
                      onAccuracy={() => setView("accuracy")}
                    />
                  ) : (
                    analytics.data && (
                      <AccuracyView
                        data={analytics.data}
                        prep={settings.prep}
                        onDay={choose}
                        onAuction={(id) =>
                          setSettings({ ...settings, auction: id })
                        }
                      />
                    )
                  )}
                </>
              )}
            </>
          )}
          <footer>
            <span>Elexon FUELHH + WINDFOR</span>
            <span>
              Official forecasts remain separate from experimental estimates
            </span>
            <button onClick={() => setView("methodology")}>
              About the data
              <ArrowUpRight size={13} />
            </button>
          </footer>
        </main>
      </div>
    </div>
  );
}
