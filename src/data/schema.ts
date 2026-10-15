/**
 * RetailXpert data model.
 * Every money field is in millions of Canadian dollars (USD reporters are
 * converted in scripts/build_data.py at meta.fx.USDCAD). Dates are ISO strings.
 */
import raw from "./retailers.json";

export type Sector =
  | "Grocery & pharmacy"
  | "Convenience & fuel"
  | "General merchandise"
  | "Apparel"
  | "Specialty";

export type EngineLevel = "core" | "build" | "exit";
export type LogStatus = "Done" | "In progress" | "Planned" | "Pending" | "Revised" | "Ongoing" | "Watch";

export interface Quarter {
  end: string;
  revenue: number;
  /** null when only the sales figure has been released */
  netIncome: number | null;
  /** quarter length; grocers report 12- and 16-week quarters */
  weeks: number | null;
  /** set when the quarter came from a company release rather than the data vendor */
  source: string | null;
}

export interface Forecast {
  fy: string;
  thisRev: number;
  thisG: number;
  nextRev: number;
  nextG: number;
  analysts: number;
  rating: string;
  pt: number;
  ptLo: number;
  ptHi: number;
  ptCcy: "CAD" | "USD";
  updated: string;
}

export interface LogEntry {
  date: string;
  type: string;
  action: string;
  impact: string;
  status: LogStatus;
}

export interface Company {
  id: string;
  name: string;
  short: string;
  ticker: string;
  sector: Sector;
  hq: string;
  lat: number;
  lon: number;
  founded: number;
  banners: string;
  fyEnd: string;
  reportsIn: "CAD" | "USD";
  sourceUrl: string;
  notes: string[];
  ttm: { end: string; revenue: number; netIncome: number; growthPct: number };
  annual: { end: string; revenue: number }[];
  quarters: Quarter[];
  stats: {
    grossMargin: number;
    opMargin: number;
    roic: number;
    ebitda: number | null;
    debt: number;
    cash: number;
    employees: number;
    invTurnover: number;
    beta: number | null;
    divYield: number;
  };
  quote: { price: number; ccy: "CAD" | "USD"; date: string; mcap: number; lo52: number; hi52: number };
  stores: { n: number; label: string; basis: string; date: string; src: string; conf: "reported" | "approx" | "low" };
  cashflow: { end: string; capex: number; ocf: number; fcf: number; dividends: number; buybacks: number; note: string };
  forecast: Forecast | null;
  guidance: string | null;
  engines: Record<string, { level: EngineLevel; evidence: string }>;
  log: LogEntry[];
  actions: string[];
  sources: string[];
}

export interface Dataset {
  meta: {
    asOf: string;
    fx: { USDCAD: number; date: string; source: string };
    engines: { key: string; label: string }[];
  };
  companies: Company[];
}

export const DATA = raw as unknown as Dataset;
export const COMPANIES: Company[] = DATA.companies;
export const BY_ID: Record<string, Company> = Object.fromEntries(COMPANIES.map((c) => [c.id, c]));
