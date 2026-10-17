# Contributing

Thanks for helping out. A few ways to contribute:

## Add a story

Stories live in [`data/stories.json`](data/stories.json). Each one needs:

```json
{
  "name": "Ariel", "sex": "F", "year": 1989, "from": 1982, "to": 2000,
  "category": "Film & TV",
  "title": "Short headline",
  "text": "One or two sentences. Every number must match the data."
}
```

- `year` is the event (drawn as a dashed line); `from`/`to` set the chart window.
- Categories in use: Film & TV, Music, Sports, Politics & history, Unwanted associations.
- Check your numbers with the API (`/api/names/Ariel?sex=F&from=1985&to=1995`) or the dashboard.
- Run `python scripts/build_data.py` to regenerate `web/public/data/stories.json`.

## Fix a bug or improve the dashboard

```bash
npm install && npm install --prefix web
npm run dev          # http://localhost:5173
npm run typecheck    # API + dashboard type-check and build
```

Keep it mobile-first: check new UI at 375px wide.

## API changes

Keep endpoints simple and backwards compatible. If you add or change a field, update
[`docs/API.md`](docs/API.md) and [`web/public/openapi.json`](web/public/openapi.json) in the same pull request.
