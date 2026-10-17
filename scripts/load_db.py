"""Load the SSA baby name files into Neon Postgres.

Usage:
    pip install "psycopg[binary]"
    DATABASE_URL=postgres://... python scripts/load_db.py      (or put DATABASE_URL in .env)

Recreates the tables in db/schema.sql and bulk-loads data/raw/yob*.txt with COPY.
"""
import glob
import os
import re
from collections import defaultdict

import psycopg

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def database_url():
    url = os.environ.get("DATABASE_URL")
    env = os.path.join(ROOT, ".env")
    if not url and os.path.exists(env):
        for line in open(env, encoding="utf-8"):
            if line.startswith("DATABASE_URL="):
                url = line.split("=", 1)[1].strip().strip('"')
    if not url:
        raise SystemExit("Set DATABASE_URL (environment or .env)")
    return url


def read_rows():
    """Yield (name, sex, year, count, rank) with competition ranking per year+sex."""
    for path in sorted(glob.glob(os.path.join(ROOT, "data", "raw", "yob*.txt"))):
        year = int(re.search(r"yob(\d{4})", path).group(1))
        by_sex = defaultdict(list)
        with open(path, encoding="utf-8") as f:
            for line in f:
                name, sex, n = line.strip().split(",")
                by_sex[sex].append((name, int(n)))
        for sex, rows in by_sex.items():
            rows.sort(key=lambda r: (-r[1], r[0]))
            prev_n, prev_rank = None, 0
            for i, (name, n) in enumerate(rows, start=1):
                rank = prev_rank if n == prev_n else i
                prev_n, prev_rank = n, rank
                yield name, sex, year, n, rank


def main():
    rows = list(read_rows())
    print(f"{len(rows):,} rows read")

    ids, totals, span = {}, defaultdict(lambda: [0, 0]), {}
    year_tot = defaultdict(lambda: [0, 0])
    for name, sex, year, n, _ in rows:
        if name not in ids:
            ids[name] = len(ids) + 1
        totals[name][0 if sex == "F" else 1] += n
        lo, hi = span.get(name, (year, year))
        span[name] = (min(lo, year), max(hi, year))
        year_tot[(year, sex)][0] += n
        year_tot[(year, sex)][1] += 1

    with psycopg.connect(database_url()) as conn:
        with conn.cursor() as cur:
            cur.execute(open(os.path.join(ROOT, "db", "schema.sql"), encoding="utf-8").read())
            with cur.copy("COPY names (id, name, name_lc, total_f, total_m, first_year, last_year) FROM STDIN") as cp:
                for name, i in ids.items():
                    f, m = totals[name]
                    cp.write_row((i, name, name.lower(), f, m, *span[name]))
            print(f"{len(ids):,} names loaded")
            with cur.copy("COPY name_years (name_id, sex, year, count, rank) FROM STDIN") as cp:
                for name, sex, year, n, rank in rows:
                    cp.write_row((ids[name], sex, year, n, rank))
            print("name_years loaded")
            with cur.copy("COPY year_totals (year, sex, births, unique_names) FROM STDIN") as cp:
                for (year, sex), (births, uniq) in sorted(year_tot.items()):
                    cp.write_row((year, sex, births, uniq))
            cur.execute("ANALYZE")
        conn.commit()
    print("Done")


if __name__ == "__main__":
    main()
