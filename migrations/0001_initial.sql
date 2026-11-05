PRAGMA foreign_keys = ON;
CREATE TABLE calendars (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  edit_token_hash TEXT NOT NULL UNIQUE,
  share_token TEXT NOT NULL UNIQUE,
  revision INTEGER NOT NULL DEFAULT 1,
  mutation_id TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE calendar_days (
  id TEXT PRIMARY KEY,
  calendar_id TEXT NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  manual_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(calendar_id, date)
);
CREATE INDEX calendar_days_calendar_order ON calendar_days(calendar_id, sort_order);
CREATE TABLE time_slots (
  id TEXT PRIMARY KEY,
  day_id TEXT NOT NULL REFERENCES calendar_days(id) ON DELETE CASCADE,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT 'sage',
  sort_order INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (end_time > start_time),
  CHECK (color IN ('sage', 'lavender', 'peach', 'sky', 'rose', 'sand'))
);
CREATE INDEX time_slots_day_order ON time_slots(day_id, sort_order);
