/** RetailXpert shell: header, global filters, tab navigation. */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { COMPANIES, DATA } from "../data/schema";
import { daysBetween, formatByUnit, formatDate } from "../lib/format";
import { METRIC_BY_KEY, computeTable, rankOf } from "../lib/metrics";
import { StoreProvider, useStore, type TabKey } from "../state/store";
import { FilterBar } from "./FilterBar";
import { FinancialTab } from "./FinancialTab";
import { OpsTab } from "./OpsTab";
import { OutlookTab } from "./OutlookTab";
import { PeerTab } from "./PeerTab";
import { cx, useTokens } from "./ui";

declare global {
  interface Window {
    claude?: { use: (name: string) => Promise<unknown> };
  }
}
type Downloads = { save: (r: { filename: string; data: string }) => Promise<{ status: string }> };

const TABS: { key: TabKey; label: string; hint: string }[] = [
  { key: "growth", label: "Financial & Growth", hint: "Revenue, margins, CAGR, payout engine" },
  { key: "peers", label: "Peer Comparison", hint: "Matrix, explorer, revenue engines" },
  { key: "ops", label: "Operations & Facilities", hint: "Capex, store productivity, action log" },
  { key: "outlook", label: "Outlook & Actions", hint: "Forecasts, initiatives, recommendations" },
];

function Tabs() {
  const { state, dispatch } = useStore();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const n = (i + (e.key === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length;
    dispatch({ type: "tab", tab: TABS[n].key });
    refs.current[n]?.focus();
  };
  return (
    <div role="tablist" aria-label="Dashboard sections" className="flex gap-1 overflow-x-auto border-b border-line">
      {TABS.map((t, i) => {
        const on = state.tab === t.key;
        return (
          <button
            key={t.key}
            ref={(el) => (refs.current[i] = el)}
            role="tab"
            id={`tab-${t.key}`}
            aria-selected={on}
            aria-controls={`panel-${t.key}`}
            tabIndex={on ? 0 : -1}
            onKeyDown={(e) => onKey(e, i)}
            onClick={() => dispatch({ type: "tab", tab: t.key })}
            className={cx(
              "-mb-px shrink-0 border-b-2 px-3 pb-2.5 pt-1 text-left transition-colors",
              on ? "border-ink text-ink" : "border-transparent text-ink-2 hover:text-ink",
            )}
          >
            <span className="block text-[13.5px] font-semibold">{t.label}</span>
            <span className="hidden text-[11px] font-normal text-ink-3 md:block">{t.hint}</span>
          </button>
        );
      })}
    </div>
  );
}

function Shell() {
  const { state, range } = useStore();
  const tokens = useTokens();
  const table = useMemo(() => computeTable(COMPANIES), []);
  const [downloads, setDownloads] = useState<Downloads | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    window.claude
      ?.use("downloads")
      .then((d) => alive && setDownloads((d as Downloads) ?? null))
      .catch(() => alive && setDownloads(null));
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const exportCsv = async () => {
    if (!downloads) return;
    const ids = state.peerScope === "all" ? COMPANIES.map((c) => c.id) : state.selected;
    const keys = state.peerMetrics;
    const q = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = [["Company", "Ticker", ...keys.flatMap((k) => [METRIC_BY_KEY[k].label, `${METRIC_BY_KEY[k].label} rank`])].map(q).join(",")];
    for (const id of ids) {
      const c = COMPANIES.find((x) => x.id === id)!;
      lines.push(
        [c.name, c.ticker, ...keys.flatMap((k) => {
          const r = rankOf(table, ids, k, id);
          return [formatByUnit(table[id][k], METRIC_BY_KEY[k].unit, METRIC_BY_KEY[k].signed), r ? `${r.rank} of ${r.n}` : ""];
        })].map(q).join(","),
      );
    }
    lines.push("", q(`RetailXpert export ${DATA.meta.asOf}. Money in CAD; USD reporters converted at ${DATA.meta.fx.USDCAD}. Period filter: ${range.start} to ${range.end}.`));
    try {
      await downloads.save({ filename: `retailxpert-peers-${DATA.meta.asOf}.csv`, data: lines.join("\n") });
      setToast("Peer matrix saved as CSV.");
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === "declined") return;
      if (code === "rate_limited") setToast("A save prompt is already open.");
      else {
        setDownloads(null);
        setToast("Saving files isn't available in this view.");
      }
    }
  };

  const priceDates = COMPANIES.map((c) => c.quote.date).sort();
  const oldest = daysBetween(priceDates[0], DATA.meta.asOf);

  return (
    <div className="mx-auto flex max-w-[1480px] flex-col gap-4 px-4 pb-14 pt-5 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-[26px] font-bold tracking-tight text-ink">Retail<span className="text-ink-2">Xpert</span></span>
            <span className="rounded-md border border-line px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-2">Canada</span>
          </div>
          <p className="mt-1 text-[13px] text-ink-2">Growth, profit-sharing and operating performance for {COMPANIES.length} listed Canadian retailers.</p>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-[11.5px] sm:grid-cols-4">
          <div><dt className="text-ink-3">Compiled</dt><dd className="num text-ink">{formatDate(DATA.meta.asOf)}</dd></div>
          <div><dt className="text-ink-3">Prices dated</dt><dd className="num text-ink">{formatDate(priceDates[0])} – {formatDate(priceDates[priceDates.length - 1])}</dd></div>
          <div><dt className="text-ink-3">Currency</dt><dd className="num text-ink">CAD · US$1 = C${DATA.meta.fx.USDCAD}</dd></div>
          <div><dt className="text-ink-3">Oldest price</dt><dd className={cx("num", oldest > 21 ? "text-warn" : "text-ink")}>{oldest} days</dd></div>
        </dl>
      </header>

      <FilterBar tokens={tokens} onExport={exportCsv} canExport={!!downloads} />
      <Tabs />

      <main id={`panel-${state.tab}`} role="tabpanel" aria-labelledby={`tab-${state.tab}`}>
        {state.tab === "growth" && <FinancialTab tokens={tokens} />}
        {state.tab === "peers" && <PeerTab table={table} tokens={tokens} />}
        {state.tab === "ops" && <OpsTab tokens={tokens} />}
        {state.tab === "outlook" && <OutlookTab tokens={tokens} />}
      </main>

      <footer className="max-w-[90ch] text-[11.5px] leading-relaxed text-ink-3">
        Financials, cash flow and consensus forecasts: StockAnalysis (S&amp;P Global Market Intelligence). Store counts, initiatives and the operations log:
        company releases and earnings calls linked in each brief. Facility productivity is a modelled proxy; companies don't publish utilization.
        Built with a Python data pipeline (scripts/build_data.py) and React. Not investment advice.
      </footer>
      {toast && (
        <div role="status" className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-line bg-panel px-4 py-2 text-[13px] text-ink shadow-lg">{toast}</div>
      )}
    </div>
  );
}

export function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
