export function Metric({
  label,
  value,
  unit,
  note,
  special = false,
}: {
  label: string;
  value: string;
  unit: string;
  note: string;
  special?: boolean;
}) {
  return (
    <article className={`metric ${special ? "primary-metric" : ""}`}>
      <h2>{label}</h2>
      <div className="metric-value">
        {value}
        <span>{unit}</span>
      </div>
      <p>{note}</p>
    </article>
  );
}
