/** Shared UI primitives. Neutral by default; semantic colour only via <Status> and <Delta>. */
import React, { useEffect, useState } from "react";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function Card({ title, subtitle, actions, children, className, id }: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cx("min-w-0 rounded-xl border border-line bg-panel p-4 sm:p-5", className)}>
      {(title || actions) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="font-display text-[15px] font-semibold tracking-tight text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 max-w-[70ch] text-[12.5px] leading-relaxed text-ink-2">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export type Tone = "good" | "bad" | "warn" | "neutral";

export function Status({ tone, children, title }: { tone: Tone; children: React.ReactNode; title?: string }) {
  const cls = {
    good: "bg-pos-soft text-pos",
    bad: "bg-neg-soft text-neg",
    warn: "bg-warn-soft text-warn",
    neutral: "bg-sunk text-ink-2",
  }[tone];
  return (
    <span title={title} className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium", cls)}>
      {children}
    </span>
  );
}

/** Trend indicator. Direction is semantic; pass `better="low"` when lower is good. */
export function Delta({ value, text, better = "high" }: { value: number | null; text: string; better?: "high" | "low" | null }) {
  if (value === null || !Number.isFinite(value)) return <span className="text-ink-3">—</span>;
  const up = value > 0;
  const flat = Math.abs(value) < 0.05;
  const good = better === null ? null : better === "high" ? up : !up;
  const cls = flat || good === null ? "text-ink-2" : good ? "text-pos" : "text-neg";
  return (
    <span className={cx("num inline-flex items-center gap-0.5 font-medium", cls)}>
      <span aria-hidden="true">{flat ? "→" : up ? "▲" : "▼"}</span>
      {text}
    </span>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T;
  options: { value: T; label: string; title?: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-lg border border-line bg-sunk p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.title}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            "rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors",
            o.value === value ? "bg-panel text-ink shadow-sm" : "text-ink-2 hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Select({ id, label, value, onChange, children }: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={id} className="flex min-w-0 flex-col gap-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">
      {label}
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 rounded-lg border border-line bg-panel px-2.5 py-1.5 text-[12.5px] font-normal normal-case tracking-normal text-ink"
      >
        {children}
      </select>
    </label>
  );
}

export function Chip({ active, onClick, children, title }: { active: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] transition-colors",
        active ? "border-ink bg-ink text-panel" : "border-line bg-panel text-ink-2 hover:border-ink-3 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

export function Kpi({ label, value, sub, delta, help }: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  delta?: React.ReactNode;
  help?: string;
}) {
  return (
    <div className="min-w-0 bg-panel px-4 py-3.5" title={help}>
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-ink-3">{label}</div>
      <div className="num mt-1 truncate text-[24px] font-semibold leading-tight text-ink">{value}</div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-ink-2">
        {delta}
        {sub}
      </div>
    </div>
  );
}

export function SeriesDot({ color }: { color: string }) {
  return <span aria-hidden="true" className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />;
}

export function Source({ href, children = "Source" }: { href: string; children?: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-ink-2 underline decoration-line underline-offset-2 hover:text-ink">
      {children} ↗
    </a>
  );
}

/** Reads design tokens from CSS so SVG charts follow the light/dark theme. */
export function useTokens() {
  const read = () => {
    const s = getComputedStyle(document.documentElement);
    const g = (n: string) => `rgb(${s.getPropertyValue(n).trim()})`;
    return {
      ink: g("--ink"),
      ink2: g("--ink-2"),
      ink3: g("--ink-3"),
      line: g("--line"),
      panel: g("--panel"),
      sunk: g("--sunk"),
      pos: g("--pos"),
      neg: g("--neg"),
      warn: g("--warn"),
      series: [g("--s1"), g("--s2"), g("--s3"), g("--s4"), g("--s5"), g("--s6")],
    };
  };
  const [t, setT] = useState(read);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setT(read());
    mq.addEventListener("change", update);
    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
    return () => {
      mq.removeEventListener("change", update);
      mo.disconnect();
    };
  }, []);
  return t;
}

export type Tokens = ReturnType<typeof useTokens>;

export function ChartTooltip({ active, payload, label, render }: {
  active?: boolean;
  payload?: { payload: unknown }[];
  label?: unknown;
  render: (payload: { payload: unknown }[], label: unknown) => React.ReactNode;
}) {
  if (!active || !payload?.length) return null;
  return <div className="rounded-lg border border-line bg-panel px-3 py-2 text-[12px] text-ink shadow-lg">{render(payload, label)}</div>;
}
