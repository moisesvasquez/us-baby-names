# US Baby Names API

Free, read-only JSON API for US baby name data from the Social Security Administration, **1880–2025**.

- **Base URL:** `https://us-baby-names.vercel.app/api`
- **Auth:** none. No key, no sign-up.
- **CORS:** enabled for all origins, so you can call it straight from a browser.
- **Methods:** `GET` only.
- **Format:** JSON (UTF-8).
- **Machine-readable spec:** [`/openapi.json`](https://us-baby-names.vercel.app/openapi.json) (OpenAPI 3.1)

```bash
curl "https://us-baby-names.vercel.app/api/names/Olivia?sex=F"
```

## Contents

- [Conventions](#conventions)
- [GET /api/names/{name}](#get-apinamesname): one name over time
- [GET /api/top](#get-apitop): most popular names in a year
- [GET /api/search](#get-apisearch): prefix search / autocomplete
- [GET /api/compare](#get-apicompare): up to four names side by side
- [GET /api/years/{year}](#get-apiyearsyear): totals and top names for one year
- [Errors](#errors)
- [Caching and fair use](#caching-and-fair-use)
- [Examples in code](#examples-in-code)

## Conventions

| Thing | Meaning |
|---|---|
| `sex` | `F` (female), `M` (male) or `all` (both combined). Default is `all` where it's optional. |
| `count` | Number of babies given the name that year (SSA only publishes names with 5+ babies of one sex in a year). |
| `rank` | Position among all names of the **same sex** that year. `1` = most popular. Ties share a rank (1, 2, 2, 4). Combined (`all`) series have no rank. |
| Names | Matched case-insensitively. Letters A–Z only, 1–15 characters, which is how SSA stores them (no spaces, hyphens or accents). |
| `trend` | Change in babies between 2020 and 2025. `direction` is `rising` (> +10%), `falling` (< −10%), `steady`, `new` (absent in 2020), `gone` (absent in 2025) or `none`. |
| `estimatedAge` | Estimated **mean** and **median** age of people with the name who are alive in 2026, plus an `estimatedLiving` headcount. Births are weighted by an approximate US survival curve; migration is ignored. See [DATA.md](DATA.md#estimated-age). |

---

## GET /api/names/{name}

Yearly series and summary statistics for one name.

| Param | In | Required | Description |
|---|---|---|---|
| `name` | path | yes | The name, e.g. `Mary` |
| `sex` | query | no | `F`, `M` or `all` (default `all`) |
| `from` | query | no | First year of the returned series (default 1880) |
| `to` | query | no | Last year of the returned series (default 2025) |

`from`/`to` only trim `years`. The `female`/`male` summaries always use the full history.

**Request**

```bash
curl "https://us-baby-names.vercel.app/api/names/Mary?sex=F&from=2022"
```

**Response** (abridged)

```json
{
  "name": "Mary",
  "sex": "F",
  "totals": { "female": 4141481, "male": 15173, "all": 4156654 },
  "female": {
    "total": 4141481,
    "firstYear": 1880,
    "lastYear": 2025,
    "peak": { "year": 1921, "count": 73984 },
    "bestRank": { "rank": 1, "year": 1880 },
    "latest": { "year": 2025, "count": 2230, "rank": 125 },
    "trend": { "from": 2020, "to": 2025, "changePct": 0, "direction": "steady" },
    "estimatedAge": { "mean": 67.5, "median": 71, "estimatedLiving": 1840351 }
  },
  "male": { "...": "same shape, or null if never used for boys" },
  "estimatedAge": { "mean": 67.5, "median": 71, "estimatedLiving": 1840351 },
  "range": { "from": 2022, "to": 2025 },
  "years": [
    { "year": 2022, "count": 2119, "rank": 134 },
    { "year": 2023, "count": 2085, "rank": 132 },
    { "year": 2024, "count": 2219, "rank": 131 },
    { "year": 2025, "count": 2230, "rank": 125 }
  ]
}
```

With `sex=all` (the default), each `years` item is `{ "year", "count", "female", "male" }` instead, where `count` is the combined total.

`bestRank` is the lowest rank number the name ever reached. When it held that rank in several years, the earliest year is returned.

---

## GET /api/top

The most popular names for one sex in one year.

| Param | Required | Description |
|---|---|---|
| `sex` | **yes** | `F` or `M` |
| `year` | no | 1880–2025 (default 2025) |
| `limit` | no | 1–100 (default 10) |
| `offset` | no | Skip this many rows, for paging (default 0) |

```bash
curl "https://us-baby-names.vercel.app/api/top?year=1950&sex=M&limit=3"
```

```json
{
  "year": 1950,
  "sex": "M",
  "births": 1790262,
  "uniqueNames": 4196,
  "limit": 3,
  "offset": 0,
  "names": [
    { "rank": 1, "name": "James", "count": 86228, "sharePct": 4.82 },
    { "rank": 2, "name": "Robert", "count": 83553, "sharePct": 4.67 },
    { "rank": 3, "name": "John", "count": 79412, "sharePct": 4.44 }
  ]
}
```

`births` is the sum of all published counts for that sex and year. `sharePct` is the name's share of it.

---

## GET /api/search

Names that start with a prefix, most popular first.

| Param | Required | Description |
|---|---|---|
| `q` | **yes** | Prefix, 1–15 letters |
| `sex` | no | `F`, `M` or `all` (default). With `F` or `M`, results are limited to names used for that sex and sorted by that sex's total. |
| `limit` | no | 1–50 (default 10) |

```bash
curl "https://us-baby-names.vercel.app/api/search?q=bar&limit=3"
```

```json
{
  "query": "bar",
  "sex": "all",
  "results": [
    { "name": "Barbara", "totals": { "female": 1436695, "male": 4136, "all": 1440831 }, "firstYear": 1880, "lastYear": 2025 },
    { "name": "Barry", "totals": { "female": 766, "male": 181270, "all": 182036 }, "firstYear": 1883, "lastYear": 2025 },
    { "name": "Barrett", "totals": { "female": 992, "male": 33425, "all": 34417 }, "firstYear": 1886, "lastYear": 2025 }
  ]
}
```

---

## GET /api/compare

Up to four names in one call.

| Param | Required | Description |
|---|---|---|
| `names` | **yes** | Comma-separated, max 4, e.g. `Linda,Jennifer,Olivia` |
| `sex` | no | `F`, `M` or `all` (default) |

```bash
curl "https://us-baby-names.vercel.app/api/compare?names=Linda,Olivia&sex=F"
```

```json
{
  "sex": "F",
  "names": [
    {
      "name": "Linda",
      "found": true,
      "total": 1455143,
      "peak": { "year": 1947, "count": 99692 },
      "bestRank": { "rank": 1, "year": 1947 },
      "latest": { "year": 2025, "count": 294, "rank": 902 },
      "trend": { "from": 2020, "to": 2025, "changePct": -12, "direction": "falling" },
      "estimatedAge": { "mean": 70.5, "median": 73, "estimatedLiving": 1130496 },
      "years": [{ "year": 1880, "count": 27, "rank": 305 }, "..."]
    },
    { "name": "Olivia", "found": true, "...": "..." }
  ]
}
```

Names not in the data come back as `{ "name": "...", "found": false }` instead of failing the whole request. With `sex=all`, `bestRank`, `latest` and `trend` are `null` (ranks are per sex).

---

## GET /api/years/{year}

Totals and the top names for girls and boys in one year.

| Param | In | Required | Description |
|---|---|---|---|
| `year` | path | yes | 1880–2025 |
| `limit` | query | no | Top names per sex, 1–25 (default 5) |

```bash
curl "https://us-baby-names.vercel.app/api/years/1957?limit=2"
```

```json
{
  "year": 1957,
  "births": 4202087,
  "female": {
    "births": 2044851,
    "uniqueNames": 7015,
    "top": [{ "rank": 1, "name": "Mary", "count": 61102 }, { "rank": 2, "name": "Susan", "count": 45954 }]
  },
  "male": {
    "births": 2157236,
    "uniqueNames": 4552,
    "top": [{ "rank": 1, "name": "Michael", "count": 92781 }, { "rank": 2, "name": "James", "count": 84337 }]
  }
}
```

---

## Errors

Errors use standard HTTP status codes and a JSON body:

```json
{
  "error": {
    "code": "name_not_found",
    "message": "No records for \"Zzzz\". SSA data only lists names given to at least 5 babies of one sex in a year.",
    "docs": "https://github.com/moisesvasquez/us-baby-names/blob/main/docs/API.md"
  }
}
```

| Status | `code` | When |
|---|---|---|
| 400 | `invalid_name`, `invalid_query` | Not 1–15 letters A–Z |
| 400 | `invalid_sex` | Not `F`, `M` (or `all` where allowed) |
| 400 | `invalid_year`, `invalid_from`, `invalid_to`, `invalid_range` | Year outside 1880–2025, or `from` > `to` |
| 400 | `invalid_limit`, `invalid_offset` | Out of range |
| 400 | `invalid_names`, `too_many_names` | Missing names, or more than 4 in `/compare` |
| 404 | `name_not_found` | Name (or name + sex) not in the data |
| 404 | `not_found` | Unknown endpoint |
| 405 | `method_not_allowed` | Anything other than `GET` / `OPTIONS` |
| 500 | `internal_error` | Something broke on our side |

## Caching and fair use

Responses are cached at the edge for a day (`Cache-Control: s-maxage=86400`), and the data only changes when SSA publishes a new year (usually each May). Please:

- cache responses on your side too,
- avoid crawling every name; if you need everything, download the [raw SSA files](https://www.ssa.gov/oact/babynames/limits.html) or run this project yourself (see the [README](../README.md#run-it-yourself)).

There is no hard rate limit today. That may change if the service gets abused.

## Examples in code

**JavaScript (browser or Node 18+)**

```js
const res = await fetch('https://us-baby-names.vercel.app/api/names/Ariel?sex=F&from=1985&to=1995')
const data = await res.json()
console.table(data.years) // the Little Mermaid spike in 1990–91
```

**Python**

```python
import requests

r = requests.get("https://us-baby-names.vercel.app/api/top", params={"year": 2025, "sex": "M", "limit": 5})
for row in r.json()["names"]:
    print(row["rank"], row["name"], row["count"])
```

**pandas**

```python
import pandas as pd, requests

data = requests.get("https://us-baby-names.vercel.app/api/compare",
                    params={"names": "Linda,Jennifer,Olivia", "sex": "F"}).json()
df = pd.concat(pd.DataFrame(n["years"]).assign(name=n["name"]) for n in data["names"] if n["found"])
df.pivot(index="year", columns="name", values="count").plot()
```
