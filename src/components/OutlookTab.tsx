/** Tab 4 — Outlook & Actions: consensus forecasts, current initiatives and recommended moves. */
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BY_ID, COMPANIES, DATA, type Company } from "../data/schema";
import * as F from "../lib/finance";
import { formatDate, formatMoney, formatPct, formatPrice } from "../lib/format";
import { useStore } from "../state/store";
import { seriesColor } from "./FilterBar";
import { Card, ChartTooltip, Segmented, SeriesDot, Source, Status, type Tokens, type Tone } from "./ui";

const trajTone: Record<F.Trajectory, Tone> = { accelerating: "good", steady: "neutral", slowing: "warn", declining: "bad", "n/a": "neutral" };
const trajLabel: Record<F.Trajectory, string> = { accelerating: "Accelerating", steady: "Steady", slowing: "Slowing", declining: "Declining", "n/a": "No forecast" };

function ForecastChart({ tokens }: { tokens: Tokens }) {
  const { state, dispatch } = useStore();
  const ids = state.peerScope === "all" ? COMPANIES.map((c) => c.id) : state.selected;
  const data = useMemo(
    () =>
      ids
        .map((id) => BY_ID[id])
        .filter((c) => c.forecast)
        .map((c) => ({ id: c.id, name: c.short, thisG: c.forecast!.thisG, nextG: c.forecast!.nextG }))
        .sort((a, b) => b.nextG - a.nextG),
    [ids],
  );
  const noForecast = ids.map((id) => BY_ID[id]).filter((c) => !c.forecast).map((c) => c.short);

  return (
    <Card
      title="Where revenue is heading"
      subtitle="Analyst consensus revenue growth for each company's current and next fiscal year. Green is growth, red is decline."
      actions={
        <Segmented<"all" | "selected">
          label="Scope"
          value={state.peerScope}
          onChange={(s) => dispatch({ type: "peerScope", scope: s })}
          options={[{ value: "all", label: "All 14" }, { value: "selected", label: "Portfolio only" }]}
        />
      }
    >
      <div style={{ height: Math.max(220, data.length * 34 + 60) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 8 }} barGap={2}>
            <CartesianGrid stroke={tokens.line} horizontal={false} />
            <XAxis type="number" tickFormatter={(v) => `${v}%`} tick={{ fill: tokens.ink2, fontSize: 11 }} stroke={tokens.line} />
            <YAxis type="category" dataKey="name" width={124} tick={{ fill: tokens.ink, fontSize: 12 }} stroke={tokens.line} />
            <ReferenceLine x={0} stroke={tokens.ink3} />
            <Tooltip cursor={{ fill: tokens.sunk }} content={<ChartTooltip render={(p) => {
              const d = p[0].payload as { name: string; thisG: number; nextG: number };
              return (<div><b>{d.name}</b><div className="num text-ink-2">This FY {formatPct(d.thisG, { signed: true })}</div><div className="num text-ink-2">Next FY {formatPct(d.nextG, { signed: true })}</div></div>);
            }} />} />
            <Legend wrapperStyle={{ fontSize: 11, color: tokens.ink2 }} payload={[
              { value: "This fiscal year (lighter)", type: "square", color: tokens.ink3 },
              { value: "Next fiscal year", type: "square", color: tokens.ink },
            ]} />
            <Bar dataKey="thisG" name="This FY" isAnimationActive={false} barSize={10}>
              {data.map((d) => <Cell key={d.id} fill={d.thisG < 0 ? tokens.neg : tokens.pos} fillOpacity={0.45} />)}
            </Bar>
            <Bar dataKey="nextG" name="Next FY" isAnimationActive={false} barSize={10}>
              {data.map((d) => <Cell key={d.id} fill={d.nextG < 0 ? tokens.neg : tokens.pos} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {noForecast.length > 0 && <p className="mt-1 text-[11.5px] text-ink-3">No consensus: {noForecast.join(", ")} (Roots is being taken private).</p>}
    </Card>
  );
}

function CompanyBrief({ c, tokens, color }: { c: Company; tokens: Tokens; color: string }) {
  const f = c.forecast;
  const traj = F.trajectory(c);
  const up = F.targetUpside(c);
  const engines = DATA.meta.engines.filter((e) => c.engines[e.key] && c.engines[e.key].level !== "exit");
  const recent = [...c.log].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-xl border border-line bg-panel p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 font-display text-[16px] font-semibold text-ink"><SeriesDot color={color} />{c.name}</h3>
          <p className="text-[12px] text-ink-3">{c.ticker} · {c.sector} · HQ {c.hq}</p>
        </div>
        <Status tone={trajTone[traj]}>{trajLabel[traj]}</Status>
      </header>

      {f ? (
        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line text-[12px]">
          <div className="bg-panel px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-3">This FY</div>
            <div className={`num text-[16px] font-semibold ${f.thisG < 0 ? "text-neg" : "text-ink"}`}>{formatPct(f.thisG, { signed: true })}</div>
            <div className="num text-ink-3">{formatMoney(f.thisRev)}</div>
          </div>
          <div className="bg-panel px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-3">Next FY</div>
            <div className={`num text-[16px] font-semibold ${f.nextG < 0 ? "text-neg" : "text-ink"}`}>{formatPct(f.nextG, { signed: true })}</div>
            <div className="num text-ink-3">{formatMoney(f.nextRev)}</div>
          </div>
          <div className="bg-panel px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-3">Analysts</div>
            <div className="text-[13px] font-semibold text-ink">{f.rating} · {f.analysts}</div>
            <div className="num text-ink-3">Target {formatPrice(f.pt, f.ptCcy)} ({formatPct(up, { signed: true })})</div>
          </div>
        </div>
      ) : (
        <p className="rounded-lg bg-sunk px-3 py-2 text-[12.5px] text-ink-2">No analyst consensus. The share price is anchored by a takeover offer.</p>
      )}
      {f && <p className="text-[11px] text-ink-3">{f.fy} · consensus updated {formatDate(f.updated)}</p>}
      {c.guidance && <p className="text-[12.5px] text-ink-2"><b className="text-ink">Guidance:</b> {c.guidance}</p>}

      <div>
        <h4 className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">Working on now</h4>
        <ul className="flex flex-col gap-1.5 text-[12.5px]">
          {recent.map((l, i) => (
            <li key={i} className="flex gap-2">
              <span className="num w-[74px] shrink-0 text-ink-3">{formatDate(l.date).replace(/, \d{4}$/, "")}</span>
              <span className="min-w-0 text-ink">{l.action}{l.impact && <span className="text-ink-2"> — {l.impact}</span>}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg border border-line bg-sunk px-3 py-2.5">
        <h4 className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-2">RetailXpert recommends</h4>
        <ol className="flex list-decimal flex-col gap-1.5 pl-4 text-[12.5px] text-ink">
          {c.actions.map((a, i) => <li key={i}>{a}</li>)}
        </ol>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {engines.map((e) => (
          <span key={e.key} title={c.engines[e.key].evidence} className="rounded-md border border-line px-1.5 py-0.5 text-[11px] text-ink-2">
            {c.engines[e.key].level === "build" ? "◌ " : "● "}{e.label}
          </span>
        ))}
      </div>
      <footer className="mt-auto flex flex-wrap gap-3 text-[11.5px]">
        {c.sources.map((s, i) => <Source key={s} href={s}>{`Source ${i + 1}`}</Source>)}
        <Source href={c.sourceUrl.replace(/\/$/, "") + "/forecast/"}>Forecast</Source>
      </footer>
    </article>
  );
}

export function OutlookTab({ tokens }: { tokens: Tokens }) {
  const { state } = useStore();
  const companies = useMemo(
    () => state.selected.map((id) => BY_ID[id]).sort((a, b) => (b.forecast?.nextG ?? -99) - (a.forecast?.nextG ?? -99)),
    [state.selected],
  );
  return (
    <div className="flex flex-col gap-4">
      <ForecastChart tokens={tokens} />
      <div>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-[15px] font-semibold text-ink">Portfolio briefs</h2>
          <p className="text-[12px] text-ink-3">Recommendations are RetailXpert analysis of the published figures, not company plans or investment advice.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {companies.map((c) => <CompanyBrief key={c.id} c={c} tokens={tokens} color={seriesColor(tokens, state.selected, c.id)} />)}
        </div>
      </div>
    </div>
  );
}
