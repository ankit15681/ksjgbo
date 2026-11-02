import type { ReactNode } from "react";
export const chartAxis = {
  tickLine: false,
  axisLine: false,
  tick: { fill: "#647484", fontSize: 12 },
};
export function Panel({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          <p>{note}</p>
        </div>
      </div>
      <div className="analysis-chart">{children}</div>
    </section>
  );
}
export function LoadState({
  loading,
  error,
  retry,
}: {
  loading: boolean;
  error?: string;
  retry: () => void;
}) {
  return error ? (
    <div className="status-panel compact error" role="alert">
      <p>{error}</p>
      <button className="button" onClick={retry}>
        Retry data load
      </button>
    </div>
  ) : loading ? (
    <div className="status-panel compact" role="status">
      Loading analysis…
    </div>
  ) : null;
}
