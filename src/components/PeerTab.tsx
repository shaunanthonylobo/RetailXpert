/** Tab 2 — Cross-company peer comparison matrix, explorer and revenue-engine map. */
import { useMemo, useState } from "react";
import { CartesianGrid, LabelList, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { COMPANIES, DATA, type Company } from "../data/schema";
import { formatByUnit } from "../lib/format";
import * as F from "../lib/finance";
import { METRICS, METRIC_BY_KEY, rankOf, type MetricTable } from "../lib/metrics";
import { useStore } from "../state/store";
import { seriesColor } from "./FilterBar";
import { Card, ChartTooltip, Chip, Segmented, Select, SeriesDot, Status, cx, type Tokens } from "./ui";

const GROUPS = Array.from(new Set(METRICS.map((m) => m.group)));

function Matrix({ table, tokens }: { table: MetricTable; tokens: Tokens }) {
  const { state, dispatch } = useStore();
  const ids = state.peerScope === "all" ? COMPANIES.map((c) => c.id) : state.selected;
  const cols = state.peerMetrics.map((k) => METRIC_BY_KEY[k]).filter(Boolean);
  const sortKey = cols.some((c) => c.key === state.peerSort.key) ? state.peerSort.key : cols[0].key;

  const rows = useMemo(() => {
    const list = ids.map((id) => COMPANIES.find((c) => c.id === id)!);
    return list.sort((a, b) => {
      const x = table[a.id][sortKey];
      const y = table[b.id][sortKey];
      if (x === null) return 1;
      if (y === null) return -1;
      return (x - y) * state.peerSort.dir;
    });
  }, [ids, table, sortKey, state.peerSort.dir]);

  const medians = useMemo(
    () => Object.fromEntries(cols.map((m) => [m.key, F.median(ids.map((id) => table[id][m.key]).filter((v): v is number => v !== null))])),
    [cols, ids, table],
  );

  return (
    <Card
      title="Peer comparison matrix"
      subtitle="Each cell shows the value and its rank in the current scope. Shading deepens with rank on measures where better is defined. Click a column to sort."
      actions={
        <Segmented<"all" | "selected">
          label="Scope"
          value={state.peerScope}
          onChange={(s) => dispatch({ type: "peerScope", scope: s })}
          options={[{ value: "all", label: "All 14" }, { value: "selected", label: "Portfolio only" }]}
        />
      }
    >
      <div className="mb-4 flex flex-col gap-2">
        {GROUPS.map((g) => (
          <div key={g} className="flex flex-wrap items-center gap-1.5">
            <span className="w-28 shrink-0 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">{g}</span>
            {METRICS.filter((m) => m.group === g).map((m) => (
              <Chip key={m.key} title={m.help} active={state.peerMetrics.includes(m.key)} onClick={() => dispatch({ type: "togglePeerMetric", key: m.key })}>
                {m.short}
              </Chip>
            ))}
          </div>
        ))}
      </div>
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full border-collapse text-[12.5px]" style={{ minWidth: 200 + cols.length * 118 }}>
          <thead>
            <tr className="bg-sunk text-left">
              <th className="sticky left-0 z-10 bg-sunk px-3 py-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">Company</th>
              {cols.map((m) => (
                <th key={m.key} className="px-3 py-2 text-right" title={m.help}>
                  <button type="button" onClick={() => dispatch({ type: "peerSort", key: m.key })}
                    className="inline-flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-2 hover:text-ink"
                    aria-sort={sortKey === m.key ? (state.peerSort.dir < 0 ? "descending" : "ascending") : "none"}>
                    {m.short}
                    <span aria-hidden="true" className="text-ink-3">{sortKey === m.key ? (state.peerSort.dir < 0 ? "↓" : "↑") : "↕"}</span>
                  </button>
                  <div className="text-[10px] font-normal normal-case tracking-normal text-ink-3">{m.better === "high" ? "higher better" : m.better === "low" ? "lower better" : "context"}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const inPortfolio = state.selected.includes(c.id);
              return (
                <tr key={c.id} className={cx("border-t border-line", inPortfolio && "bg-sunk/60")}>
                  <th scope="row" className={cx("sticky left-0 z-10 px-3 py-2 text-left font-medium", inPortfolio ? "bg-sunk" : "bg-panel")}>
                    <button type="button" onClick={() => dispatch({ type: "toggleCompany", id: c.id })} className="flex items-center gap-2 text-ink" title={inPortfolio ? "Remove from portfolio" : "Add to portfolio"}>
                      <SeriesDot color={seriesColor(tokens, state.selected, c.id)} />
                      <span className="max-w-[140px] truncate">{c.short}</span>
                    </button>
                    <div className="pl-[18px] text-[10.5px] font-normal text-ink-3">{c.sector}</div>
                  </th>
                  {cols.map((m) => {
                    const v = table[c.id][m.key];
                    const r = rankOf(table, ids, m.key, c.id);
                    const strength = m.better && r ? 1 - (r.rank - 1) / Math.max(1, r.n - 1) : 0;
                    return (
                      <td key={m.key} className="px-3 py-2 text-right" style={{ background: m.better && v !== null ? `color-mix(in srgb, ${tokens.ink} ${Math.round(strength * 9)}%, transparent)` : undefined }}>
                        <div className={cx("num", r?.rank === 1 && m.better ? "font-semibold text-ink" : "text-ink")}>{formatByUnit(v, m.unit, m.signed)}</div>
                        <div className="num text-[10.5px] text-ink-3">{r ? `#${r.rank} of ${r.n}` : "not meaningful"}</div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            <tr className="border-t-2 border-line bg-sunk">
              <th scope="row" className="sticky left-0 z-10 bg-sunk px-3 py-2 text-left text-[11.5px] font-semibold text-ink-2">Median</th>
              {cols.map((m) => (
                <td key={m.key} className="num px-3 py-2 text-right text-[12px] text-ink-2">{formatByUnit(medians[m.key], m.unit, m.signed)}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Explorer({ table, tokens }: { table: MetricTable; tokens: Tokens }) {
  const { state, dispatch } = useStore();
  const mx = METRIC_BY_KEY[state.scatter.x];
  const my = METRIC_BY_KEY[state.scatter.y];
  const points = useMemo(
    () =>
      COMPANIES.map((c) => ({ id: c.id, name: c.short, x: table[c.id][mx.key], y: table[c.id][my.key], z: c.ttm.revenue }))
        .filter((p): p is { id: string; name: string; x: number; y: number; z: number } => p.x !== null && p.y !== null),
    [table, mx, my],
  );
  const missing = COMPANIES.filter((c) => !points.some((p) => p.id === c.id)).map((c) => c.short);
  const medX = F.median(points.map((p) => p.x));
  const medY = F.median(points.map((p) => p.y));
  const sel = points.filter((p) => state.selected.includes(p.id));
  const rest = points.filter((p) => !state.selected.includes(p.id));
  const options = METRICS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>);

  return (
    <Card
      title="Explorer"
      subtitle="Plot any two measures. Bubble size is revenue. Dashed lines are medians, so the top-right quadrant beats the median on both."
      actions={
        <div className="flex flex-wrap gap-3">
          <Select id="sx" label="Across" value={mx.key} onChange={(k) => dispatch({ type: "scatter", axis: "x", key: k })}>{options}</Select>
          <Select id="sy" label="Up" value={my.key} onChange={(k) => dispatch({ type: "scatter", axis: "y", key: k })}>{options}</Select>
        </div>
      }
    >
      <div className="h-[380px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 12, right: 24, bottom: 12, left: 4 }}>
            <CartesianGrid stroke={tokens.line} />
            <XAxis type="number" dataKey="x" name={mx.label} tickFormatter={(v) => formatByUnit(v, mx.unit)} tick={{ fill: tokens.ink2, fontSize: 11 }} stroke={tokens.line}
              domain={["auto", "auto"]} label={{ value: `${mx.label} →`, position: "insideBottom", offset: -6, fill: tokens.ink, fontSize: 12 }} />
            <YAxis type="number" dataKey="y" name={my.label} tickFormatter={(v) => formatByUnit(v, my.unit)} tick={{ fill: tokens.ink2, fontSize: 11 }} stroke={tokens.line}
              domain={["auto", "auto"]} width={70} label={{ value: `${my.label} →`, angle: -90, position: "insideLeft", fill: tokens.ink, fontSize: 12, dy: 60 }} />
            <ZAxis type="number" dataKey="z" range={[40, 900]} />
            {medX !== null && <ReferenceLine x={medX} stroke={tokens.ink3} strokeDasharray="4 4" />}
            {medY !== null && <ReferenceLine y={medY} stroke={tokens.ink3} strokeDasharray="4 4" />}
            <Tooltip cursor={false} content={<ChartTooltip render={(p) => {
              const d = p[0].payload as { name: string; x: number; y: number; z: number };
              return (<div><b>{d.name}</b><div className="num text-ink-2">{mx.label}: {formatByUnit(d.x, mx.unit, mx.signed)}</div><div className="num text-ink-2">{my.label}: {formatByUnit(d.y, my.unit, my.signed)}</div><div className="num text-ink-3">Revenue {formatByUnit(d.z, "money")}</div></div>);
            }} />} />
            <Scatter data={rest} fill={tokens.ink3} fillOpacity={0.35} stroke={tokens.ink3} isAnimationActive={false}>
              <LabelList dataKey="name" position="right" style={{ fill: tokens.ink2, fontSize: 11 }} />
            </Scatter>
            {sel.map((p) => (
              <Scatter key={p.id} data={[p]} fill={seriesColor(tokens, state.selected, p.id)} fillOpacity={0.8} isAnimationActive={false}>
                <LabelList dataKey="name" position="right" style={{ fill: tokens.ink, fontSize: 12, fontWeight: 600 }} />
              </Scatter>
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      {missing.length > 0 && <p className="mt-1 text-[11.5px] text-ink-3">Not plotted (no meaningful value): {missing.join(", ")}.</p>}
    </Card>
  );
}

function EngineMap({ tokens }: { tokens: Tokens }) {
  const { state } = useStore();
  const [focus, setFocus] = useState<{ c: Company; key: string } | null>(null);
  const engines = DATA.meta.engines;
  const rows = useMemo(() => [...COMPANIES].sort((a, b) => F.engineBreadth(b) - F.engineBreadth(a)), []);
  const label = (k: string) => engines.find((e) => e.key === k)?.label ?? k;

  return (
    <Card
      title="Revenue engines beyond the till"
      subtitle="Where each company makes or is building money outside plain store sales. Filled = core today, ring = being built now, crossed = recently exited. Select a mark to see the evidence."
    >
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full border-collapse text-[12px]" style={{ minWidth: 220 + engines.length * 64 }}>
          <thead>
            <tr className="bg-sunk">
              <th className="sticky left-0 z-10 bg-sunk px-3 py-2 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">Company</th>
              <th className="px-2 py-2 text-center text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">Breadth</th>
              {engines.map((e) => (
                <th key={e.key} className="px-1 py-2 align-bottom text-[10.5px] font-medium text-ink-2">
                  <span className="mx-auto block max-w-[64px] leading-tight">{e.label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className={cx("border-t border-line", state.selected.includes(c.id) && "bg-sunk/60")}>
                <th scope="row" className="sticky left-0 z-10 bg-panel px-3 py-1.5 text-left font-medium text-ink">
                  <span className="flex items-center gap-2"><SeriesDot color={seriesColor(tokens, state.selected, c.id)} />{c.short}</span>
                </th>
                <td className="num px-2 text-center font-semibold text-ink">{F.engineBreadth(c)}</td>
                {engines.map((e) => {
                  const v = c.engines[e.key];
                  if (!v) return <td key={e.key} className="text-center text-ink-3/60">·</td>;
                  const active = focus?.c.id === c.id && focus.key === e.key;
                  return (
                    <td key={e.key} className="text-center">
                      <button type="button" onClick={() => setFocus(active ? null : { c, key: e.key })} aria-pressed={active}
                        aria-label={`${c.short}: ${e.label}, ${v.level === "core" ? "core" : v.level === "build" ? "being built" : "exited"}`}
                        className={cx("mx-auto grid h-6 w-6 place-items-center rounded-full", active && "ring-2 ring-ink ring-offset-1 ring-offset-panel")}>
                        {v.level === "core" && <span className="h-3 w-3 rounded-full bg-ink" />}
                        {v.level === "build" && <span className="h-3 w-3 rounded-full border-2 border-ink" />}
                        {v.level === "exit" && <span className="text-[13px] font-bold text-warn">✕</span>}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 min-h-[44px] rounded-lg border border-line bg-sunk px-3 py-2 text-[12.5px]" aria-live="polite">
        {focus ? (
          <span>
            <b className="text-ink">{focus.c.short} · {label(focus.key)}</b>{" "}
            <Status tone={focus.c.engines[focus.key].level === "exit" ? "warn" : "neutral"}>
              {focus.c.engines[focus.key].level === "core" ? "Core" : focus.c.engines[focus.key].level === "build" ? "Building" : "Exited"}
            </Status>{" "}
            <span className="text-ink-2">{focus.c.engines[focus.key].evidence}</span>
          </span>
        ) : (
          <span className="text-ink-3">Breadth counts core and in-build engines. Loblaw and Canadian Tire monetize loyalty data; Pet Valu and Canadian Tire run on franchise models; Aritzia and Groupe Dynamite grow through the U.S.</span>
        )}
      </div>
    </Card>
  );
}

export function PeerTab({ table, tokens }: { table: MetricTable; tokens: Tokens }) {
  return (
    <div className="flex flex-col gap-4">
      <Matrix table={table} tokens={tokens} />
      <div className="grid gap-4 2xl:grid-cols-2">
        <Explorer table={table} tokens={tokens} />
        <EngineMap tokens={tokens} />
      </div>
    </div>
  );
}
