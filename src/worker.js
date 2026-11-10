import { Hono } from 'hono';
import { all, get, run, batch } from './db.js';
import { AREAS, AREA_BY_CODE, isAreaCode, nearestArea } from './areas.js';
import { annotate, LEVEL_LABEL, HOUR } from './pressure.js';
import { isDemo, ensureFresh } from './weather.js';
import { getAreaStats } from './stats.js';
import { buildInsights, withPressure } from './insights.js';
import { searchDrugs } from './drugs.js';
import { scheduled } from './cron.js';
import { loadJmaCached } from './jma.js';
import { buildWeek } from './week.js';
import { SITE_URL } from './siteconfig.js';
import { COLUMNS, COLUMN_UPDATED, columnList } from './columns.js';
import { prefBySlug, PREFS } from './prefectures.js';
import { appPage, topPage, pressurePage, pressureIndexPage, weatherPage, columnsPage, columnPage, aboutPage, notFoundPage } from './pages.js';

const app = new Hono();
const bad = (c, msg, status = 400) => c.json({ error: msg }, status);
const body = (c) => c.req.json().catch(() => ({}));

app.use('/api/*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'no-referrer');
  if (!c.res.headers.get('Cache-Control')) c.header('Cache-Control', 'no-store'); // 公開データのAPIは各ルートで指定
});

// ---------- 認証（端末ごとの匿名ID。氏名・メール等は扱わない） ----------
app.post('/api/users', async (c) => {
  const id = crypto.randomUUID();
  const now = Date.now();
  const b = await body(c);
  const area = isAreaCode(b.area_code) ? b.area_code : '13';
  await batch(c.env.DB, [
    ['INSERT INTO users(id,created_at,last_seen) VALUES(?,?,?)', id, now, now],
    ['INSERT INTO user_areas(user_id,area_code,pos) VALUES(?,?,0)', id, area],
  ]);
  return c.json({ id }, 201);
});

// ---------- 公開エンドポイント ----------
app.get('/api/config', (c) => {
  let firebase = null;
  try {
    firebase = c.env.FIREBASE_WEB_CONFIG ? JSON.parse(c.env.FIREBASE_WEB_CONFIG) : null;
  } catch {}
  return c.json({ demo: isDemo(c.env), firebase, vapidKey: c.env.FIREBASE_VAPID_KEY || null, levels: LEVEL_LABEL });
});
// 週間天気（トップ/週間天気ページ用。認証不要・個人情報なし）
app.get('/api/week', async (c) => {
  const code = c.req.query('area') || '';
  if (!isAreaCode(code)) return bad(c, 'bad_area');
  c.header('Cache-Control', 'public, max-age=300'); // 5分キャッシュ（気象データは3時間ごとの更新）
  return c.json(await buildWeek(c.env, code));
});
app.get('/api/columns', (c) => c.json(columnList()));

