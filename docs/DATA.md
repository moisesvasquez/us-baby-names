# Data and methodology

## Source

The [Social Security Administration](https://www.ssa.gov/oact/babynames/limits.html) publishes one file per birth year (`yob1880.txt` … `yob2025.txt`). Each line is `name,sex,count` for every name given to **at least 5 babies of one sex** in the US that year. The files are in [`data/raw/`](../data/raw), together with SSA's own [read-me](../data/raw/NationalReadMe.pdf).

What that means in practice:

- **Rare names are missing.** A name given to 4 girls and 3 boys in a year doesn't appear for that year at all.
- **Early years are undercounted.** Social Security numbers weren't needed at birth until much later, so counts before about 1937 reflect people who applied for a card later in life.
- **Names are stored as SSA keeps them:** letters only, up to 15 characters, no spaces, hyphens or accents. `Mary-Kate` is `Marykate`, `José` is `Jose`.
- **Sex is as recorded on the application** (F/M).

Totals: 2,181,032 rows, 105,966 distinct names, about 375 million babies.

## Ranks

Within each year and sex, names are sorted by count and given a competition rank ("1224"): equal counts share the rank, and the next rank skips. The dashboard's "both sexes" view ranks the combined counts the same way. The API only exposes per-sex ranks.

## Trend

The API reports the change in **babies** from 2020 to 2025. The dashboard compares **share of births** over the same span, which corrects for smaller birth cohorts, so the two can differ by a few points. A move of more than ±10% counts as rising or falling.

## Estimated age

"How old is a typical Mary?" is answered by estimating how many people born in each year are still alive:

1. Take the babies given the name in each birth year.
2. Weight each year by the probability of surviving to the age they'd be in 2026, using a Gompertz–Makeham curve fitted to recent US period life tables, separately for females and males:

   `S(age) = exp(−(A·age + B/c · (e^(c·age) − 1)))`

   | | A | B | c |
   |---|---|---|---|
   | Female | 0.0004 | 0.000012 | 0.100 |
   | Male | 0.0008 | 0.000030 | 0.093 |

3. The mean of the resulting age distribution is the **average age**. The 50th percentile is the **median**, and the sum is the estimated number of living people with the name.

Limits: it uses today's mortality for everyone (older cohorts actually had higher mortality, so very old names skew slightly old), and it ignores immigration, emigration and name changes. Treat it as a good guess, not a census.

## Stories

The "Stories in the data" tab has two parts:

- **Curated stories** ([`data/stories.json`](../data/stories.json)): names with a well-known cultural trigger. Every number quoted in a story was checked against the data.
- **Biggest one-year surges**: found automatically. A name qualifies when one year's count is at least 6× the average of the previous three years, with at least 400 babies. `Christop` (a truncated record in SSA's 1989 file) is excluded.

## Unique names finder

`/api/unique` reads a precomputed table, `name_windows` ([`db/windows.sql`](../db/windows.sql)). For each window (last 1, 3, 5, 10, 20, 50 years, or all years) and each name used in it, the table holds the female and male totals, the totals in the newer half of the window, and how many years the name appeared. That keeps every filter combination fast (about 0.1–0.4 s) instead of scanning 2 million rows per request.

- **Unisex:** girls make up 30–70% of the name's babies within the window.
- **Trend:** babies per year in the newer half of the window vs the older half. More than +25% is rising, below −20% is falling. The dashboard hides the trend badge for names under 25 babies, where it's mostly noise.
- **Forgotten classics:** the name's best single year ever had 1,000+ babies of that sex.

## Rebuilding

```bash
python scripts/build_data.py   # data/raw -> web/public/data/*.json (dashboard)
python scripts/load_db.py      # data/raw -> Neon Postgres (API), needs DATABASE_URL
```

Database schema: [`db/schema.sql`](../db/schema.sql).
