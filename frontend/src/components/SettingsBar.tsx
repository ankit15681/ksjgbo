import type { Auction } from "../types";
export type Settings = { auction: string; prep: number; custom: string };
export function cutoffFor(s: Settings, auctions: Auction[]) {
  if (s.auction === "custom") return s.custom;
  const gate = auctions.find((a) => a.id === s.auction)?.gate ?? "09:20";
  const [h, m] = gate.split(":").map(Number);
  const minutes = h * 60 + m - s.prep;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
export function SettingsBar({
  value,
  onChange,
  auctions,
  cutoff,
}: {
  value: Settings;
  onChange: (s: Settings) => void;
  auctions: Auction[];
  cutoff: string;
}) {
  return (
    <section className="auction-settings" aria-label="Auction settings">
      <label>
        Auction
        <select
          value={value.auction}
          onChange={(e) => onChange({ ...value, auction: e.target.value })}
        >
          {auctions.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} · {a.gate} GMT
            </option>
          ))}
          <option value="custom">Custom cutoff</option>
        </select>
      </label>
      {value.auction !== "custom" && (
        <label>
          Preparation time
          <select
            value={value.prep}
            onChange={(e) =>
              onChange({ ...value, prep: Number(e.target.value) })
            }
          >
            {[0, 15, 30, 60, 90].map((n) => (
              <option key={n} value={n}>
                {n === 0 ? "At gate closure" : `${n} minutes before`}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        Decision cutoff · London
        <input
          type="time"
          value={cutoff}
          onChange={(e) => {
            if (e.target.value)
              onChange({ ...value, auction: "custom", custom: e.target.value });
          }}
        />
      </label>
      <p>
        Forecast publications must be available by <strong>{cutoff} GMT</strong>
        .
        <small>
          All comparisons stay hourly, including the half-hourly auction.
        </small>
      </p>
    </section>
  );
}
