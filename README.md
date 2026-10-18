# US Baby Names

**146 years of American baby names (1880–2025), as an interactive dashboard and a free REST API.**

- **Dashboard:** https://names.moisesvasquez.io
- **API docs:** [docs/API.md](docs/API.md) · [OpenAPI spec](https://names.moisesvasquez.io/openapi.json)
- **Data:** US Social Security Administration, every name given to at least 5 babies of one sex in a year: 105,966 names, about 375 million babies.

```bash
curl "https://names.moisesvasquez.io/api/names/Olivia?sex=F"
```

---

## The dashboard

Built mobile-first. Every main chart has a draggable slider under the x-axis for zooming into a range of years or ages.

| Tab | What it does |
|---|---|
| **Look up a name** | Search any name and filter by female, male or both. You get total babies, peak year, best-ever rank (among all names that year), latest count and rank, a 5-year trend, and the **estimated average age** of people with the name today. Below that: a chart you can switch between babies, per-million births and rank, plus an age profile of living people with the name. |
| **Compare names** | Up to four names on one chart, with peak years marked, a side-by-side table (or cards on phones), trend badges and average ages. Includes ready-made sets like *Girls through the eras* and *The -ayden wave*, and a Clear all button. |
| **Last 5 years** | Rank changes in the top 10 for girls and boys, the fastest risers and fallers, names that appeared out of nowhere, gender-neutral names, and the shrinking share of babies with a top-100 name. |
| **Stories in the data** | Names shaped by history: *The Little Mermaid* and Ariel, Shirley Temple, Hurricane Katrina, Amazon's Alexa, Messi and Lionel, and more. Plus the biggest one-year surges, found automatically, and births over time. |
| **API** | Endpoint reference with live "Try it" buttons. |

## The API

Free, no key, CORS enabled, `GET` only.

| Endpoint | Returns |
|---|---|
| `GET /api/names/{name}?sex=F\|M\|all&from=&to=` | Yearly counts and ranks, peak year, best rank, trend, estimated age |
| `GET /api/top?year=2025&sex=F&limit=10` | Most popular names for a year and sex |
| `GET /api/search?q=ari&limit=10` | Prefix search, most popular first |
| `GET /api/compare?names=Linda,Olivia&sex=F` | Up to four names side by side |
| `GET /api/years/{year}?limit=5` | Births, distinct names and top names for one year |

Full reference with request/response examples, error codes and code samples: **[docs/API.md](docs/API.md)**.
How ranks, trends and estimated ages are calculated: **[docs/DATA.md](docs/DATA.md)**.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Dashboard | React 19 + TypeScript + Vite, Recharts | Fast and static: data is pre-built JSON split into 464 files by the first two letters of the name, so a lookup loads one small file |
| API | Vercel Functions (Node, Web `Request`/`Response`) | Lives next to the dashboard and scales to zero |
| Database | [Neon](https://neon.tech) serverless Postgres via `@neondatabase/serverless` | HTTP driver suited to serverless; 2.18M rows in ~200 MB |
| Data pipeline | Python (standard library + psycopg) | One script per target: JSON for the dashboard, `COPY` into Postgres for the API |

```
.
├── api/                  Vercel Functions (one file per endpoint)
│   └── _lib/             shared: db client, validation, stats
├── data/
│   ├── raw/              SSA yob1880.txt … yob2025.txt
│   └── stories.json      curated stories for the Stories tab
├── db/schema.sql         Postgres schema
├── docs/                 API.md, DATA.md
├── scripts/
│   ├── build_data.py     raw → web/public/data/*.json
│   └── load_db.py        raw → Neon
├── web/                  the dashboard (Vite + React)
│   └── public/
│       ├── data/         generated JSON
│       └── openapi.json
└── vercel.json
```

## Run it yourself

Requirements: Node 20+, Python 3.10+, and a free [Neon](https://neon.tech) database (only needed for the API).

```bash
git clone https://github.com/moisesvasquez/us-baby-names.git
cd us-baby-names
npm install && npm install --prefix web

# Dashboard data (already committed; rerun if you change the raw files)
python scripts/build_data.py

# API database
cp .env.example .env            # paste your Neon connection string
pip install "psycopg[binary]"
python scripts/load_db.py       # ~1 minute

# Dashboard + API on http://localhost:5173
npm run dev
```

`npm run dev` serves the API locally too, through a small Vite middleware that runs the files in `api/`.

### Deploy to Vercel

1. Import the repo at [vercel.com/new](https://vercel.com/new). `vercel.json` already sets the build.
2. Add the environment variable `DATABASE_URL` (your Neon connection string).
3. Deploy.

### Updating for a new year

When SSA publishes a new year, drop `yobYYYY.txt` into `data/raw/`, bump `LAST_YEAR` in `api/_lib/http.ts`, and rerun both scripts.

## Contributing

Issues and pull requests are welcome, especially new stories for the Stories tab (with the numbers to back them up). See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Code: [MIT](LICENSE). Data: US Social Security Administration, a US government work in the public domain.
