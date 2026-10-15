/** Tab 3 — Operational & Facility Optimization: capex, store productivity, and the dated actions log. */
import { useMemo } from "react";
import { Bar, CartesianGrid, ComposedChart, Legend, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts";
import { BY_ID, COMPANIES, type LogStatus } from "../data/schema";
import * as F from "../lib/finance";
import { formatCount, formatDate, formatDollars, formatMoney, formatMultiple, formatPct } from "../lib/format";
import { useStore } from "../state/store";
import { seriesColor } from "./FilterBar";
import { Card, ChartTooltip, Kpi, Select, SeriesDot, Status, type Tokens, type Tone } from "./ui";

/** Quantified, company-disclosed annual impacts of current cost and efficiency programs (millions CAD). */
const DISCLOSED_IMPACTS: { id: string; value: number; what: string }[] = [
  { id: "EMP", value: 95, what: "Voilà e-commerce review: annualized operating-income gain" },
  { id: "MRU", value: 15, what: "Ontario restructuring: recurring annual net earnings by FY2028" },
  { id: "CTC", value: 10, what: "Retail SG&A reduction year over year" },
];

const statusTone = (s: LogStatus): Tone =>
  s === "Done" ? "good" : s === "Ongoing" || s === "Watch" ? "bad" : s === "Pending" || s === "Revised" ? "warn" : "neutral";

function prodTone(v: number | null): Tone {
  if (v === null) return "neutral";
  if (v >= 115) return "good";
  if (v < 85) return "warn";
  return "neutral";
}

export function OpsTab({ tokens }: { tokens: Tokens }) {
  const { state, dispatch } = useStore();
  const companies = useMemo(() => state.selected.map((id) => BY_ID[id]), [state.selected]);

  const rows = useMemo(
    () =>
      companies.map((c) => ({
        c,
        capex: c.cashflow.capex,
        intensity: F.capexIntensity(c),
        efficiency: F.capexEfficiency(c),
        perStore: F.revenuePerStore(c),
        prod: F.productivityIndex(c, COMPANIES),
        perEmp: F.revenuePerEmployee(c),
        turns: c.stats.invTurnover,
      })),
    [companies],
  );

  const kpi = useMemo(() => {
    const capex = F.sum(rows.map((r) => r.capex));
    const rev = F.sum(companies.map((c) => c.ttm.revenue));
    const added = F.sum(companies.map((c) => (c.annual.length > 1 ? c.annual[c.annual.length - 1].revenue - c.annual[c.annual.length - 2].revenue : 0)));
    const prods = rows.map((r) => r.prod).filter((v): v is number => v !== null);
    const impacts = DISCLOSED_IMPACTS.filter((d) => state.selected.includes(d.id));
    return {
      capex,
      intensity: rev ? (capex / rev) * 100 : null,
      efficiency: capex ? added / capex : null,
      stores: F.sum(companies.map((c) => c.stores.n)),
      prod: prods.length ? F.median(prods) : null,
      impact: F.sum(impacts.map((d) => d.value)),
      impacts,
    };
  }, [rows, companies, state.selected]);

  const log = useMemo(() => {
    const q = state.logQuery.trim().toLowerCase();
    return companies
      .flatMap((c) => c.log.map((l) => ({ c, ...l })))
      .filter((l) => (state.logType === "All" || l.type === state.logType) && (state.logStatus === "All" || l.status === state.logStatus))
      .filter((l) => !q || `${l.c.short} ${l.type} ${l.action} ${l.impact}`.toLowerCase().includes(q))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [companies, state.logType, state.logStatus, state.logQuery]);
  const types = useMemo(() => Array.from(new Set(companies.flatMap((c) => c.log.map((l) => l.type)))).sort(), [companies]);
  const statuses = useMemo(() => Array.from(new Set(companies.flatMap((c) => c.log.map((l) => l.status)))).sort(), [companies]);

  const chart = rows.map((r) => ({ name: r.c.short, id: r.c.id, intensity: r.intensity, efficiency: r.efficiency }));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Capex, TTM" value={formatMoney(kpi.capex)} sub="portfolio total" />
        <Kpi label="Capex intensity" value={formatPct(kpi.intensity)} sub="of revenue" />
        <Kpi label="Capex efficiency" value={formatMultiple(kpi.efficiency)} sub="revenue added per capex $" help="Last fiscal year's revenue gain ÷ trailing capex" />
        <Kpi label="Stores" value={formatCount(kpi.stores)} sub="as last disclosed" />
        <Kpi label="Productivity index" value={kpi.prod === null ? "—" : kpi.prod.toFixed(0)} sub="median; 100 = sector norm" help="Sales per store vs sector median. Facility utilization isn't published, so this is the proxy." />
        <Kpi label="Disclosed savings" value={kpi.impact ? formatMoney(kpi.impact) : "None"} sub={kpi.impacts.length ? `${kpi.impacts.length} quantified program${kpi.impacts.length > 1 ? "s" : ""}` : "for this portfolio"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card title="Facility & capital efficiency" subtitle="Productivity index compares sales per store with the sector median and stands in for facility utilization, which no company publishes.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-[12.5px]">
              <thead>
                <tr className="border-b border-line text-left text-[10.5px] uppercase tracking-[0.08em] text-ink-3">
                  <th className="py-2 pr-3 font-semibold">Company</th>
                  <th className="py-2 pr-3 text-right font-semibold">Stores</th>
                  <th className="py-2 pr-3 text-right font-semibold">Sales / store</th>
                  <th className="py-2 pr-3 text-right font-semibold">Productivity</th>
                  <th className="py-2 pr-3 text-right font-semibold">Capex</th>
                  <th className="py-2 pr-3 text-right font-semibold">Intensity</th>
                  <th className="py-2 pr-3 text-right font-semibold">Efficiency</th>
                  <th className="py-2 pr-3 text-right font-semibold">Sales / employee</th>
                  <th className="py-2 text-right font-semibold">Inv. turns</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.c.id} className="border-b border-line/70 last:border-0">
                    <td className="py-2 pr-3">
                      <span className="flex items-center gap-2 font-medium text-ink"><SeriesDot color={seriesColor(tokens, state.selected, r.c.id)} />{r.c.short}</span>
                      <span className="block pl-[18px] text-[10.5px] text-ink-3" title={r.c.stores.basis}>{r.c.stores.basis}</span>
                    </td>
                    <td className="num py-2 pr-3 text-right text-ink">{r.c.stores.label}{r.c.stores.conf === "low" && <span title="Low-confidence count">*</span>}</td>
                    <td className="num py-2 pr-3 text-right text-ink">{formatMoney(r.perStore)}</td>
                    <td className="py-2 pr-3 text-right"><Status tone={prodTone(r.prod)}>{r.prod === null ? "—" : r.prod.toFixed(0)}</Status></td>
                    <td className="num py-2 pr-3 text-right text-ink">{formatMoney(r.capex)}</td>
                    <td className="num py-2 pr-3 text-right text-ink">{formatPct(r.intensity)}</td>
                    <td className="num py-2 pr-3 text-right text-ink">{formatMultiple(r.efficiency)}</td>
                    <td className="num py-2 pr-3 text-right text-ink">{formatDollars(r.perEmp)}</td>
                    <td className="num py-2 text-right text-ink">{formatMultiple(r.turns)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11.5px] text-ink-3">Productivity: green at 115+, amber under 85. Fuel (Couche-Tard), wholesale (Canada Goose) and e-commerce inflate sales per store. A negative efficiency means revenue fell despite the spending.</p>
        </Card>

        <Card title="Spend vs payoff" subtitle="Bars: capex as a share of revenue. Dots: revenue added per capex dollar.">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chart} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={tokens.line} vertical={false} />
                <XAxis dataKey="name" tick={{ fill: tokens.ink2, fontSize: 11 }} stroke={tokens.line} interval={0} />
                <YAxis yAxisId="l" tickFormatter={(v) => `${v}%`} tick={{ fill: tokens.ink2, fontSize: 11 }} stroke={tokens.line} width={40} />
                <YAxis yAxisId="r" orientation="right" tickFormatter={(v) => `${v}×`} tick={{ fill: tokens.ink2, fontSize: 11 }} stroke={tokens.line} width={40} />
                <Tooltip cursor={{ fill: tokens.sunk }} content={<ChartTooltip render={(p) => {
                  const d = p[0].payload as { name: string; intensity: number; efficiency: number | null };
                  return (<div><b>{d.name}</b><div className="num text-ink-2">Capex intensity {formatPct(d.intensity)}</div><div className="num text-ink-2">Efficiency {formatMultiple(d.efficiency)}</div></div>);
                }} />} />
                <Legend wrapperStyle={{ fontSize: 11, color: tokens.ink2 }} />
                <Bar yAxisId="l" dataKey="intensity" name="Capex intensity" fill={tokens.ink3} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                <Scatter yAxisId="r" dataKey="efficiency" name="Revenue added per capex $" fill={tokens.ink} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card
        title="Operational & facility optimization log"
        subtitle="Dated actions from company releases and calls: openings, renovations, facilities, restructuring and cost programs."
        actions={
          <div className="flex flex-wrap items-end gap-3">
            <Select id="lt" label="Type" value={state.logType} onChange={(v) => dispatch({ type: "logFilter", field: "logType", value: v })}>
              <option value="All">All types</option>
              {types.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
            <Select id="ls" label="Status" value={state.logStatus} onChange={(v) => dispatch({ type: "logFilter", field: "logStatus", value: v })}>
              <option value="All">All statuses</option>
              {statuses.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
            <label className="flex flex-col gap-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">
              Search
              <input type="search" value={state.logQuery} onChange={(e) => dispatch({ type: "logFilter", field: "logQuery", value: e.target.value })}
                placeholder="e.g. distribution" className="w-44 rounded-lg border border-line bg-panel px-2.5 py-1.5 text-[12.5px] font-normal normal-case tracking-normal text-ink" />
            </label>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-[12.5px]">
            <thead>
              <tr className="border-b border-line text-left text-[10.5px] uppercase tracking-[0.08em] text-ink-3">
                <th className="py-2 pr-3 font-semibold">Date</th>
                <th className="py-2 pr-3 font-semibold">Company</th>
                <th className="py-2 pr-3 font-semibold">Type</th>
                <th className="py-2 pr-3 font-semibold">Action</th>
                <th className="py-2 pr-3 font-semibold">Impact</th>
                <th className="py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {log.map((l, i) => (
                <tr key={i} className="border-b border-line/70 align-top last:border-0">
                  <td className="num whitespace-nowrap py-2 pr-3 text-ink-2">{formatDate(l.date)}</td>
                  <td className="whitespace-nowrap py-2 pr-3 font-medium text-ink">{l.c.short}</td>
                  <td className="whitespace-nowrap py-2 pr-3 text-ink-2">{l.type}</td>
                  <td className="py-2 pr-3 text-ink">{l.action}</td>
                  <td className="py-2 pr-3 text-ink-2">{l.impact || "—"}</td>
                  <td className="py-2"><Status tone={statusTone(l.status)}>{l.status}</Status></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!log.length && <p className="py-6 text-center text-[13px] text-ink-2">No log entries match these filters. Clear the search or pick “All types”.</p>}
        </div>
        {kpi.impacts.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1 text-[12px] text-ink-2">
            {kpi.impacts.map((d) => (
              <li key={d.id}><b className="text-ink">{BY_ID[d.id].short}</b> {formatMoney(d.value)} · {d.what}</li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

