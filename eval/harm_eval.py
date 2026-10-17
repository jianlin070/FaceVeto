"""Precision / recall of the hold decision on the labelled harm set (Gemini + deterministic policy).

    api/.venv/bin/python eval/harm_eval.py [--model gemini-3.5-flash] [--limit 16] [--json out.json]
"""
import argparse
import csv
import json
import os
import statistics
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "api"))

SET = ROOT / "eval" / "data" / "harm_set"
CONTEXT = {"poster_account_age_days": 3, "faces_in_image": 1, "matched_face_is_not_poster": True,
           "platform": "general social network, JAPAC"}


def run(model: str | None, thinking: str | None, limit: int | None, workers: int) -> dict:
    if model:
        os.environ["GEMINI_MODEL"] = model
    if thinking is not None:
        os.environ["GEMINI_THINKING"] = thinking
    from app.agent import gemini
    from app.agent.policy import decide
    from app.config import get_settings
    from app.imaging import clean_image

    rows = list(csv.DictReader(open(SET / "labels.csv", encoding="utf-8")))[:limit]

    def one(r):
        img = clean_image((SET / r["file"]).read_bytes(), max_bytes=8_000_000)
        res = gemini.assess_harm(img.jpeg, r["caption"], CONTEXT)
        d = decide(res.assessment)
        return {**r, "pred_category": res.assessment.category.value if res.assessment else "error",
                "pred_hold": d.action == "hold", "latency_ms": res.latency_ms, "error": res.error}

    with ThreadPoolExecutor(workers) as ex:
        out = list(ex.map(one, rows))

    tp = sum(1 for o in out if o["pred_hold"] and o["expected_hold"] == "1")
    fp = sum(1 for o in out if o["pred_hold"] and o["expected_hold"] == "0")
    fn = sum(1 for o in out if not o["pred_hold"] and o["expected_hold"] == "1")
    neg = sum(1 for o in out if o["expected_hold"] == "0")
    cats: dict[str, list[bool]] = {}
    for o in out:
        cats.setdefault(o["expected_category"], []).append(o["pred_category"] == o["expected_category"])
    lat = sorted(o["latency_ms"] for o in out)
    return {
        "model": get_settings().gemini_model, "thinking": get_settings().gemini_thinking, "n": len(out),
        "hold_precision": tp / (tp + fp) if tp + fp else 0.0, "hold_recall": tp / (tp + fn) if tp + fn else 0.0,
        "false_hold_rate": fp / neg if neg else 0.0,
        "category_accuracy": sum(o["pred_category"] == o["expected_category"] for o in out) / len(out),
        "per_category": {k: sum(v) / len(v) for k, v in sorted(cats.items())},
        "latency_p50_ms": statistics.median(lat), "latency_p95_ms": lat[min(len(lat) - 1, int(0.95 * len(lat)))],
        "errors": sum(1 for o in out if o["error"]),
        "misses": [(o["file"], o["expected_category"], o["pred_category"]) for o in out
                   if o["pred_category"] != o["expected_category"] or o["pred_hold"] != (o["expected_hold"] == "1")],
    }


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--model")
    ap.add_argument("--thinking")
    ap.add_argument("--limit", type=int)
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--json")
    a = ap.parse_args()
    res = run(a.model, a.thinking, a.limit, a.workers)
    print(json.dumps(res, indent=2, ensure_ascii=False))
    if a.json:
        Path(a.json).write_text(json.dumps(res, indent=2, ensure_ascii=False))
