CREATE TABLE users (
  id TEXT PRIMARY KEY,
  fcm_token TEXT,
  notify INTEGER NOT NULL DEFAULT 1,
  last_notified TEXT,
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);
-- pos=0 が主エリア。GPS座標は保存せず都道府県コードのみ保持する。
CREATE TABLE user_areas (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  area_code TEXT NOT NULL,
  pos INTEGER NOT NULL,
  PRIMARY KEY (user_id, area_code)
);
-- source: owm=OpenWeatherMap, jma=気象庁アメダス実況, demo=デモ
CREATE TABLE points (
  area_code TEXT NOT NULL,
  ts INTEGER NOT NULL,
  temp REAL,
  pressure REAL,
  icon TEXT,
  descr TEXT,
  source TEXT NOT NULL,
  PRIMARY KEY (area_code, ts, source)
);
CREATE TABLE logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ts INTEGER NOT NULL,
  pain INTEGER NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  meds TEXT NOT NULL DEFAULT '[]',
  note TEXT NOT NULL DEFAULT '',
  area_code TEXT
);
CREATE INDEX logs_user_ts ON logs(user_id, ts);
CREATE INDEX logs_area_ts ON logs(area_code, ts);
CREATE TABLE user_tags (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  PRIMARY KEY (user_id, tag)
);
CREATE TABLE my_meds (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  PRIMARY KEY (user_id, name)
);
CREATE TABLE drugs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  name_norm TEXT NOT NULL,
  maker TEXT NOT NULL DEFAULT '',
  ingredient TEXT NOT NULL DEFAULT '',
  UNIQUE (name, maker)
);
CREATE INDEX drugs_norm ON drugs(name_norm);
CREATE TABLE area_stats (
  area_code TEXT PRIMARY KEY,
  active INTEGER NOT NULL,
  pained INTEGER NOT NULL,
  window_h INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE meta (k TEXT PRIMARY KEY, v TEXT);
