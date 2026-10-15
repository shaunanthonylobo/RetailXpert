/** Global filters: portfolio multi-select and date range. */
import { useEffect, useMemo, useRef, useState } from "react";
import { COMPANIES, type Sector } from "../data/schema";
import { formatDate, formatMoney } from "../lib/format";
import { DATA_END, DATA_START, MAX_SELECTED, useStore, type RangePreset } from "../state/store";
import { Segmented, SeriesDot, cx, type Tokens } from "./ui";

const SECTORS: Sector[] = ["Grocery & pharmacy", "Convenience & fuel", "General merchandise", "Apparel", "Specialty"];

export function seriesColor(tokens: Tokens, selected: string[], id: string) {
  const i = selected.indexOf(id);
  return i >= 0 ? tokens.series[i % tokens.series.length] : tokens.ink3;
}

function CompanyPicker({ tokens }: { tokens: Tokens }) {
  const { state, dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return COMPANIES.filter((c) => !t || `${c.name} ${c.ticker} ${c.banners}`.toLowerCase().includes(t));
  }, [q]);

  return (
    <div ref={ref} className="relative min-w-0">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">Portfolio</div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        {state.selected.map((id) => {
          const c = COMPANIES.find((x) => x.id === id)!;
          return (
            <span key={id} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel py-0.5 pl-2 pr-1 text-[12px] text-ink">
              <SeriesDot color={seriesColor(tokens, state.selected, id)} />
              {c.short}
              <button
                type="button"
                aria-label={`Remove ${c.short}`}
                disabled={state.selected.length <= 1}
                onClick={() => dispatch({ type: "toggleCompany", id })}
                className="rounded-full px-1 text-ink-3 hover:text-ink disabled:opacity-30"
              >
                ×
              </button>
            </span>
          );
        })}
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="rounded-full border border-dashed border-ink-3 px-2.5 py-0.5 text-[12px] text-ink-2 hover:border-ink hover:text-ink"
        >
          {open ? "Done" : "+ Add or change"}
        </button>
      </div>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-[min(560px,calc(100vw-32px))] rounded-xl border border-line bg-panel p-3 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <input
              autoFocus
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, ticker or banner"
              aria-label="Search companies"
              className="min-w-0 flex-1 rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-[13px] text-ink"
            />
            <span className="text-[12px] text-ink-3">{state.selected.length} of {MAX_SELECTED} max</span>
          </div>
          <div className="mt-3 max-h-[340px] overflow-y-auto pr-1">
            {SECTORS.map((s) => {
              const rows = filtered.filter((c) => c.sector === s);
              if (!rows.length) return null;
              return (
                <div key={s} className="mb-2">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">{s}</span>
                    <button
                      type="button"
                      onClick={() => dispatch({ type: "setSelected", ids: rows.map((r) => r.id) })}
                      className="text-[11.5px] text-ink-2 underline underline-offset-2 hover:text-ink"
                    >
                      Select only these
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                    {rows.map((c) => {
                      const on = state.selected.includes(c.id);
                      return (
                        <label key={c.id} className={cx("flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5 text-[12.5px]", on ? "border-ink-3 bg-sunk" : "border-transparent hover:bg-sunk")}>
                          <input type="checkbox" checked={on} onChange={() => dispatch({ type: "toggleCompany", id: c.id })} className="accent-current" />
                          <span className="min-w-0 flex-1 truncate text-ink">{c.short}</span>
                          <span className="num text-[11px] text-ink-3">{formatMoney(c.ttm.revenue)}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {!filtered.length && <p className="py-6 text-center text-[13px] text-ink-2">No company matches “{q}”.</p>}
          </div>
          <p className="mt-2 text-[11.5px] text-ink-3">Adding a seventh drops the oldest pick.</p>
        </div>
      )}
    </div>
  );
}

const toMonth = (iso: string) => iso.slice(0, 7);
const monthStart = (m: string) => `${m}-01`;
const monthEnd = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10);
};

function DateRangeControl() {
  const { state, dispatch, range } = useStore();
  return (
    <div className="min-w-0">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">Period (quarter end dates)</div>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <Segmented<RangePreset>
          label="Date range"
          value={state.preset}
          onChange={(p) => dispatch({ type: "preset", preset: p })}
          options={[
            { value: "4q", label: "12 mo", title: "Quarters ending in the last 12 months of data" },
            { value: "8q", label: "24 mo" },
            { value: "all", label: "All" },
            { value: "custom", label: "Custom" },
          ]}
        />
        {state.preset === "custom" && (
          <span className="flex items-center gap-1.5 text-[12px] text-ink-2">
            <input
              type="month"
              aria-label="Start month"
              min={toMonth(DATA_START)}
              max={toMonth(state.custom.end)}
              value={toMonth(state.custom.start)}
              onChange={(e) => e.target.value && dispatch({ type: "customRange", range: { start: monthStart(e.target.value) } })}
              className="rounded-lg border border-line bg-panel px-2 py-1 text-ink"
            />
            to
            <input
              type="month"
              aria-label="End month"
              min={toMonth(state.custom.start)}
              max={toMonth(DATA_END)}
              value={toMonth(state.custom.end)}
              onChange={(e) => e.target.value && dispatch({ type: "customRange", range: { end: monthEnd(e.target.value) } })}
              className="rounded-lg border border-line bg-panel px-2 py-1 text-ink"
            />
          </span>
        )}
        <span className="num text-[11.5px] text-ink-3">{formatDate(range.start)} – {formatDate(range.end)}</span>
      </div>
    </div>
  );
}

export function FilterBar({ tokens, onExport, canExport }: { tokens: Tokens; onExport: () => void; canExport: boolean }) {
  const { dispatch } = useStore();
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 rounded-xl border border-line bg-panel px-4 py-3">
      <div className="flex min-w-0 flex-wrap items-end gap-x-8 gap-y-3">
        <CompanyPicker tokens={tokens} />
        <DateRangeControl />
      </div>
      <div className="flex items-center gap-2">
        {canExport && (
          <button type="button" onClick={onExport} className="rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-medium text-ink hover:bg-sunk">
            Export CSV
          </button>
        )}
        <button type="button" onClick={() => dispatch({ type: "reset" })} className="rounded-lg px-3 py-1.5 text-[12.5px] text-ink-2 hover:bg-sunk hover:text-ink">
          Reset view
        </button>
      </div>
    </div>
  );
}
