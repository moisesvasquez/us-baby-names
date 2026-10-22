-- US Baby Names API schema (Neon Postgres)
-- Source: SSA national baby names, yob1880.txt .. yob2025.txt

DROP TABLE IF EXISTS name_windows;
DROP TABLE IF EXISTS name_years;
DROP TABLE IF EXISTS names;
DROP TABLE IF EXISTS year_totals;

-- One row per distinct name, with lifetime totals for quick search/autocomplete.
CREATE TABLE names (
  id        integer PRIMARY KEY,
  name      text    NOT NULL UNIQUE,
  name_lc   text    NOT NULL,               -- lower-case for case-insensitive lookup
  total_f   integer NOT NULL DEFAULT 0,
  total_m   integer NOT NULL DEFAULT 0,
  total     integer GENERATED ALWAYS AS (total_f + total_m) STORED,
  first_year smallint NOT NULL,
  last_year  smallint NOT NULL
);
CREATE INDEX names_lc_prefix ON names (name_lc text_pattern_ops);
CREATE INDEX names_total ON names (total DESC);

-- Babies given a name in a year, by sex, with the rank among all names of that sex that year.
CREATE TABLE name_years (
  name_id integer  NOT NULL REFERENCES names(id),
  sex     char(1)  NOT NULL CHECK (sex IN ('F', 'M')),
  year    smallint NOT NULL,
  count   integer  NOT NULL,
  rank    integer  NOT NULL,
  PRIMARY KEY (name_id, sex, year)
);
CREATE INDEX name_years_year_rank ON name_years (year, sex, rank);

-- Totals per year and sex (sum of published counts, i.e. names with 5+ babies).
CREATE TABLE year_totals (
  year         smallint NOT NULL,
  sex          char(1)  NOT NULL CHECK (sex IN ('F', 'M')),
  births       integer  NOT NULL,
  unique_names integer  NOT NULL,
  PRIMARY KEY (year, sex)
);
