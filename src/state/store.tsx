/**
 * Dashboard state: one reducer, provided through context.
 * Remembers each viewer's last view in localStorage when the browser allows it.
 */
import React, { createContext, useContext, useEffect, useMemo, useReducer } from "react";
import { COMPANIES } from "../data/schema";
import { DEFAULT_RULE, type PayoutRule, type Range } from "../lib/finance";

export type TabKey = "growth" | "peers" | "ops" | "outlook";
export type RangePreset = "4q" | "8q" | "all" | "custom";
export type RevenueView = "reported" | "perWeek" | "indexed";

export interface State {
  tab: TabKey;
  selected: string[];
  preset: RangePreset;
  custom: Range;
  revenueView: RevenueView;
  rule: PayoutRule;
  peerMetrics: string[];
  peerScope: "selected" | "all";
  peerSort: { key: string; dir: 1 | -1 };
  scatter: { x: string; y: string };
  logType: string;
  logStatus: string;
  logQuery: string;
}

export const MAX_SELECTED = 6;

const ALL_ENDS = COMPANIES.flatMap((c) => c.quarters.map((q) => q.end)).sort();
export const DATA_START = ALL_ENDS[0];
export const DATA_END = ALL_ENDS[ALL_ENDS.length - 1];

const shift = (iso: string, days: number) => new Date(Date.parse(iso) + days * 86_400_000).toISOString().slice(0, 10);

export function rangeFor(s: Pick<State, "preset" | "custom">): Range {
  switch (s.preset) {
    case "4q":
      return { start: shift(DATA_END, -357), end: DATA_END };
    case "8q":
      return { start: shift(DATA_END, -721), end: DATA_END };
    case "all":
      return { start: DATA_START, end: DATA_END };
    case "custom":
      return s.custom;
  }
}

export const INITIAL: State = {
  tab: "growth",
  selected: ["DOL", "L", "ATZ", "LULU"],
  preset: "4q",
  custom: { start: shift(DATA_END, -729), end: DATA_END },
  revenueView: "reported",
  rule: DEFAULT_RULE,
  peerMetrics: ["revenue", "growth", "ebitdaMargin", "roic", "fcfMargin", "capexEff", "fNext", "engines"],
  peerScope: "all",
  peerSort: { key: "revenue", dir: -1 },
  scatter: { x: "fNext", y: "ebitdaMargin" },
  logType: "All",
  logStatus: "All",
  logQuery: "",
};

export type Action =
  | { type: "tab"; tab: TabKey }
  | { type: "toggleCompany"; id: string }
  | { type: "setSelected"; ids: string[] }
  | { type: "preset"; preset: RangePreset }
  | { type: "customRange"; range: Partial<Range> }
  | { type: "revenueView"; view: RevenueView }
  | { type: "rule"; rule: PayoutRule }
  | { type: "togglePeerMetric"; key: string }
  | { type: "peerScope"; scope: "selected" | "all" }
  | { type: "peerSort"; key: string }
  | { type: "scatter"; axis: "x" | "y"; key: string }
  | { type: "logFilter"; field: "logType" | "logStatus" | "logQuery"; value: string }
  | { type: "reset" };

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "tab":
      return { ...s, tab: a.tab };
    case "toggleCompany": {
      if (s.selected.includes(a.id)) {
        return s.selected.length <= 1 ? s : { ...s, selected: s.selected.filter((x) => x !== a.id) };
      }
      const next = [...s.selected, a.id];
      return { ...s, selected: next.length > MAX_SELECTED ? next.slice(1) : next };
    }
    case "setSelected":
      return { ...s, selected: a.ids.slice(0, MAX_SELECTED).length ? a.ids.slice(0, MAX_SELECTED) : s.selected };
    case "preset":
      return { ...s, preset: a.preset };
    case "customRange": {
      const custom = { ...s.custom, ...a.range };
      if (custom.start > custom.end) return s;
      return { ...s, preset: "custom", custom };
    }
    case "revenueView":
      return { ...s, revenueView: a.view };
    case "rule":
      return { ...s, rule: a.rule };
    case "togglePeerMetric": {
      const has = s.peerMetrics.includes(a.key);
      if (has && s.peerMetrics.length <= 2) return s;
      return { ...s, peerMetrics: has ? s.peerMetrics.filter((k) => k !== a.key) : [...s.peerMetrics, a.key] };
    }
    case "peerScope":
      return { ...s, peerScope: a.scope };
    case "peerSort":
      return { ...s, peerSort: { key: a.key, dir: s.peerSort.key === a.key ? ((-s.peerSort.dir) as 1 | -1) : -1 } };
    case "scatter":
      return { ...s, scatter: { ...s.scatter, [a.axis]: a.key } };
    case "logFilter":
      return { ...s, [a.field]: a.value };
    case "reset":
      return INITIAL;
  }
}

const KEY = "retailxpert:v1";

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return INITIAL;
    const saved = JSON.parse(raw) as Partial<State>;
    const valid = (saved.selected ?? []).filter((id) => COMPANIES.some((c) => c.id === id));
    return { ...INITIAL, ...saved, selected: valid.length ? valid : INITIAL.selected, logQuery: "" };
  } catch {
    return INITIAL;
  }
}

const Ctx = createContext<{ state: State; dispatch: React.Dispatch<Action>; range: Range } | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable: the dashboard still works, it just won't remember */
    }
  }, [state]);
  const range = useMemo(() => rangeFor(state), [state.preset, state.custom]);
  const value = useMemo(() => ({ state, dispatch, range }), [state, range]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore must be used inside StoreProvider");
  return v;
}
