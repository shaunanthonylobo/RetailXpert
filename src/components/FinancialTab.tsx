/** Tab 1 — Financial & Growth Analytics: KPIs, alerts, revenue timeline, growth table, payout engine. */
import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar, Legend } from "recharts";
import { BY_ID, DATA, type Company } from "../data/schema";
import * as F from "../lib/finance";
import { daysBetween, formatDate, formatMoney, formatMonth, formatPct } from "../lib/format";
import { useStore, type RevenueView } from "../state/store";
import { seriesColor } from "./FilterBar";
import { Card, ChartTooltip, Delta, Kpi, Segmented, SeriesDot, Status, type Tokens, type Tone } from "./ui";

/* ---------------- alerts ---------------- */

interface Alert {
  tone: Tone;
  company: Company;
  text: string;
  weight: number;
}

export function buildAlerts(companies: Company[], range: F.Range): Alert[] {
  const out: Alert[] = [];
  for (const c of companies) {
    const f = c.forecast;
    if (f && f.thisG < 0) out.push({ tone: "bad", company: c, weight: 3, text: `Consensus sees revenue falling ${formatPct(Math.abs(f.thisG))} this fiscal year.` });
    else if (f && f.nextG < 0) out.push({ tone: "bad", company: c, weight: 3, text: `Consensus sees revenue slipping ${formatPct(Math.abs(f.nextG))} next fiscal year.` });
    const last = c.quarters[c.quarters.length - 1];
    const yoy = F.yoyQuarter(c, last);
    if (yoy !== null && yoy < 0) out.push({ tone: "warn", company: c, weight: 2, text: `Latest quarter (${formatDate(last.end)}) down ${formatPct(Math.abs(yoy))} year over year, per week.` });
    const losses = F.quartersIn(c, range).filter((q) => q.netIncome !== null && q.netIncome < 0).length;
    if (losses) out.push({ tone: "warn", company: c, weight: 1, text: `${losses} loss-making quarter${losses > 1 ? "s" : ""} in the selected period.` });
    const age = daysBetween(c.quote.date, DATA.meta.asOf);
    if (age > 21) out.push({ tone: "warn", company: c, weight: 1, text: `Share price is ${age} days old (${formatDate(c.quote.date)}).` });
    for (const l of c.log) {
      if (l.status === "Ongoing" || l.status === "Watch") out.push({ tone: "bad", company: c, weight: 2, text: `${l.action}. ${l.impact}` });
      if (l.status === "Pending") out.push({ tone: "neutral", company: c, weight: 0, text: `${l.action}. ${l.impact}` });
    }
    if (f && f.thisG >= 10) out.push({ tone: "good", company: c, weight: 0, text: `Consensus sees revenue growing ${formatPct(f.thisG)} this fiscal year.` });
  }
  return out.sort((a, b) => b.weight - a.weight);
}

function Alerts({ companies, range }: { companies: Company[]; range: F.Range }) {
  const [all, setAll] = useState(false);
  const alerts = useMemo(() => buildAlerts(companies, range), [companies, range]);
  const shown = all ? alerts : alerts.slice(0, 6);
  return (
    <Card title="Signals to act on" subtitle="Generated from forecasts, latest quarters, prices and the operations log." className="h-full">
      {alerts.length === 0 ? (
        <p className="text-[13px] text-ink-2">No warnings for this portfolio and period.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((a, i) => (
            <li key={i} className="flex items-start gap-2 text-[12.5px] leading-snug">
              <Status tone={a.tone}>{a.tone === "bad" ? "Risk" : a.tone === "warn" ? "Watch" : a.tone === "good" ? "Strong" : "Event"}</Status>
              <span className="min-w-0 text-ink-2">
                <b className="font-semibold text-ink">{a.company.short}</b> {a.text}
              </span>
            </li>
          ))}
        </ul>
      )}
      {alerts.length > 6 && (
        <button type="button" onClick={() => setAll((x) => !x)} className="mt-3 text-[12px] text-ink-2 underline underline-offset-2 hover:text-ink">
          {all ? "Show fewer" : `Show all ${alerts.length}`}
        </button>
      )}
    </Card>
  );
}

/* ---------------- revenue timeline ---------------- */

