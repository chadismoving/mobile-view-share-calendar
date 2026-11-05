ALTER TABLE calendars ADD COLUMN banner_id TEXT;
CREATE TABLE calendar_banners (
  id TEXT PRIMARY KEY,
  calendar_id TEXT NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
  image BLOB NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX calendar_banners_calendar ON calendar_banners(calendar_id);
