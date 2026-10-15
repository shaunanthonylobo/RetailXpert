"""
RetailXpert data pipeline.

Merges the verified facts in data/retailers_data.py and data/retailers_extra.py,
normalizes every money value to millions of CAD, adds quarter lengths in weeks
(Canadian grocers report 12- and 16-week quarters), and writes the typed JSON
the React app imports: src/data/retailers.json.

    python scripts/build_data.py
"""
from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "data"))

from retailers_data import AS_OF, COMPANIES, FX  # noqa: E402
from retailers_extra import ENGINES, EXTRA  # noqa: E402

USD = FX["USDCAD"]


def cad(v, ccy):
    if v is None:
        return None
    return round(v * USD, 2) if ccy == "USD" else round(v, 2)


def weeks_between(a: str, b: str) -> int:
    return round((date.fromisoformat(b) - date.fromisoformat(a)).days / 7)


def build_quarters(c, x):
    rows = [(d, r, n, None) for d, r, n in x["quarters"]]
    if "extra_quarter" in x:
        d, r, n, src = x["extra_quarter"]
        if d not in {q[0] for q in rows}:
            rows.append((d, r, n, src))
    rows.sort(key=lambda q: q[0])
    out = []
    for i, (d, r, n, src) in enumerate(rows):
        w = weeks_between(rows[i - 1][0], d) if i else None
        out.append({"end": d, "revenue": cad(r, c["ccy"]), "netIncome": cad(n, c["ccy"]),
                    "weeks": w, "source": src})
    # first quarter has no predecessor: borrow the length of the same quarter a year later
    if len(out) > 4 and out[0]["weeks"] is None:
        out[0]["weeks"] = out[4]["weeks"]
    return out


def company(c):
    x = EXTRA[c["id"]]
    st, q, fc = c["stats"], c["quote"], x.get("forecast")
    return {
        "id": c["id"], "name": c["name"], "short": c["short"], "ticker": c["ticker"], "sector": c["sector"],
        "hq": c["hq"], "lat": c["lat"], "lon": c["lon"], "founded": c["founded"], "banners": c["banners"],
        "fyEnd": c["fy_end"], "reportsIn": c["ccy"], "sourceUrl": c["sa"], "notes": c["notes"],
        "ttm": {"end": c["ttm"]["end"], "revenue": cad(c["ttm"]["revenue"], c["ccy"]),
                "netIncome": cad(c["ttm"]["net_income"], c["ccy"]), "growthPct": c["ttm"]["growth"]},
        "annual": [{"end": d, "revenue": cad(v, c["ccy"])} for d, v in c["history"]],
        "quarters": build_quarters(c, x),
        "stats": {"grossMargin": st["gross_margin"], "opMargin": st["op_margin"], "roic": st["roic"],
                  "ebitda": cad(st["ebitda"], st["ccy"]), "debt": cad(st["debt"], st["ccy"]), "cash": cad(st["cash"], st["ccy"]),
                  "employees": st["employees"], "invTurnover": st["inv_turnover"], "beta": st["beta"], "divYield": st["div_yield"]},
        "quote": {"price": q["price"], "ccy": q["ccy"], "date": q["date"], "mcap": cad(q["mcap"], q["ccy"]),
                  "lo52": q["lo52"], "hi52": q["hi52"]},
        "stores": {"n": c["stores"]["n"], "label": c["stores"]["label"], "basis": c["stores"]["basis"],
                   "date": c["stores"]["date"], "src": c["stores"]["src"], "conf": c["stores"]["conf"]},
        "cashflow": {**{k: cad(v, c["ccy"]) for k, v in x["cashflow"].items() if k in ("capex", "ocf", "fcf", "dividends", "buybacks")},
                     "end": x["cashflow"]["end"], "note": x["cashflow"]["div_note"]},
        "forecast": None if not fc else {
            "fy": fc["fy"], "thisRev": cad(fc["this_rev"], c["ccy"]), "thisG": fc["this_g"],
            "nextRev": cad(fc["next_rev"], c["ccy"]), "nextG": fc["next_g"], "analysts": fc["analysts"],
            "rating": fc["rating"], "pt": fc["pt"], "ptLo": fc["pt_lo"], "ptHi": fc["pt_hi"],
            "ptCcy": q["ccy"], "updated": fc["updated"]},
        "guidance": x.get("guidance"),
        "engines": {k: {"level": lvl, "evidence": ev} for k, (lvl, ev) in x["engines"].items()},
        "log": [{"date": d, "type": t, "action": a, "impact": i, "status": s} for d, t, a, i, s in x["log"]],
        "actions": x["actions"],
        "sources": x["sources"],
    }


def main():
    payload = {
        "meta": {"asOf": AS_OF, "fx": FX, "engines": [{"key": k, "label": l} for k, l in ENGINES]},
        "companies": [company(c) for c in COMPANIES],
    }
    out = ROOT / "src" / "data" / "retailers.json"
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    n_q = sum(len(c["quarters"]) for c in payload["companies"])
    print(f"Wrote {out.relative_to(ROOT)}: {len(payload['companies'])} companies, {n_q} quarters, "
          f"{sum(len(c['log']) for c in payload['companies'])} log entries")


if __name__ == "__main__":
    main()
