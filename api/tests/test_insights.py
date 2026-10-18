from datetime import datetime, timedelta, timezone

from app.admin.insights import decided_by, overview, repeat_posters, targeted_members

NOW = datetime(2026, 10, 18, 12, tzinfo=timezone.utc)
SINCE = NOW - timedelta(days=7)
PREV = SINCE - timedelta(days=7)


def post(pid, days_ago, status="held", action="hold", category="sexual_or_intimate", **kw):
    return {"id": pid, "created_at": NOW - timedelta(days=days_ago), "status": status,
            "decision": {"action": action}, "assessment": {"category": category}, **kw}


def case(cid, pid, days_ago, poster="bob", owner="alice", status="awaiting_owner", severity="high", category="sexual_or_intimate", **kw):
    return {"id": cid, "post_id": pid, "poster_uid": poster, "owner_uid": owner, "status": status,
            "severity": severity, "category": category, "created_at": NOW - timedelta(days=days_ago), **kw}


def test_decided_by_follows_case_answers():
    assert decided_by("down", [{"status": "owner_not_me"}]) == "owner"
    assert decided_by("down", [{"status": "removed"}]) == "admin"
    assert decided_by("live", [{"status": "owner_its_me"}, {"status": "released"}]) == "admin"
    assert decided_by("live", [{"status": "owner_its_me"}]) == "owner"
    assert decided_by("waiting", [{"status": "awaiting_owner"}]) is None


def test_overview_counts_held_posts_in_range_and_previous_period():
    posts = [
        post("p1", 1, status="removed"), post("p2", 2, status="published", category="scam_or_fraud"),
        post("p3", 3, status="published", action="publish"),  # not held
        post("p4", 10),  # previous period
        post("p5", 1, is_test=True),  # test traffic never counts
    ]
    cases = [case("c1", "p1", 1, status="owner_not_me"), case("c2", "p2", 2, status="released"), case("c5", "p5", 1)]
    out = overview(posts, cases, SINCE, PREV)
    assert [(h["category"], h["outcome"], h["by"]) for h in out["held"]] == [
        ("scam_or_fraud", "live", "admin"), ("sexual_or_intimate", "down", "owner")]
    assert out["prev_held"] == 1


def test_decision_minutes_use_first_answer():
    held_at = NOW - timedelta(days=1)
    cases = [
        case("c1", "p1", 1, owner_response={"at": held_at + timedelta(minutes=30)}),
        case("c2", "p2", 1, admin_action={"at": held_at + timedelta(minutes=90)}),
        case("c3", "p3", 1),  # undecided
    ]
    out = overview([], cases, SINCE, PREV)
    assert out["decision_minutes"]["median"] == 60
    assert out["decision_minutes"]["prev_median"] is None


def test_repeat_posters_count_posts_not_cases_and_skip_one_offs():
    cases = [
        case("c1", "p1", 3, owner="alice"), case("c2", "p1", 3, owner="carol"),  # one post, two members shown
        case("c3", "p2", 1, owner="alice", severity="medium", category="harassment_or_defamation"),
        case("c4", "p9", 1, poster="dave"),  # dave only once
    ]
    [bob] = repeat_posters(cases)
    assert bob["uid"] == "bob" and bob["held"] == 2 and bob["people"] == 2
    assert bob["reasons"] == {"sexual_or_intimate": 1, "harassment_or_defamation": 1}
    assert bob["worst"] == "high" and bob["case_id"] == "c3"


def test_targeted_members_rank_by_posts_then_posters():
    cases = [case("c1", "p1", 1, poster="bob"), case("c2", "p2", 1, poster="dave"), case("c3", "p3", 1, owner="carol")]
    out = targeted_members(cases)
    assert out[0] == {"uid": "alice", "held": 2, "posters": 2}
    assert out[1]["uid"] == "carol"
