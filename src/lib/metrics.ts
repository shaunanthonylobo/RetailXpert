/**
 * Metric registry for the peer comparison matrix and explorer.
 * Each metric knows its unit, which direction is better, and how to compute itself.
 */
import type { Company } from "../data/schema";
import type { Unit } from "./format";
import * as F from "./finance";

export type Better = "high" | "low" | null;

export interface Metric {
  key: string;
  label: string;
  short: string;
  group: "Scale" | "Growth" | "Profitability" | "Cash & payout" | "Valuation" | "Operations" | "Outlook" | "Innovation";
  unit: Unit;
  better: Better;
  signed?: boolean;
  help: string;
  get: (c: Company, all: Company[]) => number | null;
}

const pe = (c: Company) => (c.ttm.netIncome / c.ttm.revenue > 0.005 ? c.quote.mcap / c.ttm.netIncome : null);
const ev = (c: Company) => c.quote.mcap + c.stats.debt - c.stats.cash;

export const METRICS: Metric[] = [
  { key: "revenue", label: "Revenue, TTM", short: "Revenue", group: "Scale", unit: "money", better: null,
    help: "Sales over the latest four reported quarters, in CAD.", get: (c) => c.ttm.revenue },
  { key: "mcap", label: "Market value", short: "Mkt cap", group: "Scale", unit: "money", better: null,
    help: "Share price × shares outstanding on the quote date.", get: (c) => c.quote.mcap },
  { key: "stores", label: "Stores", short: "Stores", group: "Scale", unit: "count", better: null,
    help: "Latest disclosed count. Definitions differ by company.", get: (c) => c.stores.n },
  { key: "growth", label: "Revenue growth, TTM", short: "Growth", group: "Growth", unit: "pct", better: "high", signed: true,
    help: "Trailing twelve months vs the twelve months before.", get: (c) => c.ttm.growthPct },
  { key: "cagr", label: "Revenue CAGR, 4 yrs", short: "CAGR", group: "Growth", unit: "pct", better: "high", signed: true,
    help: "Compound annual growth across the last five fiscal years.", get: (c) => F.annualCagr(c) },
  { key: "lastQ", label: "Latest quarter YoY (per week)", short: "Last Q", group: "Growth", unit: "pct", better: "high", signed: true,
    help: "Newest quarter vs the same quarter a year earlier, on weekly run-rate.", get: (c) => F.yoyQuarter(c, c.quarters[c.quarters.length - 1]) },
  { key: "ebitdaMargin", label: "EBITDA margin", short: "EBITDA %", group: "Profitability", unit: "pct", better: "high",
    help: "EBITDA ÷ TTM revenue.", get: (c) => F.ebitdaMargin(c) },
  { key: "grossMargin", label: "Gross margin", short: "Gross %", group: "Profitability", unit: "pct", better: "high",
    help: "Revenue left after the cost of goods sold.", get: (c) => c.stats.grossMargin },
  { key: "netMargin", label: "Net margin", short: "Net %", group: "Profitability", unit: "pct", better: "high",
    help: "TTM net income ÷ TTM revenue.", get: (c) => F.netMargin(c) },
  { key: "roic", label: "Return on invested capital", short: "ROIC", group: "Profitability", unit: "pct", better: "high",
    help: "Used instead of ROE, which buybacks distort.", get: (c) => c.stats.roic },
  { key: "fcfMargin", label: "Free-cash-flow margin", short: "FCF %", group: "Cash & payout", unit: "pct", better: "high",
    help: "Free cash flow ÷ revenue.", get: (c) => F.fcfMargin(c) },
  { key: "cashConv", label: "Cash conversion", short: "OCF/NI", group: "Cash & payout", unit: "x", better: "high",
    help: "Operating cash flow ÷ net income.", get: (c) => F.cashConversion(c) },
  { key: "shYield", label: "Shareholder yield", short: "Sh. yield", group: "Cash & payout", unit: "pct", better: "high",
    help: "(Dividends + buybacks, TTM) ÷ market value.", get: (c) => F.shareholderYield(c) },
  { key: "payoutRatio", label: "Actual payout ratio", short: "Payout", group: "Cash & payout", unit: "pct", better: null,
    help: "(Dividends + buybacks) ÷ net income. Above 100% returns more than it earns.", get: (c) => F.actualPayoutRatio(c) },
  { key: "pe", label: "P/E", short: "P/E", group: "Valuation", unit: "x", better: "low",
    help: "Market value ÷ TTM net income. Blank when margins are near zero.", get: pe },
  { key: "ps", label: "Price / sales", short: "P/S", group: "Valuation", unit: "x", better: "low",
    help: "Market value ÷ TTM revenue.", get: (c) => c.quote.mcap / c.ttm.revenue },
  { key: "evEbitda", label: "EV / EBITDA", short: "EV/EBITDA", group: "Valuation", unit: "x", better: "low",
    help: "(Market value + debt − cash) ÷ EBITDA.", get: (c) => (F.ebitdaMargin(c) !== null ? ev(c) / (c.stats.ebitda as number) : null) },
  { key: "capexInt", label: "Capex intensity", short: "Capex %", group: "Operations", unit: "pct", better: null,
    help: "Capital spending ÷ revenue.", get: (c) => F.capexIntensity(c) },
  { key: "capexEff", label: "Capex efficiency", short: "Rev/capex", group: "Operations", unit: "x", better: "high",
    help: "Revenue added last fiscal year per dollar of capex.", get: (c) => F.capexEfficiency(c) },
  { key: "prodIdx", label: "Store productivity index", short: "Prod. idx", group: "Operations", unit: "score", better: "high",
    help: "Sales per store vs sector median (100). A proxy for facility utilization.", get: (c, all) => F.productivityIndex(c, all) },
  { key: "revEmp", label: "Revenue per employee", short: "Rev/emp", group: "Operations", unit: "money", better: "high",
    help: "TTM revenue ÷ employees.", get: (c) => F.revenuePerEmployee(c) / 1e6 },
  { key: "invTurn", label: "Inventory turnover", short: "Inv. turns", group: "Operations", unit: "x", better: "high",
    help: "Times inventory sells through in a year.", get: (c) => c.stats.invTurnover },
  { key: "fThis", label: "Forecast growth, this FY", short: "Fcst FY", group: "Outlook", unit: "pct", better: "high", signed: true,
    help: "Analyst consensus revenue growth for the current fiscal year.", get: (c) => c.forecast?.thisG ?? null },
  { key: "fNext", label: "Forecast growth, next FY", short: "Fcst FY+1", group: "Outlook", unit: "pct", better: "high", signed: true,
    help: "Analyst consensus revenue growth for the following fiscal year.", get: (c) => c.forecast?.nextG ?? null },
  { key: "upside", label: "Upside to price target", short: "Upside", group: "Outlook", unit: "pct", better: "high", signed: true,
    help: "Average analyst target vs the dated share price.", get: (c) => F.targetUpside(c) },
  { key: "engines", label: "Revenue engine breadth", short: "Engines", group: "Innovation", unit: "score", better: "high",
    help: "Count of revenue engines beyond the till that are core or being built.", get: (c) => F.engineBreadth(c) },
  { key: "season", label: "Seasonality (peak ÷ trough)", short: "Season", group: "Innovation", unit: "x", better: "low",
    help: "Highest ÷ lowest weekly sales run-rate across the last 8 quarters.", get: (c) => F.seasonality(c) },
];

export const METRIC_BY_KEY: Record<string, Metric> = Object.fromEntries(METRICS.map((m) => [m.key, m]));

export type MetricTable = Record<string, Record<string, number | null>>;

/** All metric values for all companies, computed once. */
export function computeTable(all: Company[]): MetricTable {
  const t: MetricTable = {};
  for (const c of all) {
    t[c.id] = {};
    for (const m of METRICS) t[c.id][m.key] = m.get(c, all);
  }
  return t;
}

export function rankOf(table: MetricTable, ids: string[], key: string, id: string): { rank: number; n: number } | null {
  const m = METRIC_BY_KEY[key];
  const v = table[id][key];
  if (v === null || v === undefined) return null;
  const vals = ids.map((x) => table[x][key]).filter((x): x is number => x !== null && x !== undefined);
  const better = m.better ?? "high";
  const rank = 1 + vals.filter((x) => (better === "high" ? x > v : x < v)).length;
  return { rank, n: vals.length };
}
