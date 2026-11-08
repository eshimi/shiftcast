import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, tx } from './db.js';
import { AREAS, AREA_BY_CODE, isAreaCode, nearestArea } from './areas.js';
import { annotate, LEVEL_LABEL, HOUR } from './pressure.js';
import { DEMO, ensureFresh } from './weather.js';
import { getAreaStats } from './stats.js';
import { buildInsights } from './insights.js';
import { searchDrugs, seedDrugsIfEmpty } from './drugs.js';
import { startScheduler } from './scheduler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '50kb' }));

app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'geolocation=(self)',
  });
  next();
});

// 簡易レート制限（IPごと 120 req/分）
const hits = new Map();
setInterval(() => hits.clear(), 60e3).unref();
app.use('/api', (req, res, next) => {
  const n = (hits.get(req.ip) || 0) + 1;
  hits.set(req.ip, n);
  if (n > 120) return res.status(429).json({ error: 'too_many_requests' });
  next();
});

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const bad = (res, msg) => res.status(400).json({ error: msg });

// ---------- 認証（端末ごとの匿名ID。氏名・メール等は扱わない） ----------
app.post('/api/users', (req, res) => {
  const id = crypto.randomUUID();
  const now = Date.now();
  const area = isAreaCode(req.body?.area_code) ? req.body.area_code : '13';
  tx(() => {
    db.prepare('INSERT INTO users(id,created_at,last_seen) VALUES(?,?,?)').run(id, now, now);
    db.prepare('INSERT INTO user_areas(user_id,area_code,pos) VALUES(?,?,0)').run(id, area);
  });
  res.status(201).json({ id });
});

function auth(req, res, next) {
  const id = req.get('x-user-id');
  const u = id && db.prepare('SELECT * FROM users WHERE id=?').get(id);
  if (!u) return res.status(401).json({ error: 'unauthorized' });
  const now = Date.now();
  if (now - u.last_seen > 5 * 60e3) db.prepare('UPDATE users SET last_seen=? WHERE id=?').run(now, u.id);
  req.user = u;
  next();
}

const meOf = (u) => ({
  id: u.id,
  notify: !!u.notify,
  hasPush: !!u.fcm_token,
  areas: db.prepare('SELECT area_code code FROM user_areas WHERE user_id=? ORDER BY pos').all(u.id).map((r) => r.code),
  tags: db.prepare('SELECT tag FROM user_tags WHERE user_id=? ORDER BY rowid').all(u.id).map((r) => r.tag),
  myMeds: db.prepare('SELECT name FROM my_meds WHERE user_id=? ORDER BY rowid').all(u.id).map((r) => r.name),
});

// ---------- 公開エンドポイント ----------
app.get('/api/config', (req, res) => {
  let firebase = null;
  try {
    firebase = process.env.FIREBASE_WEB_CONFIG ? JSON.parse(process.env.FIREBASE_WEB_CONFIG) : null;
  } catch {}
  res.json({ demo: DEMO, firebase, vapidKey: process.env.FIREBASE_VAPID_KEY || null, levels: LEVEL_LABEL });
});
app.get('/api/areas', (req, res) => res.json(AREAS.map(({ code, name }) => ({ code, name }))));
app.get('/api/nearest', (req, res) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return bad(res, 'bad_coords');
  const a = nearestArea(lat, lon); // 座標は保存・ログ出力しない
  res.json({ code: a.code, name: a.name });
});

app.use('/api', auth);

// ---------- ユーザー設定 ----------
app.get('/api/me', (req, res) => res.json(meOf(req.user)));

