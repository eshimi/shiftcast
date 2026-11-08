import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const file = process.env.DB_PATH || 'data/app.db';
if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });

export const db = new DatabaseSync(file);
db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  fcm_token TEXT,
  notify INTEGER NOT NULL DEFAULT 1,
  last_notified TEXT,
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);
-- pos=0 が主エリア（統計・通知の既定）。住所/GPSではなく都道府県コードのみ保持。
CREATE TABLE IF NOT EXISTS user_areas (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  area_code TEXT NOT NULL,
  pos INTEGER NOT NULL,
  PRIMARY KEY (user_id, area_code)
);
-- 気象データ（source: owm=OpenWeatherMap, jma=気象庁アメダス実況, demo=デモ）
CREATE TABLE IF NOT EXISTS points (
  area_code TEXT NOT NULL,
  ts INTEGER NOT NULL,
  temp REAL,
  pressure REAL,
  icon TEXT,
  descr TEXT,
  source TEXT NOT NULL,
  PRIMARY KEY (area_code, ts, source)
);
CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ts INTEGER NOT NULL,
  pain INTEGER NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  meds TEXT NOT NULL DEFAULT '[]',
  note TEXT NOT NULL DEFAULT '',
  area_code TEXT
);
CREATE INDEX IF NOT EXISTS logs_user_ts ON logs(user_id, ts);
CREATE INDEX IF NOT EXISTS logs_area_ts ON logs(area_code, ts);
CREATE TABLE IF NOT EXISTS user_tags (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  PRIMARY KEY (user_id, tag)
);
CREATE TABLE IF NOT EXISTS my_meds (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  PRIMARY KEY (user_id, name)
);
CREATE TABLE IF NOT EXISTS drugs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  name_norm TEXT NOT NULL,
  maker TEXT,
  ingredient TEXT,
  UNIQUE (name, maker)
);
CREATE INDEX IF NOT EXISTS drugs_norm ON drugs(name_norm);
CREATE TABLE IF NOT EXISTS area_stats (
  area_code TEXT PRIMARY KEY,
  active INTEGER NOT NULL,
  pained INTEGER NOT NULL,
  window_h INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);
`);

export function tx(fn) {
  db.exec('BEGIN');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

export const getMeta = (k) => db.prepare('SELECT v FROM meta WHERE k=?').get(k)?.v ?? null;
export const setMeta = (k, v) =>
  db.prepare('INSERT INTO meta(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v').run(k, String(v));
