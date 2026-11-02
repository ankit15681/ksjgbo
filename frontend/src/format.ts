export const number = (v: number | null | undefined, digits = 0) =>
  v == null
    ? "—"
    : v.toLocaleString("en-GB", { maximumFractionDigits: digits });
export const dateLabel = (
  v: string,
  options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "long",
    year: "numeric",
  },
) =>
  new Date(v).toLocaleDateString("en-GB", {
    ...options,
    timeZone: "Europe/London",
  });
export const publication = (v: string | null) =>
  v
    ? new Date(v).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/London",
      })
    : "Unavailable";