app.get('/api/areas', (c) => c.json(AREAS.map(({ code, name }) => ({ code, name }))));
app.get('/api/nearest', (c) => {
  const lat = Number(c.req.query('lat'));
  const lon = Number(c.req.query('lon'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return bad(c, 'bad_coords');
  const a = nearestArea(lat, lon); // 座標は保存・ログ出力しない
  return c.json({ code: a.code, name: a.name });
});

// ---------- 以降は要認証 ----------
app.use('/api/*', async (c, next) => {
  const id = c.req.header('x-user-id');
  const u = id && (await get(c.env.DB, 'SELECT * FROM users WHERE id=?', id));
  if (!u) return bad(c, 'unauthorized', 401);
  const now = Date.now();
  if (now - u.last_seen > 5 * 60e3) await run(c.env.DB, 'UPDATE users SET last_seen=? WHERE id=?', now, u.id);
  c.set('user', u);
  await next();
});

const meOf = async (db, u) => ({
  id: u.id,
  notify: !!u.notify,
  hasPush: !!u.fcm_token,
  areas: (await all(db, 'SELECT area_code code FROM user_areas WHERE user_id=? ORDER BY pos', u.id)).map((r) => r.code),
  tags: (await all(db, 'SELECT tag FROM user_tags WHERE user_id=? ORDER BY rowid', u.id)).map((r) => r.tag),
  myMeds: (await all(db, 'SELECT name FROM my_meds WHERE user_id=? ORDER BY rowid', u.id)).map((r) => r.name),
});

app.get('/api/me', async (c) => c.json(await meOf(c.env.DB, c.get('user'))));

app.put('/api/me', async (c) => {
  const { areas, notify, fcm_token } = await body(c);
  const u = c.get('user');
  const stmts = [];
  if (areas !== undefined) {
    if (!Array.isArray(areas) || !areas.length || areas.length > 3 || !areas.every(isAreaCode)) return bad(c, 'bad_areas');
    stmts.push(['DELETE FROM user_areas WHERE user_id=?', u.id]);
    [...new Set(areas)].forEach((code, i) => stmts.push(['INSERT INTO user_areas(user_id,area_code,pos) VALUES(?,?,?)', u.id, code, i]));
  }
  if (notify !== undefined) stmts.push(['UPDATE users SET notify=? WHERE id=?', notify ? 1 : 0, u.id]);
  if (fcm_token !== undefined) stmts.push(['UPDATE users SET fcm_token=? WHERE id=?', fcm_token === null ? null : String(fcm_token).slice(0, 4096), u.id]);
  await batch(c.env.DB, stmts);
  return c.json(await meOf(c.env.DB, await get(c.env.DB, 'SELECT * FROM users WHERE id=?', u.id)));
});

// 全データ削除（ユーザーがいつでも自分のデータを消せる）。外部キーのCASCADEに頼らず明示的に削除。
app.delete('/api/me', async (c) => {
  const id = c.get('user').id;
  await batch(c.env.DB, ['logs', 'user_tags', 'my_meds', 'user_areas', 'users'].map((t) => [`DELETE FROM ${t} WHERE ${t === 'users' ? 'id' : 'user_id'}=?`, id]));
  return c.body(null, 204);
});

// ---------- ダッシュボード ----------
app.get('/api/forecast', async (c) => {
  const code = c.req.query('area') || '';
  if (!isAreaCode(code)) return bad(c, 'bad_area');
  const db = c.env.DB;
  await ensureFresh(c.env, code);
  const now = Date.now();
  const rows = await all(db, `SELECT ts,temp,pressure,icon,descr,source FROM points WHERE area_code=? AND source IN ('owm','demo') AND ts BETWEEN ? AND ? ORDER BY ts`, code, now - 7 * 24 * HOUR, now + 6 * 24 * HOUR);
  const observed = await all(db, `SELECT ts,pressure,descr FROM points WHERE area_code=? AND source='jma' AND ts BETWEEN ? AND ? ORDER BY ts`, code, now - 7 * 24 * HOUR, now);
  const fetchedAt = Number((await get(db, 'SELECT v FROM meta WHERE k=?', 'fetched:' + code))?.v || 0) || null;
  return c.json({
    area: { code, name: AREA_BY_CODE.get(code).name },
    now,
    fetchedAt,
    demo: rows.some((r) => r.source === 'demo'),
    points: annotate(rows).filter((p) => p.ts >= now - 7 * 24 * HOUR),
    observed,
    jma: await loadJmaCached(c.env, code),
  });
});

app.get('/api/area-stats', async (c) => {
  const code = c.req.query('area') || '';
  if (!isAreaCode(code)) return bad(c, 'bad_area');
  return c.json({ area: AREA_BY_CODE.get(code).name, ...(await getAreaStats(c.env, code)) });
});

// ---------- 体調ログ ----------
const logOut = (r) => ({ id: r.id, ts: r.ts, pain: r.pain, tags: JSON.parse(r.tags), meds: JSON.parse(r.meds), note: r.note, area: r.area_code });

function parseLog(b) {
  const pain = Number(b?.pain);
  if (!Number.isInteger(pain) || pain < 1 || pain > 5) return { error: 'bad_pain' };
  const ts = b.ts === undefined ? Date.now() : Number(b.ts);
  if (!Number.isFinite(ts) || ts > Date.now() + 5 * 60e3 || ts < Date.now() - 400 * 24 * HOUR) return { error: 'bad_ts' };
  const strs = (a, max) => (Array.isArray(a) ? [...new Set(a.map((x) => String(x).trim().slice(0, 40)).filter(Boolean))].slice(0, max) : []);
  return { ts, pain, tags: JSON.stringify(strs(b.tags, 20)), meds: JSON.stringify(strs(b.meds, 20)), note: String(b.note || '').slice(0, 500) };
}

app.get('/api/logs', async (c) => {
  const from = Number(c.req.query('from')) || 0;
  const to = Number(c.req.query('to')) || Date.now() + HOUR;
  const rows = await all(c.env.DB, 'SELECT * FROM logs WHERE user_id=? AND ts BETWEEN ? AND ? ORDER BY ts DESC LIMIT 1000', c.get('user').id, from, to);
  return c.json(await withPressure(c.env.DB, rows.map(logOut)));
});

app.post('/api/logs', async (c) => {
  const b = await body(c);
  const l = parseLog(b);
  if (l.error) return bad(c, l.error);
  const u = c.get('user');
  const area = isAreaCode(b.area) ? b.area : (await get(c.env.DB, 'SELECT area_code c FROM user_areas WHERE user_id=? AND pos=0', u.id))?.c ?? null;
  const r = await run(c.env.DB, 'INSERT INTO logs(user_id,ts,pain,tags,meds,note,area_code) VALUES(?,?,?,?,?,?,?)', u.id, l.ts, l.pain, l.tags, l.meds, l.note, area);
  return c.json(logOut(await get(c.env.DB, 'SELECT * FROM logs WHERE id=?', r.meta.last_row_id)), 201);
});

app.put('/api/logs/:id', async (c) => {
  const l = parseLog(await body(c));
  if (l.error) return bad(c, l.error);
  const r = await run(c.env.DB, 'UPDATE logs SET ts=?,pain=?,tags=?,meds=?,note=? WHERE id=? AND user_id=?', l.ts, l.pain, l.tags, l.meds, l.note, c.req.param('id'), c.get('user').id);
  if (!r.meta.changes) return bad(c, 'not_found', 404);
  return c.json(logOut(await get(c.env.DB, 'SELECT * FROM logs WHERE id=?', c.req.param('id'))));
});

app.delete('/api/logs/:id', async (c) => {
  const r = await run(c.env.DB, 'DELETE FROM logs WHERE id=? AND user_id=?', c.req.param('id'), c.get('user').id);
  return c.body(null, r.meta.changes ? 204 : 404);
});

// ---------- ユーザー独自タグ / マイ薬リスト / 医薬品サジェスト ----------
for (const [route, table, col, field, max] of [['/api/tags', 'user_tags', 'tag', 'tag', 30], ['/api/mymeds', 'my_meds', 'name', 'name', 50]]) {
  app.post(route, async (c) => {
    const v = String((await body(c))[field] || '').trim().slice(0, 40);
    if (!v) return bad(c, 'empty');
    const uid = c.get('user').id;
    if ((await get(c.env.DB, `SELECT COUNT(*) c FROM ${table} WHERE user_id=?`, uid)).c >= max) return bad(c, 'limit');
    await run(c.env.DB, `INSERT OR IGNORE INTO ${table}(user_id,${col}) VALUES(?,?)`, uid, v);
    return c.json({ [col]: v }, 201);
  });
  app.delete(route, async (c) => {
    await run(c.env.DB, `DELETE FROM ${table} WHERE user_id=? AND ${col}=?`, c.get('user').id, c.req.query('v') || '');
    return c.body(null, 204);
  });
}

app.get('/api/drugs', async (c) => c.json(await searchDrugs(c.env.DB, (c.req.query('q') || '').slice(0, 40))));
app.get('/api/insights', async (c) => c.json(await buildInsights(c.env, c.get('user').id)));

// ---------- ページ（サーバー描画） ----------
const html = (c, body, status = 200) => {
  c.header('Cache-Control', 'public, max-age=300');
  return c.html(body, status);
};
app.get('/robots.txt', (c) => {
  c.header('Cache-Control', 'public, max-age=3600');
  return c.text(`User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
});
app.get('/sitemap.xml', (c) => {
  const urls = [['/', null], ['/about', null], ['/weather', null], ['/columns', COLUMN_UPDATED], ['/app/', null], ['/pressure', null], ...PREFS.map((p) => [`/pressure/${p.slug}`, null]), ...COLUMNS.map((x) => [`/columns/${x.slug}`, COLUMN_UPDATED])];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(([u, m]) => `<url><loc>${SITE_URL}${u}</loc>${m ? `<lastmod>${m}</lastmod>` : ''}</url>`).join('\n')}\n</urlset>\n`;
  c.header('Cache-Control', 'public, max-age=3600');
  return c.body(xml, 200, { 'content-type': 'application/xml; charset=utf-8' });
});
app.get('/', (c) => html(c, topPage()));
app.get('/weather', (c) => html(c, weatherPage()));
app.get('/pressure', (c) => html(c, pressureIndexPage()));
app.get('/pressure/:slug', async (c) => {
  const pref = prefBySlug(c.req.param('slug'));
  if (!pref) return html(c, notFoundPage(), 404);
  let week = null;
  try { week = await buildWeek(c.env, pref.code); } catch (e) { console.error('[pressure]', e); }
  c.header('Cache-Control', 'public, max-age=600');
  return c.html(pressurePage(pref, week));
});
app.get('/app', (c) => c.redirect('/app/', 301));
app.get('/app/', (c) => html(c, appPage()));
app.get('/about', (c) => html(c, aboutPage()));
app.get('/columns', (c) => html(c, columnsPage()));
app.get('/columns/:slug', (c) => {
  const page = columnPage(c.req.param('slug'));
  return page ? html(c, page) : html(c, notFoundPage(), 404);
});

app.notFound((c) => (c.req.path.startsWith('/api/') ? bad(c, 'not_found', 404) : c.env.ASSETS.fetch(c.req.raw)));
app.onError((err, c) => {
  console.error('[error]', err);
  return bad(c, 'internal_error', 500);
});

export default { fetch: app.fetch, scheduled: (controller, env, ctx) => ctx.waitUntil(scheduled(controller, env)) };