function RevenueTimeline({ companies, tokens }: { companies: Company[]; tokens: Tokens }) {
  const { state, dispatch, range } = useStore();
  const series = useMemo(
    () =>
      companies.map((c) => {
        const qs = F.quartersIn(c, range);
        const base = qs.length ? F.perWeek(qs[0]) : 1;
        return {
          c,
          points: qs.map((q) => ({
            t: Date.parse(q.end),
            end: q.end,
            weeks: q.weeks,
            v: state.revenueView === "reported" ? q.revenue : state.revenueView === "perWeek" ? F.perWeek(q) : (F.perWeek(q) / base) * 100,
          })),
        };
      }),
    [companies, range, state.revenueView],
  );
  const t0 = Date.parse(range.start);
  const t1 = Date.parse(range.end);
  const ticks = useMemo(() => {
    const out: number[] = [];
    const d = new Date(t0);
    d.setUTCDate(1);
    d.setUTCMonth(Math.ceil(d.getUTCMonth() / 3) * 3);
    while (d.getTime() <= t1) {
      out.push(d.getTime());
      d.setUTCMonth(d.getUTCMonth() + 3);
    }
    return out;
  }, [t0, t1]);
  const fmtY = (v: number) => (state.revenueView === "indexed" ? v.toFixed(0) : formatMoney(v));
  const sixteen = companies.filter((c) => F.quartersIn(c, range).some((q) => (q.weeks ?? 13) >= 16));

  return (
    <Card
      title="Revenue by quarter"
      subtitle={
        state.revenueView === "reported"
          ? sixteen.length
            ? `Reported sales. ${sixteen.map((c) => c.short).join(", ")} ${sixteen.length > 1 ? "report" : "reports"} a 16-week quarter, which shows up as a spike; switch to Per week to remove it.`
            : "Reported sales at each quarter's real end date."
          : state.revenueView === "perWeek"
            ? "Sales per week of each quarter, so 12-, 13- and 16-week quarters compare fairly."
            : "Weekly sales indexed to each company's first quarter in the period = 100."
      }
      actions={
        <Segmented<RevenueView>
          label="Revenue view"
          value={state.revenueView}
          onChange={(v) => dispatch({ type: "revenueView", view: v })}
          options={[
            { value: "reported", label: "Reported" },
            { value: "perWeek", label: "Per week" },
            { value: "indexed", label: "Indexed" },
          ]}
        />
      }
    >
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart margin={{ top: 8, right: 16, bottom: 0, left: 4 }}>
            <CartesianGrid stroke={tokens.line} vertical={false} />
            <XAxis dataKey="t" type="number" domain={[t0, t1]} ticks={ticks} tickFormatter={(t) => formatMonth(new Date(t).toISOString())}
              tick={{ fill: tokens.ink2, fontSize: 11 }} stroke={tokens.line} allowDuplicatedCategory={false} />
            <YAxis tickFormatter={fmtY} tick={{ fill: tokens.ink2, fontSize: 11 }} stroke={tokens.line} width={64}
              scale={state.revenueView === "indexed" ? "linear" : "log"} domain={["auto", "auto"]} allowDataOverflow={false} />
            <Tooltip
              content={
                <ChartTooltip
                  render={(p) => {
                    const row = p[0].payload as { end: string; weeks: number | null };
                    return (
                      <div className="flex flex-col gap-1">
                        <div className="text-ink-2">Quarter ended {formatDate(row.end)}</div>
                        {p.map((x, i) => {
                          const item = x as unknown as { name: string; value: number; color: string; payload: { weeks: number | null } };
                          return (
                            <div key={i} className="flex items-center justify-between gap-4">
                              <span className="flex items-center gap-1.5"><SeriesDot color={item.color} />{item.name}</span>
                              <span className="num">{fmtY(item.value)}{item.payload.weeks ? <span className="text-ink-3"> · {item.payload.weeks} wk</span> : null}</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  }}
                />
              }
            />
            {series.map((s) => (
              <Line key={s.c.id} data={s.points} dataKey="v" name={s.c.short} type="monotone" stroke={seriesColor(tokens, state.selected, s.c.id)}
                strokeWidth={2} dot={{ r: 2.5 }} activeDot={{ r: 4 }} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {state.revenueView !== "indexed" && <p className="mt-2 text-[11.5px] text-ink-3">Log scale: the companies here differ in size by up to 400×.</p>}
    </Card>
  );
}

/* ---------------- growth table ---------------- */

function GrowthTable({ companies, tokens }: { companies: Company[]; tokens: Tokens }) {
  const { state, range } = useStore();
  const prior = F.priorRange(range);
  const rows = useMemo(
    () =>
      companies.map((c) => {
        const now = F.quartersIn(c, range);
        const before = F.quartersIn(c, prior);
        const rev = F.sum(now.map((q) => q.revenue));
        const revPrior = F.sum(before.map((q) => q.revenue));
        const ni = now.every((q) => q.netIncome !== null) ? F.sum(now.map((q) => q.netIncome as number)) : null;
        return {
          c,
          n: now.length,
          rev,
          growth: before.length === now.length && now.length ? F.pctChange(rev, revPrior) : null,
          netMargin: ni !== null && rev ? (ni / rev) * 100 : null,
          ebitda: F.ebitdaMargin(c),
          cagr: F.annualCagr(c),
          lastQ: F.yoyQuarter(c, c.quarters[c.quarters.length - 1]),
        };
      }),
    [companies, range, prior],
  );
  return (
    <Card title="Growth and margins" subtitle="Period figures use the quarters inside the selected range. EBITDA margin and CAGR are trailing and full-year figures.">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-[12.5px]">
          <thead>
            <tr className="border-b border-line text-left text-[10.5px] uppercase tracking-[0.08em] text-ink-3">
              <th className="py-2 pr-3 font-semibold">Company</th>
              <th className="py-2 pr-3 text-right font-semibold">Revenue, period</th>
              <th className="py-2 pr-3 text-right font-semibold">vs prior period</th>
              <th className="py-2 pr-3 text-right font-semibold">Net margin, period</th>
              <th className="py-2 pr-3 text-right font-semibold">EBITDA margin, TTM</th>
              <th className="py-2 pr-3 text-right font-semibold">CAGR, 4 yrs</th>
              <th className="py-2 text-right font-semibold">Latest Q, YoY/wk</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.c.id} className="border-b border-line/70 last:border-0">
                <td className="py-2 pr-3">
                  <span className="flex items-center gap-2 font-medium text-ink"><SeriesDot color={seriesColor(tokens, state.selected, r.c.id)} />{r.c.short}
                    <span className="text-[11px] font-normal text-ink-3">{r.n} qtrs</span></span>
                </td>
                <td className="num py-2 pr-3 text-right text-ink">{formatMoney(r.rev)}</td>
                <td className="py-2 pr-3 text-right"><Delta value={r.growth} text={formatPct(r.growth === null ? null : Math.abs(r.growth))} /></td>
                <td className="num py-2 pr-3 text-right text-ink">{formatPct(r.netMargin)}</td>
                <td className="num py-2 pr-3 text-right text-ink">{formatPct(r.ebitda)}</td>
                <td className="py-2 pr-3 text-right"><Delta value={r.cagr} text={formatPct(r.cagr === null ? null : Math.abs(r.cagr))} /></td>
                <td className="py-2 text-right"><Delta value={r.lastQ} text={formatPct(r.lastQ === null ? null : Math.abs(r.lastQ))} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11.5px] text-ink-3">“vs prior period” is blank when a company lacks the same number of quarters in the earlier window.</p>
    </Card>
  );
}

/* ---------------- payout engine ---------------- */

function NumberField({ id, label, value, onChange, step = 0.5, min = 0, max = 50, suffix = "%" }: {
  id: string; label: string; value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; suffix?: string;
}) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">
      {label}
      <span className="flex items-center gap-1">
        <input id={id} type="number" step={step} min={min} max={max} value={value}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v)));
          }}
          className="num w-20 rounded-lg border border-line bg-panel px-2 py-1 text-[13px] font-normal text-ink" />
        <span className="text-[12px] font-normal normal-case text-ink-2">{suffix}</span>
      </span>
    </label>
  );
}

