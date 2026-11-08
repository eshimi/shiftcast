// 気象データ定期取得（OpenWeatherMap 無料枠）。クライアントは外部APIを直接呼ばず、ここで取得・保存したDBを参照する。
import { db, tx, getMeta, setMeta } from './db.js';
import { AREAS, AREA_BY_CODE } from './areas.js';
import { HOUR } from './pressure.js';

const KEY = process.env.OPENWEATHER_API_KEY || '';
export const DEMO = !KEY;
const MIN_REFRESH_MS = 30 * 60e3; // 同一エリアの再取得の最短間隔（オンデマンド取得の連打防止）

const upsert = () =>
  db.prepare(`INSERT INTO points(area_code,ts,temp,pressure,icon,descr,source) VALUES(?,?,?,?,?,?,?)
    ON CONFLICT(area_code,ts,source) DO UPDATE SET temp=excluded.temp, pressure=excluded.pressure, icon=excluded.icon, descr=excluded.descr`);

async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url.replace(/appid=[^&]+/, 'appid=***')}`);
  return res.json();
}

const rowOf = (code, o) => [
  code,
  o.dt * 1000,
  o.main?.temp ?? null,
  o.main?.pressure ?? null, // OWM の pressure は海面気圧(hPa)
  o.weather?.[0]?.icon ?? null,
  o.weather?.[0]?.description ?? null,
  'owm',
];

// ---- デモデータ（APIキー未設定時。開発・動作確認用） ----
function demoPressure(code, ts) {
  const phase = Number(code) * 0.7;
  const t = ts / HOUR;
  return 1011 + 6 * Math.sin((2 * Math.PI * t) / 61 + phase) + 3 * Math.sin((2 * Math.PI * t) / 17 + phase * 2);
}
function demoRows(code, from, to) {
  const rows = [];
  const step = 3 * HOUR;
  for (let ts = Math.ceil(from / step) * step; ts <= to; ts += step) {
    const t = ts / HOUR;
    const cloud = Math.sin(t / 9 + Number(code));
    const icon = cloud > 0.6 ? '10d' : cloud > 0 ? '03d' : cloud > -0.5 ? '02d' : '01d';
    rows.push([
      code,
      ts,
      Math.round((16 + 6 * Math.sin((2 * Math.PI * (t - 9)) / 24)) * 10) / 10,
      Math.round(demoPressure(code, ts) * 10) / 10,
      icon,
      'デモデータ',
      'demo',
    ]);
  }
  return rows;
}

export async function refreshArea(code) {
  const area = AREA_BY_CODE.get(code);
  if (!area) throw new Error('unknown area ' + code);
  const ins = upsert();
  const now = Date.now();
  if (DEMO) {
    const has = db.prepare("SELECT COUNT(*) c FROM points WHERE area_code=? AND source='demo'").get(code).c;
    const from = has ? now - 6 * HOUR : now - 14 * 24 * HOUR; // 初回は2週間分を遡って生成（分析画面の確認用）
    const rows = demoRows(code, from, now + 5 * 24 * HOUR);
    tx(() => rows.forEach((r) => ins.run(...r)));
  } else {
    const base = `lat=${area.lat}&lon=${area.lon}&units=metric&lang=ja&appid=${KEY}`;
    const [fc, cur] = await Promise.all([
      getJson(`https://api.openweathermap.org/data/2.5/forecast?${base}`),
      getJson(`https://api.openweathermap.org/data/2.5/weather?${base}`),
    ]);
    tx(() => {
      fc.list.forEach((o) => ins.run(...rowOf(code, o)));
      ins.run(...rowOf(code, cur));
    });
  }
  setMeta('fetched:' + code, now);
}

/** 取得対象エリア: ユーザー登録エリア ∪ EXTRA_AREAS（無ければ東京） */
export function targetAreas() {
  const set = new Set(db.prepare('SELECT DISTINCT area_code c FROM user_areas').all().map((r) => r.c));
  (process.env.EXTRA_AREAS || '').split(',').map((s) => s.trim()).filter(Boolean).forEach((c) => set.add(c));
  if (process.env.ALL_AREAS === '1') AREAS.forEach((a) => set.add(a.code));
  if (!set.size) set.add('13');
  return [...set].filter((c) => AREA_BY_CODE.has(c)).sort();
}

export async function refreshAll() {
  const codes = targetAreas();
  let ok = 0;
  for (const c of codes) {
    try {
      await refreshArea(c);
      ok++;
    } catch (e) {
      console.error('[weather]', c, e.message);
    }
    if (!DEMO) await new Promise((r) => setTimeout(r, 1100)); // 無料枠(60回/分)に十分余裕を持たせる
  }
  console.log(`[weather] refreshed ${ok}/${codes.length} areas${DEMO ? ' (DEMO data)' : ''}`);
}

// 未取得エリアをユーザーが見たときの初回取得（同時多重呼び出しを1回にまとめる）
const inflight = new Map();
export async function ensureFresh(code) {
  const last = Number(getMeta('fetched:' + code) || 0);
  if (Date.now() - last < MIN_REFRESH_MS) return;
  if (last && Date.now() - last < 3 * HOUR) return; // 通常はバッチ任せ
  if (!inflight.has(code)) {
    inflight.set(
      code,
      refreshArea(code)
        .catch((e) => console.error('[weather:on-demand]', code, e.message))
        .finally(() => inflight.delete(code)),
    );
  }
  await inflight.get(code);
}
