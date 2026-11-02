export type Metrics = {
  expected_hours: number;
  paired_hours: number;
  forecast_hours: number;
  actual_hours: number;
  coverage_pct: number;
  mae_mw: number | null;
  rmse_mw: number | null;
  bias_mw: number | null;
};
export type Row = {
  start_time: string;
  hour: string;
  forecast_mw: number | null;
  actual_mw: number | null;
  error_mw: number | null;
  publish_time: string | null;
  lead_hours: number | null;
};
export type Day = {
  decision_date: string;
  delivery_date: string;
  cutoff: string;
  rows: Row[];
  metrics: Metrics;
};
export type Month = {
  metrics: Metrics;
  days: (Metrics & { decision_date: string; delivery_date: string })[];
};
export type Meta = {
  retrieved_at: string;
  forecast_count: number;
  actual_count: number;
};
export type Auction = {
  id: string;
  name: string;
  gate: string;
  source: string;
};
export type Diagnostic = Metrics & {
  p90_shortfall_mw: number | null;
  worst_shortfall_mw: number | null;
  worst_surplus_mw: number | null;
};
export type Analytics = {
  metrics: Diagnostic;
  by_hour: (Diagnostic & { hour: string })[];
  histogram: {
    from_mw: number;
    to_mw: number;
    mid_mw: number;
    count: number;
  }[];
  scatter: { forecast_mw: number; actual_mw: number; start_time: string }[];
  horizon: (Diagnostic & { from_h: number; to_h: number })[];
  days: (Diagnostic & {
    decision_date: string;
    delivery_date: string;
    forecast_gwh: number | null;
    actual_gwh: number | null;
  })[];
};
export type Evolution = {
  decision_date: string;
  cutoff: string;
  energy: { forecast_gwh: number | null; actual_gwh: number | null };
  runs: {
    publish_time: string;
    available: boolean;
    selected_hours: number;
    forecast_hours: number;
    points: { hour: string; start_time: string; forecast_mw: number | null }[];
  }[];
};
export type Comparison = {
  prep_minutes: number;
  auctions: (Auction & { cutoff: string; metrics: Diagnostic })[];
};
export type Experiment = {
  day: {
    decision_date: string;
    cutoff: string;
    history_hours: number;
    slope: number | null;
    intercept_mw: number | null;
    rows: (Row & {
      corrected_mw: number | null;
      lower_mw: number | null;
      upper_mw: number | null;
    })[];
    official_metrics: Diagnostic;
    corrected_metrics: Diagnostic;
  };
  month: {
    official_same_hours: Diagnostic;
    corrected_same_hours: Diagnostic;
    expected_hours: number;
    evaluation_hours: number;
    band_paired_hours: number;
    lower_hit_pct: number | null;
    band_hit_pct: number | null;
  };
};