function PayoutEngine({ companies, tokens }: { companies: Company[]; tokens: Tokens }) {
  const { state, dispatch, range } = useStore();
  const rule = state.rule;
  const rows = useMemo(() => companies.map((c) => ({ c, ...F.payoutOverRange(c, range, rule) })), [companies, range, rule]);
  const total = F.sum(rows.map((r) => r.total));
  const chart = rows.map((r) => ({ name: r.c.short, base: r.base, bonus: r.bonus }));
  const isTTM = state.preset === "4q";

  return (
    <Card
      title="Stakeholder profit-share engine"
      subtitle={
        rule.kind === "tiered"
          ? `Pays ${rule.baseRate}% of net profit up to a ${rule.thresholdMargin}% net margin, and ${rule.bonusRate}% of any profit above it. Loss quarters pay nothing. Calculated quarter by quarter.`
          : `Pays a flat ${rule.rate}% of net profit in every profitable quarter.`
      }
      actions={
        <Segmented<"tiered" | "flat">
          label="Payout rule"
          value={rule.kind}
          onChange={(k) =>
            dispatch({ type: "rule", rule: k === "flat" ? { kind: "flat", rate: 5 } : { kind: "tiered", baseRate: 5, bonusRate: 7.5, thresholdMargin: 15 } })
          }
          options={[{ value: "tiered", label: "Tiered" }, { value: "flat", label: "Flat" }]}
        />
      }
    >
      <div className="mb-4 flex flex-wrap items-end gap-4">
        {rule.kind === "tiered" ? (
          <>
            <NumberField id="base" label="Base rate" value={rule.baseRate} onChange={(v) => dispatch({ type: "rule", rule: { ...rule, baseRate: v } })} />
            <NumberField id="bonus" label="Rate above threshold" value={rule.bonusRate} onChange={(v) => dispatch({ type: "rule", rule: { ...rule, bonusRate: v } })} />
            <NumberField id="thr" label="Margin threshold" value={rule.thresholdMargin} max={60} onChange={(v) => dispatch({ type: "rule", rule: { ...rule, thresholdMargin: v } })} />
          </>
        ) : (
          <NumberField id="flat" label="Rate" value={rule.rate} onChange={(v) => dispatch({ type: "rule", rule: { kind: "flat", rate: v } })} />
        )}
        <div className="ml-auto text-right">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">Pool, selected period</div>
          <div className="num text-[22px] font-semibold text-ink">{formatMoney(total)}</div>
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="h-[240px] min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 8 }}>
              <CartesianGrid stroke={tokens.line} horizontal={false} />
              <XAxis type="number" tickFormatter={(v) => formatMoney(v)} tick={{ fill: tokens.ink2, fontSize: 11 }} stroke={tokens.line} />
              <YAxis type="category" dataKey="name" width={90} tick={{ fill: tokens.ink, fontSize: 12 }} stroke={tokens.line} />
              <Tooltip cursor={{ fill: tokens.sunk }} content={<ChartTooltip render={(p) => {
                const d = p[0].payload as { name: string; base: number; bonus: number };
                return (<div><b>{d.name}</b><div className="num text-ink-2">Base tier {formatMoney(d.base)}</div><div className="num text-ink-2">Above threshold {formatMoney(d.bonus)}</div></div>);
              }} />} />
              <Legend wrapperStyle={{ fontSize: 11, color: tokens.ink2 }} />
              <Bar dataKey="base" name="Base tier" stackId="p" fill={tokens.ink2} isAnimationActive={false} />
              <Bar dataKey="bonus" name="Above threshold" stackId="p" fill={tokens.ink} isAnimationActive={false} radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full min-w-[520px] text-[12.5px]">
            <thead>
              <tr className="border-b border-line text-left text-[10.5px] uppercase tracking-[0.08em] text-ink-3">
                <th className="py-2 pr-2 font-semibold">Company</th>
                <th className="py-2 pr-2 text-right font-semibold">Net profit</th>
                <th className="py-2 pr-2 text-right font-semibold">Payout</th>
                <th className="py-2 pr-2 text-right font-semibold">Effective</th>
                <th className="py-2 pr-2 text-right font-semibold">Quarters above tier</th>
                <th className="py-2 text-right font-semibold" title="Dividends + buybacks over the trailing twelve months">Actually returned, TTM</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.c.id} className="border-b border-line/70 last:border-0">
                  <td className="py-2 pr-2 font-medium text-ink">{r.c.short}</td>
                  <td className="num py-2 pr-2 text-right text-ink">{r.missing ? <span title="Latest quarter's profit not yet in the data">{formatMoney(r.profit)}*</span> : formatMoney(r.profit)}</td>
                  <td className="num py-2 pr-2 text-right font-semibold text-ink">{formatMoney(r.total)}</td>
                  <td className="num py-2 pr-2 text-right text-ink-2">{formatPct(r.effectiveRate)}</td>
                  <td className="py-2 pr-2 text-right">
                    {rule.kind === "flat" ? <span className="text-ink-3">n/a</span> : <span className="num text-ink">{r.tierQuarters}/{r.rows.length}</span>}
                    {r.lossQuarters > 0 && <span className="ml-1.5"><Status tone="warn">{r.lossQuarters} loss</Status></span>}
                  </td>
                  <td className="num py-2 text-right text-ink-2">{formatMoney(F.actualDistributions(r.c))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11.5px] text-ink-3">
            {isTTM ? "The last column is what each company actually paid out in dividends and buybacks over its trailing twelve months, for scale." : "The last column always covers the trailing twelve months, so compare it with the 12 mo view."}
            {rows.some((r) => r.missing) && " * Excludes a quarter whose profit isn't published yet."}
          </p>
        </div>
      </div>
    </Card>
  );
}

