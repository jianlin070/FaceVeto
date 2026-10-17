import pytest

from app.auth import User
from app.media.router import can_view

ADMIN = User("admin", "", True)
OWNER = User("alice", "", False)
POSTER = User("bob", "", False)
OTHER = User("carol", "", False)


@pytest.mark.parametrize("user", [ADMIN, OWNER, POSTER, OTHER])
def test_published_visible_to_all_signed_in(user):
    assert can_view("published", user, set())


@pytest.mark.parametrize("status", ["held", "processing"])
def test_held_visible_to_admin_and_open_case_owner_only(status):
    owners = {"alice"}
    assert can_view(status, ADMIN, owners)
    assert can_view(status, OWNER, owners)
    assert not can_view(status, POSTER, owners)  # the poster only sees "Under review"
    assert not can_view(status, OTHER, owners)


def test_removed_admin_only():
    assert can_view("removed", ADMIN, set())
    assert not can_view("removed", OWNER, {"alice"})
    assert not can_view("removed", POSTER, set())
