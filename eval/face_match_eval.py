"""Face matching accuracy on LFW (public dataset) with the production engine (InsightFace buffalo_l).

Reports TAR at FAR = 0.1% and 1% from all genuine and impostor pairs over LFW identities with
10 or more images (capped at 20 per person), plus accuracy on the standard 1,000 LFW test pairs
at the recommended threshold. Embeddings are cached in eval/.cache.

    api/.venv/bin/python eval/face_match_eval.py
"""
import json
import sys
import time
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "api"))
CACHE = ROOT / "eval" / ".cache"
OUT = ROOT / "eval" / "results" / "face_match.json"


def to_bgr(img: np.ndarray) -> np.ndarray:
    a = img if img.max() > 1.5 else img * 255
    return np.ascontiguousarray(a.astype(np.uint8)[:, :, ::-1])


def embed_all(images: np.ndarray, name: str) -> np.ndarray:
    """One embedding per image: the face nearest the centre (LFW is centred). NaN row if none found."""
    path = CACHE / f"emb_{name}.npy"
    if path.exists():
        return np.load(path)
    from app.face import engine

    engine.get_app()
    out = np.full((len(images), 512), np.nan, np.float32)
    t0 = time.time()
    for i, img in enumerate(images):
        faces = engine.detect_and_embed(to_bgr(img), min_score=0.3, min_side=20)
        if faces:
            h, w = img.shape[:2]
            f = min(faces, key=lambda f: ((f.bbox[0] + f.bbox[2]) / 2 - w / 2) ** 2 + ((f.bbox[1] + f.bbox[3]) / 2 - h / 2) ** 2)
            out[i] = f.embedding
        if i % 500 == 0:
            print(f"  {name}: {i}/{len(images)} ({time.time() - t0:.0f}s)", flush=True)
    np.save(path, out)
    return out


def main():
    from sklearn.datasets import fetch_lfw_pairs, fetch_lfw_people

    people = fetch_lfw_people(min_faces_per_person=10, color=True, resize=1.0, slice_=None, data_home=str(CACHE))
    keep = np.concatenate([np.where(people.target == t)[0][:20] for t in np.unique(people.target)])
    labels = people.target[keep]
    emb = embed_all(people.images[keep], "people10")
    ok = ~np.isnan(emb[:, 0])
    emb, labels = emb[ok], labels[ok]
    sims = emb @ emb.T
    iu = np.triu_indices(len(emb), k=1)
    s = sims[iu]
    same = (labels[:, None] == labels[None, :])[iu]
    gen, imp = s[same], s[~same]

    def tar_at(far):
        thr = float(np.quantile(imp, 1 - far))
        return float((gen >= thr).mean()), thr

    tar1, thr1 = tar_at(0.01)
    tar01, thr01 = tar_at(0.001)

    pairs = fetch_lfw_pairs(subset="test", color=True, resize=1.0, slice_=None, data_home=str(CACHE))
    pe = embed_all(pairs.pairs.reshape(-1, *pairs.pairs.shape[2:]), "pairs_test").reshape(len(pairs.pairs), 2, 512)
    pok = ~np.isnan(pe[:, 0, 0]) & ~np.isnan(pe[:, 1, 0])
    psim = np.einsum("ij,ij->i", pe[pok, 0], pe[pok, 1])
    ptarget = pairs.target[pok]

    def pair_metrics(thr):
        pred = psim >= thr
        return {"threshold": round(thr, 3), "accuracy": float((pred == ptarget).mean()),
                "tar": float(pred[ptarget == 1].mean()), "far": float(pred[ptarget == 0].mean())}

    res = {
        "model": "insightface buffalo_l (RetinaFace + ArcFace R50, 512-d), CPU",
        "people_set": {"identities": int(len(np.unique(labels))), "images": int(len(emb)),
                       "detect_rate": float(ok.mean()), "genuine_pairs": int(len(gen)), "impostor_pairs": int(len(imp))},
        "tar_at_far_1pct": {"tar": tar1, "threshold": thr1},
        "tar_at_far_0_1pct": {"tar": tar01, "threshold": thr01},
        "lfw_test_pairs": {"pairs_scored": int(pok.sum()), "at_0.45": pair_metrics(0.45),
                           "at_far_0_1pct_threshold": pair_metrics(thr01)},
        "recommended_match_threshold": round(max(0.45, thr01), 2),
    }
    OUT.write_text(json.dumps(res, indent=2))
    print(json.dumps(res, indent=2))


if __name__ == "__main__":
    main()