/* ---------------- tab ---------------- */

export function FinancialTab({ tokens }: { tokens: Tokens }) {
  const { state, range } = useStore();
  const companies = useMemo(() => state.selected.map((id) => BY_ID[id]), [state.selected]);
  const kpis = useMemo(() => {
    const prior = F.priorRange(range);
    let rev = 0, revPrior = 0, comparable = true, ni = 0, niMissing = 0;
    for (const c of companies) {
      const now = F.quartersIn(c, range);
      const before = F.quartersIn(c, prior);
      rev += F.sum(now.map((q) => q.revenue));
      if (before.length !== now.length) comparable = false;
      revPrior += F.sum(before.map((q) => q.revenue));
      for (const q of now) {
        if (q.netIncome === null) niMissing++;
        else ni += q.netIncome;
      }
    }
    const withE = companies.filter((c) => F.ebitdaMargin(c) !== null);
    const ebitdaM = withE.length ? (F.sum(withE.map((c) => c.stats.ebitda as number)) / F.sum(withE.map((c) => c.ttm.revenue))) * 100 : null;
    const cagrs = companies.map((c) => ({ w: c.ttm.revenue, v: F.annualCagr(c) })).filter((x) => x.v !== null) as { w: number; v: number }[];
    const cagr = cagrs.length ? F.sum(cagrs.map((x) => x.w * x.v)) / F.sum(cagrs.map((x) => x.w)) : null;
    const payout = F.sum(companies.map((c) => F.payoutOverRange(c, range, state.rule).total));
    return { rev, growth: comparable ? F.pctChange(rev, revPrior) : null, ni, niMissing, ebitdaM, cagr, payout, excluded: companies.length - withE.length };
  }, [companies, range, state.rule]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-3">
          <Kpi label="Portfolio revenue" value={formatMoney(kpis.rev)}
            delta={<Delta value={kpis.growth} text={formatPct(kpis.growth === null ? null : Math.abs(kpis.growth))} />}
            sub={kpis.growth === null ? "no like-for-like prior period" : "vs prior period"} />
          <Kpi label="Net profit" value={formatMoney(kpis.ni)} sub={`${formatPct(kpis.rev ? (kpis.ni / kpis.rev) * 100 : null)} margin${kpis.niMissing ? " · latest Q pending" : ""}`} />
          <Kpi label="EBITDA margin" value={formatPct(kpis.ebitdaM)} sub={`TTM, revenue-weighted${kpis.excluded ? ` · ${kpis.excluded} excluded` : ""}`} />
          <Kpi label="Revenue CAGR" value={formatPct(kpis.cagr, { signed: true })} sub="4 years, revenue-weighted" />
          <Kpi label="Stakeholder payout" value={formatMoney(kpis.payout)} sub={state.rule.kind === "tiered" ? "tiered rule" : `flat ${state.rule.rate}%`} />
          <Kpi label="Companies" value={String(companies.length)} sub={`${formatDate(range.start)} – ${formatDate(range.end)}`} />
        </div>
        <Alerts companies={companies} range={range} />
      </div>
      <RevenueTimeline companies={companies} tokens={tokens} />
      <GrowthTable companies={companies} tokens={tokens} />
      <PayoutEngine companies={companies} tokens={tokens} />
    </div>
  );
}

