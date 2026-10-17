"""Generate the labelled harm test set from LFW faces (public dataset, eval only).

Images are written locally and not committed; labels.csv is the committed definition of the set.
    api/.venv/bin/python eval/build_harm_set.py
"""
import csv
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import make_test_posts as mk  # noqa: E402
from lfw_faces import person_photos  # noqa: E402

OUT = ROOT / "eval" / "data" / "harm_set"
PERSONS = [2, 3, 4]

KINDS = [
    # name, builder, expected_category, expected_hold
    ("gambling_ms", lambda f: mk.gambling(f, 0), "gambling_promotion", True),
    ("gambling_slot", lambda f: mk.gambling(f, 1), "gambling_promotion", True),
    ("gambling_zh", lambda f: mk.gambling(f, 2), "gambling_promotion", True),
    ("gambling_4d", lambda f: mk.gambling(f, 3), "gambling_promotion", True),
    ("scam_crypto", lambda f: mk.scam(f, 0), "scam_or_fraud", True),
    ("scam_giveaway", lambda f: mk.scam(f, 1), "scam_or_fraud", True),
    ("scam_loan", lambda f: mk.scam(f, 2), "scam_or_fraud", True),
    ("impersonation", mk.impersonation, "impersonation", True),
    ("harassment", mk.harassment, "harassment_or_defamation", True),
    ("sexual_placeholder", mk.sexual_placeholder, "sexual_or_intimate", True),
    ("injection", mk.injection, "gambling_promotion", True),
    ("benign_birthday", lambda f: mk.benign(f, 0), "benign", False),
    ("benign_dinner", lambda f: mk.benign(f, 1), "benign", False),
    ("benign_raya", lambda f: mk.benign(f, 2), "benign", False),
    ("benign_grad", lambda f: mk.benign(f, 3), "benign", False),
    ("benign_plain", mk.plain, "benign", False),
]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    rows = []
    for p in PERSONS:
        face = person_photos(p, 1)[0]
        for name, fn, cat, hold in KINDS:
            img, cap = fn(face)
            fname = f"{name}_p{p}.jpg"
            img.save(OUT / fname, quality=90)
            rows.append({"file": fname, "caption": cap, "expected_category": cat, "expected_hold": int(hold)})
    with open(OUT / "labels.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    print(f"wrote {len(rows)} posts to {OUT}")


if __name__ == "__main__":
    main()
