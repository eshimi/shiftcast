// 気象データ定期取得（OpenWeatherMap 無料枠）。クライアントは外部APIを直接呼ばず、ここで保存したD1を参照する。
import { all, get, run, batch, getMeta, setMeta } from './db.js';
import { AREAS, AREA_BY_CODE } from './areas.js';
import { HOUR } from './pressure.js';
import { saveExtras } from './extras.js';

export const isDemo = (env) => !env.OPENWEATHER_API_KEY;
const MIN_REFRESH_MS = 30 * 60e3;

const UPSERT = `INSERT INTO points(area_code,ts,temp,pressure,icon,descr,source) VALUES(?,?,?,?,?,?,?)
  ON CONFLICT(area_code,ts,source) DO UPDATE SET temp=excluded.temp, pressure=excluded.pressure, icon=excluded.icon, descr=excluded.descr`;

async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url.replace(/appid=[^&]+/, 'appid=***')}`);
  return res.json();
}
const rowOf = (code, o) => [UPSERT, code, o.dt * 1000, o.main?.temp ?? null, o.main?.pressure ?? null /* 海面気圧 */, o.weather?.[0]?.icon ?? null, o.weather?.[0]?.description ?? null, 'owm'];

// ---- デモデータ（APIキー未設定時。開発・動作確認用） ----
const demoPressure = (code, ts) => {
  const phase = Number(code) * 0.7;
  const t = ts / HOUR;
  return 1011 + 6 * Math.sin((2 * Math.PI * t) / 61 + phase) + 3 * Math.sin((2 * Math.PI * t) / 17 + phase * 2);
};
function demoRows(code, from, to) {
  const rows = [];
  const step = 3 * HOUR;
  for (let ts = Math.ceil(from / step) * step; ts <= to; ts += step) {
    const t = ts / HOUR;
    const cloud = Math.sin(t / 9 + Number(code));
    const icon = cloud > 0.6 ? '10d' : cloud > 0 ? '03d' : cloud > -0.5 ? '02d' : '01d';
    rows.push([UPSERT, code, ts, Math.round((16 + 6 * Math.sin((2 * Math.PI * (t - 9)) / 24)) * 10) / 10, Math.round(demoPressure(code, ts) * 10) / 10, icon, 'デモデータ', 'demo']);
  }
  return rows;
}

// デモ: 降水量・湿度(開発・動作確認用)
function demoExtras(code, now) {
  const n = Number(code);
  const hum = (ts) => Math.round(68 + 18 * Math.sin(ts / HOUR / 11 + n) + 8 * Math.sin(ts / HOUR / 3.5));
  const rainAt = (ts) => Math.max(0, Math.round((Math.sin(ts / HOUR / 7 + n * 1.3) - 0.35) * 9 * 10) / 10);
  const step = 3 * HOUR;
  const fc = [];
  for (let ts = Math.ceil(now / step) * step; ts <= now + 5 * 24 * HOUR; ts += step) fc.push({ ts, r3: rainAt(ts), h: hum(ts), pop: Math.min(1, rainAt(ts) / 6) });
  const obs = [];
  for (let ts = Math.floor(now / HOUR) * HOUR; ts >= now - 36 * HOUR; ts -= HOUR) {
    let r24 = 0;
    for (let k = 0; k < 24; k++) r24 += rainAt(ts - k * HOUR) / 3;
    obs.push({ ts, r1: Math.round((rainAt(ts) / 3) * 10) / 10, r24: Math.round(r24 * 10) / 10, h: hum(ts) });
  }
  return { fc, obs };
}

export async function refreshArea(env, code) {
  const area = AREA_BY_CODE.get(code);
  if (!area) throw new Error('unknown area ' + code);
  const now = Date.now();
  if (isDemo(env)) {
    const has = (await get(env.DB, "SELECT COUNT(*) c FROM points WHERE area_code=? AND source='demo'", code)).c;
    await batch(env.DB, demoRows(code, has ? now - 6 * HOUR : now - 14 * 24 * HOUR, now + 5 * 24 * HOUR));
    await saveExtras(env.DB, code, demoExtras(code, now), now);
  } else {
    const base = `lat=${area.lat}&lon=${area.lon}&units=metric&lang=ja&appid=${env.OPENWEATHER_API_KEY}`;
    await run(env.DB, "DELETE FROM points WHERE source='demo'"); // キー設定後はデモ行を残さない
    const [fc, cur] = await Promise.all([
      getJson(`https://api.openweathermap.org/data/2.5/forecast?${base}`),
      getJson(`https://api.openweathermap.org/data/2.5/weather?${base}`),
    ]);
    await batch(env.DB, [...fc.list.map((o) => rowOf(code, o)), rowOf(code, cur)]);
    // 降水量・湿度(表示専用)。予報の3時間降水量と、現在の湿度
    await saveExtras(env.DB, code, { fc: [{ ts: cur.dt * 1000, r3: null, h: cur.main?.humidity ?? null, pop: null }, ...fc.list.map((o) => ({ ts: o.dt * 1000, r3: o.rain?.['3h'] ?? 0, h: o.main?.humidity ?? null, pop: o.pop ?? null }))] }, now);
  }
  await setMeta(env.DB, 'fetched:' + code, now);
}

/** 取得対象: ユーザー登録エリア ∪ EXTRA_AREAS（無ければ東京）。ALL_AREAS=1で全県 */
export async function targetAreas(env) {
  const set = new Set((await all(env.DB, 'SELECT DISTINCT area_code c FROM user_areas')).map((r) => r.c));
  (env.EXTRA_AREAS || '').split(',').map((s) => s.trim()).filter(Boolean).forEach((c) => set.add(c));
  if (env.ALL_AREAS === '1') AREAS.forEach((a) => set.add(a.code));
  if (!set.size) set.add('13');
  return [...set].filter((c) => AREA_BY_CODE.has(c)).sort();
}

export async function refreshAll(env) {
  const codes = await targetAreas(env);
  let ok = 0;
  for (const c of codes) {
    try {
      await refreshArea(env, c);
      ok++;
    } catch (e) {
      console.error('[weather]', c, e.message);
    }
    if (!isDemo(env)) await new Promise((r) => setTimeout(r, 1100)); // 無料枠(60回/分)に余裕を持たせる
  }
  console.log(`[weather] refreshed ${ok}/${codes.length} areas${isDemo(env) ? ' (DEMO data)' : ''}`);
}

/** 未取得エリアを見たときの初回取得。取得済みなら何もしない（以降はCron任せ）。 */
export async function ensureFresh(env, code) {
  const last = Number((await getMeta(env.DB, 'fetched:' + code)) || 0);
  if (last && Date.now() - last < 3 * HOUR) return;
  if (Date.now() - last < MIN_REFRESH_MS) return;
  try {
    await refreshArea(env, code);
  } catch (e) {
    console.error('[weather:on-demand]', code, e.message);
  }
}
