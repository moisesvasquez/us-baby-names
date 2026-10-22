-- Precomputed totals for the unique-names finder (GET /api/unique).
-- Run after name_years is loaded (scripts/load_db.py does this automatically).
-- One row per (window, name) for every name used at least once in the window.
-- "recent" = the newer half of the window, used to tell rising names from fading ones.

DROP TABLE IF EXISTS name_windows;

CREATE TABLE name_windows (
  window_years smallint NOT NULL,           -- 1, 3, 5, 10, 20, 50 or 146 (all years)
  name_id      integer  NOT NULL REFERENCES names(id),
  total_f      integer  NOT NULL,
  total_m      integer  NOT NULL,
  recent_f     integer  NOT NULL,
  recent_m     integer  NOT NULL,
  years_f      smallint NOT NULL,           -- years in the window with 5+ girls
  years_m      smallint NOT NULL,
  PRIMARY KEY (window_years, name_id)
);

WITH last AS (SELECT max(year) AS y FROM name_years),
w(n) AS (VALUES (1), (3), (5), (10), (20), (50), (146))
INSERT INTO name_windows
SELECT w.n, ny.name_id,
  coalesce(sum(ny.count) FILTER (WHERE ny.sex = 'F'), 0),
  coalesce(sum(ny.count) FILTER (WHERE ny.sex = 'M'), 0),
  coalesce(sum(ny.count) FILTER (WHERE ny.sex = 'F' AND ny.year > last.y - w.n / 2), 0),
  coalesce(sum(ny.count) FILTER (WHERE ny.sex = 'M' AND ny.year > last.y - w.n / 2), 0),
  count(*) FILTER (WHERE ny.sex = 'F'),
  count(*) FILTER (WHERE ny.sex = 'M')
FROM name_years ny CROSS JOIN w CROSS JOIN last
WHERE ny.year > last.y - w.n
GROUP BY w.n, ny.name_id;

-- All-time single-year peak per sex, for "was once popular" (old-fashioned) filtering.
ALTER TABLE names ADD COLUMN IF NOT EXISTS peak_f integer NOT NULL DEFAULT 0;
ALTER TABLE names ADD COLUMN IF NOT EXISTS peak_m integer NOT NULL DEFAULT 0;
UPDATE names n SET
  peak_f = coalesce(p.pf, 0),
  peak_m = coalesce(p.pm, 0)
FROM (
  SELECT name_id,
    max(count) FILTER (WHERE sex = 'F') AS pf,
    max(count) FILTER (WHERE sex = 'M') AS pm
  FROM name_years GROUP BY name_id
) p
WHERE p.name_id = n.id;

ANALYZE name_windows;
ANALYZE names;
