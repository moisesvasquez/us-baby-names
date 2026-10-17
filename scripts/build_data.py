"""Build compact JSON data files for the dashboard from the SSA yobYYYY.txt files.

Usage:  python scripts/build_data.py

Reads   data/raw/yob*.txt
Writes  web/public/data/
          meta.json            year range, total births per year per sex
          index.json           every name with lifetime totals (for search / autocomplete)
          names/<xx>.json      per-name yearly counts + ranks, sharded by first two letters
          recent.json          the last-5-years tab
"""
import glob
import json
import os
import re
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "raw")
OUT = os.path.join(ROOT, "web", "public", "data")


def load():
    """counts[sex][name][year] = n ; sex in F, M"""
    counts = {"F": defaultdict(dict), "M": defaultdict(dict)}
    years = []
    for path in sorted(glob.glob(os.path.join(RAW, "yob*.txt"))):
        year = int(re.search(r"yob(\d{4})", path).group(1))
        years.append(year)
        with open(path, encoding="utf-8") as f:
            for line in f:
                name, sex, n = line.strip().split(",")
                counts[sex][name][year] = int(n)
    return counts, years


def rank_by_year(series_by_name, years):
    """Competition ranking ("1224") of names within each year. Returns ranks[name][year]."""
    ranks = defaultdict(dict)
    for y in years:
        rows = [(c[y], name) for name, c in series_by_name.items() if y in c]
        rows.sort(key=lambda r: (-r[0], r[1]))
        prev_n, prev_rank = None, 0
        for i, (n, name) in enumerate(rows, start=1):
            rank = prev_rank if n == prev_n else i
            ranks[name][y] = rank
            prev_n, prev_rank = n, rank
    return ranks


def compact(counts, ranks, years):
    """[firstYear, [counts...], [ranks...]] with 0 for years the name is absent."""
    present = [y for y in years if y in counts]
    if not present:
        return None
    first, last = present[0], present[-1]
    span = range(first, last + 1)
    return [first, [counts.get(y, 0) for y in span], [ranks.get(y, 0) for y in span]]


