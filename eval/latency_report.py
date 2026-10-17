"""Decision latency (p50 / p95) and Gemini usage from real scans recorded in Firestore.

    api/.venv/bin/python eval/latency_report.py [--last 300] [--usd-in 0.75 --usd-out 3.75]

Every scanned post counts, including automated test posts (they run the same pipeline on the deployed
service). Cost per 1,000 scans = Gemini calls per scan x tokens per call x price, when a price is given.
"""
import argparse
import json
import statistics
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "api"))
OUT = ROOT / "eval" / "results" / "latency.json"


def pct(v, p):
    v = sorted(v)
    return v[min(len(v) - 1, int(round(p * (len(v) - 1))))] if v else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--last", type=int, default=300)
    # Gemini 3.6 Flash on Vertex AI, introductory price through 31 Dec 2026 (USD per 1M tokens)
    ap.add_argument("--usd-in", type=float, default=0.75)
    ap.add_argument("--usd-out", type=float, default=3.75)
    a = ap.parse_args()
    from google.cloud import firestore

    from app.db import get_db

    docs = (get_db().collection("posts").order_by("created_at", direction=firestore.Query.DESCENDING)
            .limit(a.last).stream())
    scans = [d.to_dict().get("scan") or {} for d in docs]
    scans = [s for s in scans if s.get("latency_ms") is not None]
    all_ms = [s["latency_ms"] for s in scans]
    no_ai = [s["latency_ms"] for s in scans if not s.get("gemini_called")]
    with_ai = [s["latency_ms"] for s in scans if s.get("gemini_called")]
    gem = [s["gemini_latency_ms"] for s in scans if s.get("gemini_latency_ms")]
    det = [s["detect_ms"] for s in scans if s.get("detect_ms") is not None]
    tokens = [s["gemini_tokens"] for s in scans if isinstance(s.get("gemini_tokens"), dict)]
    calls_per_scan = len(gem) / len(scans) if scans else 0
    res = {
        "scans": len(scans), "gemini_calls": len(gem), "gemini_errors": sum(1 for s in scans if s.get("gemini_error")),
        "decision_ms_all": {"p50": pct(all_ms, .5), "p95": pct(all_ms, .95)},
        "decision_ms_no_gemini": {"p50": pct(no_ai, .5), "p95": pct(no_ai, .95), "n": len(no_ai)},
        "decision_ms_with_gemini": {"p50": pct(with_ai, .5), "p95": pct(with_ai, .95), "n": len(with_ai)},
        "gemini_ms": {"p50": pct(gem, .5), "p95": pct(gem, .95)},
        "face_detect_embed_ms": {"p50": pct(det, .5), "p95": pct(det, .95)},
        "tokens_per_gemini_call": {"in": round(statistics.mean(t["in"] for t in tokens)),
                                   "out": round(statistics.mean(t["out"] for t in tokens)), "n": len(tokens)} if tokens else None,
        "gemini_calls_per_scan_in_this_sample": round(calls_per_scan, 3),
    }
    if tokens:
        per_call = statistics.mean(t["in"] * a.usd_in + t["out"] * a.usd_out for t in tokens) / 1e6
        res["price_usd_per_1m_tokens"] = {"in": a.usd_in, "out": a.usd_out}
        res["usd_per_gemini_call"] = round(per_call, 6)
        res["usd_per_1000_scans_at_1pct_match_rate"] = round(per_call * 1000 * 0.01, 4)
        res["usd_per_1000_scans_worst_case_all_matched"] = round(per_call * 1000, 3)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(res, indent=2))
    print(json.dumps(res, indent=2))


if __name__ == "__main__":
    main()
