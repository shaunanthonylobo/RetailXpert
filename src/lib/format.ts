/**
 * Humanized formatting. Every number on screen passes through one of these.
 * Money inputs are millions of CAD unless a function says otherwise.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Raw dollars → "C$1.23B", "C$450K", "C$12". */
export function formatDollars(dollars: number | null | undefined, prefix = "C$"): string {
  if (dollars === null || dollars === undefined || !Number.isFinite(dollars)) return "—";
  const sign = dollars < 0 ? "−" : "";
  const a = Math.abs(dollars);
  const unit = (div: number, suffix: string) => {
    const v = a / div;
    const digits = v >= 100 ? 0 : v >= 10 ? 1 : 2;
    return `${sign}${prefix}${v.toFixed(digits)}${suffix}`;
  };
  if (a >= 1e12) return unit(1e12, "T");
  if (a >= 1e9) return unit(1e9, "B");
  if (a >= 1e6) return unit(1e6, "M");
  if (a >= 1e3) return unit(1e3, "K");
  return `${sign}${prefix}${a.toFixed(a >= 10 ? 0 : 2)}`;
}

/** Millions of CAD → humanized string. */
export function formatMoney(millions: number | null | undefined): string {
  if (millions === null || millions === undefined || !Number.isFinite(millions)) return "—";
  return formatDollars(millions * 1e6);
}

export function formatPct(v: number | null | undefined, opts: { signed?: boolean; digits?: number } = {}): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const digits = opts.digits ?? (Math.abs(v) >= 100 ? 0 : 1);
  const s = v.toFixed(digits);
  if (v < 0) return `−${s.slice(1)}%`;
  return `${opts.signed && v > 0 ? "+" : ""}${s}%`;
}

export function formatMultiple(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `${v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)}×`;
}

export function formatCount(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e4) return `${(v / 1e3).toFixed(0)}K`;
  return Math.round(v).toLocaleString("en-CA");
}

export function formatPrice(v: number, ccy: "CAD" | "USD"): string {
  return `${ccy === "USD" ? "US$" : "C$"}${v.toFixed(2)}`;
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

export function formatMonth(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ’${String(y).slice(2)}`;
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 86_400_000);
}

export type Unit = "money" | "pct" | "x" | "count" | "score";

export function formatByUnit(v: number | null | undefined, unit: Unit, signed = false): string {
  switch (unit) {
    case "money":
      return formatMoney(v);
    case "pct":
      return formatPct(v, { signed });
    case "x":
      return formatMultiple(v);
    case "count":
      return formatCount(v);
    case "score":
      return v === null || v === undefined ? "—" : v.toFixed(0);
  }
}