app.put('/api/me', (req, res) => {
  const { areas, notify, fcm_token } = req.body || {};
  const u = req.user;
  tx(() => {
    if (areas !== undefined) {
      if (!Array.isArray(areas) || !areas.length || areas.length > 3 || !areas.every(isAreaCode)) throw Object.assign(new Error('bad_areas'), { status: 400 });
      const uniq = [...new Set(areas)];
      db.prepare('DELETE FROM user_areas WHERE user_id=?').run(u.id);
      uniq.forEach((c, i) => db.prepare('INSERT INTO user_areas(user_id,area_code,pos) VALUES(?,?,?)').run(u.id, c, i));
    }
    if (notify !== undefined) db.prepare('UPDATE users SET notify=? WHERE id=?').run(notify ? 1 : 0, u.id);
    if (fcm_token !== undefined) {
      const t = fcm_token === null ? null : String(fcm_token).slice(0, 4096);
      db.prepare('UPDATE users SET fcm_token=? WHERE id=?').run(t, u.id);
    }
  });
  res.json(meOf(db.prepare('SELECT * FROM users WHERE id=?').get(u.id)));
});

// 全データ削除（プライバシー: ユーザーが自分のデータをいつでも消せる）
app.delete('/api/me', (req, res) => {
  db.prepare('DELETE FROM users WHERE id=?').run(req.user.id);
  res.status(204).end();
});

// ---------- ダッシュボード ----------
app.get(
  '/api/forecast',
  wrap(async (req, res) => {
    const code = String(req.query.area || '');
    if (!isAreaCode(code)) return bad(res, 'bad_area');
    await ensureFresh(code);
    const now = Date.now();
    // 直前の変化量を出すため、表示開始(24時間前)の1点前から取る
    const rows = db
      .prepare(
        `SELECT ts,temp,pressure,icon,descr,source FROM points WHERE area_code=? AND source IN ('owm','demo') AND ts BETWEEN ? AND ? ORDER BY ts`,
      )
      .all(code, now - 30 * HOUR, now + 6 * 24 * HOUR);
    const ann = annotate(rows).filter((p) => p.ts >= now - 24 * HOUR);
    const obs = db
      .prepare(`SELECT ts,pressure,descr FROM points WHERE area_code=? AND source='jma' AND ts BETWEEN ? AND ? ORDER BY ts`)
      .all(code, now - 24 * HOUR, now);
    const fetchedAt = Number(db.prepare("SELECT v FROM meta WHERE k=?").get('fetched:' + code)?.v || 0) || null;
    res.json({
      area: { code, name: AREA_BY_CODE.get(code).name },
      now,
      fetchedAt,
      demo: rows.some((r) => r.source === 'demo'),
      points: ann,
      observed: obs,
    });
  }),
);

app.get('/api/area-stats', (req, res) => {
  const code = String(req.query.area || '');
  if (!isAreaCode(code)) return bad(res, 'bad_area');
  res.json({ area: AREA_BY_CODE.get(code).name, ...getAreaStats(code) });
});

// ---------- 体調ログ ----------
const logOut = (r) => ({ id: r.id, ts: r.ts, pain: r.pain, tags: JSON.parse(r.tags), meds: JSON.parse(r.meds), note: r.note, area: r.area_code });

function parseLog(body) {
  const pain = Number(body?.pain);
  if (!Number.isInteger(pain) || pain < 1 || pain > 5) throw Object.assign(new Error('bad_pain'), { status: 400 });
  const ts = body.ts === undefined ? Date.now() : Number(body.ts);
  if (!Number.isFinite(ts) || ts > Date.now() + 5 * 60e3 || ts < Date.now() - 400 * 24 * HOUR) throw Object.assign(new Error('bad_ts'), { status: 400 });
  const strs = (a, max) => (Array.isArray(a) ? [...new Set(a.map((x) => String(x).trim().slice(0, 40)).filter(Boolean))].slice(0, max) : []);
  return { ts, pain, tags: strs(body.tags, 20), meds: strs(body.meds, 20), note: String(body.note || '').slice(0, 500) };
}

const primaryArea = (userId) => db.prepare('SELECT area_code c FROM user_areas WHERE user_id=? AND pos=0').get(userId)?.c ?? null;

