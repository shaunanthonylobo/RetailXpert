/**
 * Financial logic utilities: growth, margins, the stakeholder payout engine,
 * capex efficiency and operational proxies. Pure functions, no React.
 */
import type { Company, Quarter } from "../data/schema";

/* ---------------- statistics ---------------- */

export function median(values: number[]): number | null {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

export function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

/** Compound annual growth rate in percent between two values `years` apart. */
export function cagr(first: number, last: number, years: number): number | null {
  if (first <= 0 || last <= 0 || years <= 0) return null;
  return (Math.pow(last / first, 1 / years) - 1) * 100;
}

/** CAGR from the first to the last annual revenue, using the real time between period ends. */
export function annualCagr(c: Company): number | null {
  const a = c.annual;
  if (a.length < 2) return null;
  const years = (Date.parse(a[a.length - 1].end) - Date.parse(a[0].end)) / (365.25 * 86_400_000);
  return cagr(a[0].revenue, a[a.length - 1].revenue, Math.round(years));
}

export const pctChange = (now: number, before: number): number | null =>
  before > 0 ? (now / before - 1) * 100 : null;

/* ---------------- date-range helpers ---------------- */

export interface Range {
  start: string; // inclusive ISO date
  end: string; // inclusive ISO date
}

export function quartersIn(c: Company, r: Range): Quarter[] {
  return c.quarters.filter((q) => q.end >= r.start && q.end <= r.end);
}

/** The window of the same length immediately before `r`. */
export function priorRange(r: Range): Range {
  const s = Date.parse(r.start);
  const e = Date.parse(r.end);
  const len = e - s;
  const pe = new Date(s - 86_400_000);
  const ps = new Date(pe.getTime() - len);
  return { start: ps.toISOString().slice(0, 10), end: pe.toISOString().slice(0, 10) };
}

/** Revenue per week, so 16-week grocery quarters compare with 13-week ones. */
export function perWeek(q: Quarter): number {
  return q.revenue / (q.weeks ?? 13);
}

/** Same quarter one year earlier (the 4th quarter back), if present. */
export function yoyQuarter(c: Company, q: Quarter): number | null {
  const i = c.quarters.findIndex((x) => x.end === q.end);
  if (i < 4) return null;
  const prev = c.quarters[i - 4];
  // compare weekly run-rates so a 53-week year doesn't fake growth
  return pctChange(perWeek(q), perWeek(prev));
}

/** Peak quarter ÷ trough quarter over the last 8 quarters. 1.0 = no seasonality. */
export function seasonality(c: Company): number | null {
  const last = c.quarters.slice(-8).map(perWeek);
  if (last.length < 4) return null;
  return Math.max(...last) / Math.min(...last);
}

/* ---------------- profitability ---------------- */

export const ebitdaMargin = (c: Company): number | null =>
  c.stats.ebitda && c.stats.ebitda > 0 && c.stats.ebitda < c.ttm.revenue ? (c.stats.ebitda / c.ttm.revenue) * 100 : null;

export const netMargin = (c: Company): number => (c.ttm.netIncome / c.ttm.revenue) * 100;

export const fcfMargin = (c: Company): number => (c.cashflow.fcf / c.ttm.revenue) * 100;

/** Operating cash flow ÷ net income. Above 1 means profits arrive as cash. */
export const cashConversion = (c: Company): number | null =>
  c.ttm.netIncome > c.ttm.revenue * 0.005 ? c.cashflow.ocf / c.ttm.netIncome : null;

/* ---------------- stakeholder payout engine ---------------- */

export type PayoutRule =
  | { kind: "flat"; rate: number }
  | { kind: "tiered"; baseRate: number; bonusRate: number; thresholdMargin: number };

export const DEFAULT_RULE: PayoutRule = { kind: "tiered", baseRate: 5, bonusRate: 7.5, thresholdMargin: 15 };

export interface PayoutResult {
  payout: number; // millions CAD
  base: number;
  bonus: number;
  margin: number | null; // net margin % for the period
  tierHit: boolean;
}

/**
 * Stakeholder cut for one period.
 * flat:   rate% of net profit when profit is positive.
 * tiered: baseRate% of profit up to thresholdMargin% of revenue,
 *         bonusRate% of the profit earned above that margin. Nothing in loss periods.
 */
export function payoutFor(netIncome: number | null, revenue: number, rule: PayoutRule): PayoutResult {
  if (netIncome === null || netIncome <= 0 || revenue <= 0) {
    return { payout: 0, base: 0, bonus: 0, margin: netIncome === null ? null : (netIncome / revenue) * 100, tierHit: false };
  }
  const margin = (netIncome / revenue) * 100;
  if (rule.kind === "flat") {
    const p = (netIncome * rule.rate) / 100;
    return { payout: p, base: p, bonus: 0, margin, tierHit: false };
  }
  const cap = (revenue * rule.thresholdMargin) / 100;
  const baseProfit = Math.min(netIncome, cap);
  const excess = Math.max(0, netIncome - cap);
  const base = (baseProfit * rule.baseRate) / 100;
  const bonus = (excess * rule.bonusRate) / 100;
  return { payout: base + bonus, base, bonus, margin, tierHit: excess > 0 };
}

export function payoutOverRange(c: Company, r: Range, rule: PayoutRule) {
  const qs = quartersIn(c, r);
  const rows = qs.map((q) => ({ q, ...payoutFor(q.netIncome, q.revenue, rule) }));
  const profit = sum(qs.map((q) => q.netIncome ?? 0));
  const total = sum(rows.map((x) => x.payout));
  return {
    rows,
    total,
    base: sum(rows.map((x) => x.base)),
    bonus: sum(rows.map((x) => x.bonus)),
    profit,
    effectiveRate: profit > 0 ? (total / profit) * 100 : null,
    tierQuarters: rows.filter((x) => x.tierHit).length,
    lossQuarters: rows.filter((x) => x.q.netIncome !== null && x.q.netIncome <= 0).length,
    missing: rows.filter((x) => x.q.netIncome === null).length,
  };
}

/** What shareholders actually received over the trailing twelve months. */
export const actualDistributions = (c: Company) => c.cashflow.dividends + c.cashflow.buybacks;
export const actualPayoutRatio = (c: Company): number | null =>
  c.ttm.netIncome > 0 ? (actualDistributions(c) / c.ttm.netIncome) * 100 : null;
export const shareholderYield = (c: Company): number => (actualDistributions(c) / c.quote.mcap) * 100;

/* ---------------- operations & facilities ---------------- */

export const capexIntensity = (c: Company): number => (c.cashflow.capex / c.ttm.revenue) * 100;

/**
 * Capex efficiency: revenue added over the last fiscal year per dollar of capex.
 * 0.5 means every capex dollar was followed by 50¢ of new annual revenue.
 */
export function capexEfficiency(c: Company): number | null {
  const a = c.annual;
  if (a.length < 2 || c.cashflow.capex <= 0) return null;
  return (a[a.length - 1].revenue - a[a.length - 2].revenue) / c.cashflow.capex;
}

export const revenuePerStore = (c: Company): number => c.ttm.revenue / c.stores.n;
export const revenuePerEmployee = (c: Company): number => (c.ttm.revenue * 1e6) / c.stats.employees;

/**
 * Facility productivity index (a utilization proxy). Companies don't publish
 * facility utilization, so this compares sales per store with the sector median:
 * 100 = typical for the sector, 150 = stores ring up 50% more.
 */
export function productivityIndex(c: Company, all: Company[]): number | null {
  const peers = all.filter((x) => x.sector === c.sector).map(revenuePerStore);
  const m = median(peers);
  return m ? (revenuePerStore(c) / m) * 100 : null;
}

/* ---------------- outlook ---------------- */

export function targetUpside(c: Company): number | null {
  if (!c.forecast) return null;
  return (c.forecast.pt / c.quote.price - 1) * 100;
}

export type Trajectory = "accelerating" | "steady" | "slowing" | "declining" | "n/a";

export function trajectory(c: Company): Trajectory {
  const f = c.forecast;
  if (!f) return "n/a";
  if (f.thisG < 0 || f.nextG < 0) return "declining";
  if (f.nextG > f.thisG + 1) return "accelerating";
  if (f.nextG < f.thisG - 3) return "slowing";
  return "steady";
}

export function engineBreadth(c: Company): number {
  return Object.values(c.engines).filter((e) => e.level === "core" || e.level === "build").length;
}

/** Percentile rank 0–100 of `v` within `values` (higher value → higher percentile). */
export function percentile(v: number, values: number[]): number {
  const vs = values.filter((x) => Number.isFinite(x));
  if (vs.length < 2) return 50;
  const below = vs.filter((x) => x < v).length;
  const equal = vs.filter((x) => x === v).length;
  return ((below + (equal - 1) / 2) / (vs.length - 1)) * 100;
}