def main():
    counts, years = load()
    y0, y1 = years[0], years[-1]
    print(f"Loaded {y0}-{y1}")

    both = defaultdict(dict)
    for sex in ("F", "M"):
        for name, c in counts[sex].items():
            for y, n in c.items():
                both[name][y] = both[name].get(y, 0) + n

    ranks = {"F": rank_by_year(counts["F"], years), "M": rank_by_year(counts["M"], years), "B": rank_by_year(both, years)}
    print("Ranked")

    totals = {s: {y: 0 for y in years} for s in ("F", "M")}
    for sex in ("F", "M"):
        for c in counts[sex].values():
            for y, n in c.items():
                totals[sex][y] += n

    os.makedirs(os.path.join(OUT, "names"), exist_ok=True)

    # Shards
    shards = defaultdict(dict)
    index = []
    for name in both:
        rec = {}
        for sex, src in (("F", counts["F"]), ("M", counts["M"]), ("B", both)):
            if name in src:
                rec[sex] = compact(src[name], ranks[sex][name], years)
        key = name[:2].lower()
        shards[key][name] = rec
        index.append([name, sum(counts["F"].get(name, {}).values()), sum(counts["M"].get(name, {}).values())])
    for key, data in shards.items():
        with open(os.path.join(OUT, "names", f"{key}.json"), "w", encoding="utf-8") as f:
            json.dump(data, f, separators=(",", ":"))
    index.sort(key=lambda r: -(r[1] + r[2]))
    with open(os.path.join(OUT, "index.json"), "w", encoding="utf-8") as f:
        json.dump(index, f, separators=(",", ":"))
    print(f"{len(index)} names in {len(shards)} shards")

    unique = {s: {y: sum(1 for c in counts[s].values() if y in c) for y in years} for s in ("F", "M")}
    meta = {
        "firstYear": y0,
        "lastYear": y1,
        "births": {s: [totals[s][y] for y in years] for s in ("F", "M")},
        "uniqueNames": {s: [unique[s][y] for y in years] for s in ("F", "M")},
        "nameCount": len(index),
    }
    with open(os.path.join(OUT, "meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, separators=(",", ":"))

    build_recent(counts, ranks, totals, unique, years)
    build_stories(counts, ranks, years)


def build_stories(counts, ranks, years):
    """Curated stories (data/stories.json) with their series attached, plus the biggest
    one-year surges found automatically: a year at least 6x the average of the prior three."""
    with open(os.path.join(ROOT, "data", "stories.json"), encoding="utf-8") as f:
        stories = json.load(f)
    for s in stories:
        c = counts[s["sex"]][s["name"]]
        s["series"] = [[y, c.get(y, 0)] for y in range(s["from"], s["to"] + 1)]

    surges = []
    truncated = {"Christop"}  # SSA record artifact (cut-off "Christopher"), not a real surge
    for sex in ("F", "M"):
        for name, c in counts[sex].items():
            if name in truncated:
                continue
            for y in years[3:]:
                n = c.get(y, 0)
                prev = sum(c.get(y - k, 0) for k in (1, 2, 3)) / 3
                if n >= 400 and n >= 6 * max(prev, 20):
                    later = c.get(y + 10, 0) if y + 10 <= years[-1] else None
                    surges.append({"name": name, "sex": sex, "year": y, "before": round(prev), "count": n,
                                   "factor": round(n / max(prev, 20), 1), "tenYearsLater": later})
                    break
    surges.sort(key=lambda r: -r["factor"])
    with open(os.path.join(OUT, "stories.json"), "w", encoding="utf-8") as f:
        json.dump({"stories": stories, "surges": surges[:40]}, f, separators=(",", ":"))
    print(f"stories.json written ({len(stories)} stories)")


def build_recent(counts, ranks, totals, unique, years):
    y1 = years[-1]
    window = [y for y in years if y > y1 - 5]  # last five years
    base = y1 - 5  # comparison year just before the window
    out = {"years": window, "baseYear": base}

    for sex in ("F", "M"):
        top_last = sorted(counts[sex], key=lambda n: ranks[sex][n].get(y1, 10**9))[:10]
        # top 10 across the window: union of each year's top 10, tracked as a rank series
        union = []
        for y in window:
            for n in sorted(counts[sex], key=lambda n: ranks[sex][n].get(y, 10**9))[:10]:
                if n not in union:
                    union.append(n)
        out[f"top{sex}"] = [
            {"name": n, "ranks": [ranks[sex][n].get(y) for y in window], "counts": [counts[sex][n].get(y, 0) for y in window]}
            for n in union
        ]
        out[f"top10_{sex}"] = top_last

        # movers: rank change base -> last, among names in the top 1000 last year
        movers = []
        for n, c in counts[sex].items():
            r1 = ranks[sex][n].get(y1)
            if not r1 or r1 > 1000 or c.get(y1, 0) < 250:
                continue
            r0 = ranks[sex][n].get(base)
            n0, nn = c.get(base, 0), c[y1]
            movers.append({"name": n, "r0": r0, "r1": r1, "n0": n0, "n1": nn, "pct": (nn - n0) / n0 * 100 if n0 else None})
        rising = sorted([m for m in movers if m["n0"] >= 50], key=lambda m: -m["pct"])[:12]
        falling = sorted([m for m in movers if m["n0"] >= 50], key=lambda m: m["pct"])[:12]
        newcomers = sorted([m for m in movers if m["n0"] < 50], key=lambda m: -m["n1"])[:10]
        # top-1000 names in base year that dropped hardest (may have fallen out of top 1000)
        fallers = []
        for n, c in counts[sex].items():
            r0 = ranks[sex][n].get(base)
            if not r0 or r0 > 500:
                continue
            n0, nn = c[base], c.get(y1, 0)
            fallers.append({"name": n, "r0": r0, "r1": ranks[sex][n].get(y1), "n0": n0, "n1": nn, "pct": (nn - n0) / n0 * 100})
        falling = sorted(fallers, key=lambda m: m["pct"])[:12]
        out[f"rising{sex}"] = rising
        out[f"falling{sex}"] = falling
        out[f"new{sex}"] = newcomers

        # concentration: share of babies with a top-10 / top-100 name, per year (last 30 years for context)
        conc = []
        for y in years[-30:]:
            ns = sorted((c[y] for c in counts[sex].values() if y in c), reverse=True)
            conc.append({"year": y, "top10": sum(ns[:10]) / totals[sex][y] * 100, "top100": sum(ns[:100]) / totals[sex][y] * 100})
        out[f"concentration{sex}"] = conc

    # gender-neutral: names with 30-70% split and >= 1000 babies in the last year
    neutral = []
    for n in set(counts["F"]) & set(counts["M"]):
        f, m = counts["F"][n].get(y1, 0), counts["M"][n].get(y1, 0)
        if f + m >= 1000 and 0.3 <= f / (f + m) <= 0.7:
            neutral.append({"name": n, "F": f, "M": m})
    out["neutral"] = sorted(neutral, key=lambda r: -(r["F"] + r["M"]))[:12]

    out["births"] = [{"year": y, "F": totals["F"][y], "M": totals["M"][y]} for y in years[-30:]]
    out["unique"] = [{"year": y, "F": unique["F"][y], "M": unique["M"][y]} for y in years[-30:]]

    with open(os.path.join(OUT, "recent.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"))
    print("recent.json written")


if __name__ == "__main__":
    main()
