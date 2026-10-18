"""Trust & safety overview numbers.

Computed from plain post and case dicts (each carrying its document "id") so the logic is unit tested
without Firestore. The router reads the documents and resolves user ids to handles.
"""
import statistics
from collections import defaultdict
from datetime import datetime

SEVERITY_RANK = {"none": 0, "low": 1, "medium": 2, "high": 3}
# What became of a held post, from its current status.
OUTCOME = {"held": "waiting", "removed": "down", "published": "live", "deleted": "deleted"}


def pct(values: list[float], p: float):
    if not values:
        return None
    v = sorted(values)
    return v[min(len(v) - 1, int(round(p * (len(v) - 1))))]


def is_held(post: dict) -> bool:
    return (post.get("decision") or {}).get("action") == "hold"


def decided_by(outcome: str, cases: list[dict]) -> str | None:
    """Who made the final call on a post: the owner's answer or an admin action."""
    statuses = {c.get("status") for c in cases}
    if outcome == "down":
        return "owner" if "owner_not_me" in statuses else "admin" if "removed" in statuses else None
    if outcome == "live":
        return "admin" if "released" in statuses else "owner" if "owner_its_me" in statuses else None
    return None


def decision_minutes(cases: list[dict]) -> list[float]:
    """Minutes from each hold to the owner's answer or an admin action, for decided cases."""
    out = []
    for c in cases:
        at = (c.get("owner_response") or {}).get("at") or (c.get("admin_action") or {}).get("at")
        if at and c.get("created_at"):
            out.append(max(0.0, (at - c["created_at"]).total_seconds() / 60))
    return out


def _between(ts: datetime | None, start: datetime, end: datetime | None = None) -> bool:
    return ts is not None and ts >= start and (end is None or ts < end)


def overview(posts: list[dict], cases: list[dict], since: datetime, prev_since: datetime) -> dict:
    """Everything the overview page charts for [since, now], with [prev_since, since) for comparison.

    Posters and targets come back keyed by uid; the caller swaps in handles.
    """
    test_posts = {p["id"] for p in posts if p.get("is_test")}
    posts = [p for p in posts if not p.get("is_test")]
    cases = [c for c in cases if c.get("post_id") not in test_posts]
    current = [p for p in posts if _between(p.get("created_at"), since)]
    cases_now = [c for c in cases if _between(c.get("created_at"), since)]
    cases_prev = [c for c in cases if _between(c.get("created_at"), prev_since, since)]

    by_post: dict[str, list[dict]] = defaultdict(list)
    for c in cases:
        by_post[c["post_id"]].append(c)
    held = []
    for p in current:
        if not is_held(p):
            continue
        outcome = OUTCOME.get(p.get("status"), "waiting")
        held.append({
            "at": p["created_at"].isoformat(),
            "category": (p.get("assessment") or {}).get("category") or "unassessed",
            "outcome": outcome, "by": decided_by(outcome, by_post[p["id"]]),
        })
    held.sort(key=lambda h: h["at"])

    mins, prev_mins = decision_minutes(cases_now), decision_minutes(cases_prev)
    scans = [p["scan"] for p in current if p.get("has_image", True) and (p.get("scan") or {}).get("latency_ms") is not None]
    lat = [s["latency_ms"] for s in scans]
    return {
        "held": held,
        "prev_held": sum(1 for p in posts if is_held(p) and _between(p.get("created_at"), prev_since, since)),
        "decision_minutes": {
            "median": round(statistics.median(mins)) if mins else None,
            "p90": round(pct(mins, 0.9)) if mins else None,
            "prev_median": round(statistics.median(prev_mins)) if prev_mins else None,
        },
        "posters": repeat_posters(cases_now),
        "targets": targeted_members(cases_now),
        "system": {
            "posts_scanned": len(scans), "scan_p50_ms": pct(lat, 0.5), "scan_p95_ms": pct(lat, 0.95),
            "ai_checks": sum(1 for s in scans if s.get("gemini_called")),
            "ai_errors": sum(1 for s in scans if s.get("gemini_error")),
        },
    }


def repeat_posters(cases: list[dict], limit: int = 5) -> list[dict]:
    """Posters with more than one held post, most holds first. One post showing two members counts once."""
    groups: dict[str, dict[str, dict]] = defaultdict(dict)  # poster -> post_id -> newest case
    owners: dict[str, set] = defaultdict(set)
    for c in cases:
        posts = groups[c["poster_uid"]]
        owners[c["poster_uid"]].add(c["owner_uid"])
        if c["post_id"] not in posts or c["created_at"] > posts[c["post_id"]]["created_at"]:
            posts[c["post_id"]] = c
    out = []
    for uid, posts in groups.items():
        if len(posts) < 2:
            continue
        reasons: dict[str, int] = defaultdict(int)
        for c in posts.values():
            reasons[c.get("category") or "unassessed"] += 1
        latest = max(posts.values(), key=lambda c: c["created_at"])
        out.append({
            "uid": uid, "held": len(posts), "people": len(owners[uid]),
            "reasons": dict(sorted(reasons.items(), key=lambda kv: -kv[1])),
            "worst": max((c.get("severity") or "none" for c in posts.values()), key=lambda s: SEVERITY_RANK.get(s, 0)),
            "last_at": latest["created_at"].isoformat(), "case_id": latest["id"],
        })
    out.sort(key=lambda p: p["last_at"], reverse=True)  # ties: most recently active first
    out.sort(key=lambda p: (-p["held"], -SEVERITY_RANK.get(p["worst"], 0)))
    return out[:limit]


def targeted_members(cases: list[dict], limit: int = 5) -> list[dict]:
    """Protected members shown most often in held posts, with how many different posters were involved."""
    held: dict[str, set] = defaultdict(set)
    posters: dict[str, set] = defaultdict(set)
    for c in cases:
        held[c["owner_uid"]].add(c["post_id"])
        posters[c["owner_uid"]].add(c["poster_uid"])
    out = [{"uid": u, "held": len(held[u]), "posters": len(posters[u])} for u in held]
    out.sort(key=lambda t: (-t["held"], -t["posters"]))
    return out[:limit]