app.get('/api/logs', (req, res) => {
  const from = Number(req.query.from) || 0;
  const to = Number(req.query.to) || Date.now() + HOUR;
  const rows = db.prepare('SELECT * FROM logs WHERE user_id=? AND ts BETWEEN ? AND ? ORDER BY ts DESC LIMIT 1000').all(req.user.id, from, to);
  res.json(rows.map(logOut));
});

app.post('/api/logs', (req, res) => {
  const l = parseLog(req.body);
  const area = isAreaCode(req.body.area) ? req.body.area : primaryArea(req.user.id);
  const r = db
    .prepare('INSERT INTO logs(user_id,ts,pain,tags,meds,note,area_code) VALUES(?,?,?,?,?,?,?)')
    .run(req.user.id, l.ts, l.pain, JSON.stringify(l.tags), JSON.stringify(l.meds), l.note, area);
  res.status(201).json(logOut(db.prepare('SELECT * FROM logs WHERE id=?').get(r.lastInsertRowid)));
});

app.put('/api/logs/:id', (req, res) => {
  const l = parseLog(req.body);
  const r = db
    .prepare('UPDATE logs SET ts=?,pain=?,tags=?,meds=?,note=? WHERE id=? AND user_id=?')
    .run(l.ts, l.pain, JSON.stringify(l.tags), JSON.stringify(l.meds), l.note, req.params.id, req.user.id);
  if (!r.changes) return res.status(404).json({ error: 'not_found' });
  res.json(logOut(db.prepare('SELECT * FROM logs WHERE id=?').get(req.params.id)));
});

app.delete('/api/logs/:id', (req, res) => {
  const r = db.prepare('DELETE FROM logs WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.status(r.changes ? 204 : 404).end();
});

// ---------- ユーザー独自タグ / マイ薬リスト / 医薬品サジェスト ----------
const listApi = (route, table, col, max) => {
  app.post(route, (req, res) => {
    const v = String(req.body?.[col === 'tag' ? 'tag' : 'name'] || '').trim().slice(0, 40);
    if (!v) return bad(res, 'empty');
    const n = db.prepare(`SELECT COUNT(*) c FROM ${table} WHERE user_id=?`).get(req.user.id).c;
    if (n >= max) return bad(res, 'limit');
    db.prepare(`INSERT OR IGNORE INTO ${table}(user_id,${col}) VALUES(?,?)`).run(req.user.id, v);
    res.status(201).json({ [col]: v });
  });
  app.delete(route, (req, res) => {
    db.prepare(`DELETE FROM ${table} WHERE user_id=? AND ${col}=?`).run(req.user.id, String(req.query.v || ''));
    res.status(204).end();
  });
};
listApi('/api/tags', 'user_tags', 'tag', 30);
listApi('/api/mymeds', 'my_meds', 'name', 50);

app.get('/api/drugs', (req, res) => res.json(searchDrugs(String(req.query.q || '').slice(0, 40))));

// ---------- 分析 ----------
app.get('/api/insights', (req, res) => res.json(buildInsights(req.user.id)));

// ---------- 静的ファイル（PWA） ----------
app.get('/vendor/chart.js', (req, res) =>
  res.sendFile(path.join(__dirname, '../node_modules/chart.js/dist/chart.umd.js'), { maxAge: '7d' }),
);
app.use(express.static(path.join(__dirname, '../public'), { extensions: ['html'] }));

app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error('[error]', err);
  res.status(status).json({ error: status >= 500 ? 'internal_error' : err.message });
});

const port = Number(process.env.PORT || 3000);
export const server = app.listen(port, async () => {
  console.log(`kiatsu listening on :${port}${DEMO ? '  [OPENWEATHER_API_KEY 未設定: デモデータで動作]' : ''}`);
  await seedDrugsIfEmpty();
  if (process.env.SCHEDULER !== 'off') startScheduler();
});
