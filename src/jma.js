// 気象庁アメダス実況による国内データの補完。最寄りの「気圧観測あり」観測所の海面気圧を実況値として保存する。
import { batch, setMeta } from './db.js';
import { AREAS } from './areas.js';
import { targetAreas } from './weather.js';

const BASE = 'https://www.jma.go.jp/bosai/amedas';
let stationCache = null;

const getJson = async (url) => {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json();
};

async function stations() {
  if (stationCache && Date.now() - stationCache.at < 24 * 3600e3) return stationCache.list;
  const t = await getJson(`${BASE}/const/amedastable.json`);
  const list = Object.entries(t).map(([id, s]) => ({ id, lat: s.lat[0] + s.lat[1] / 60, lon: s.lon[0] + s.lon[1] / 60, name: s.kjName }));
  stationCache = { at: Date.now(), list };
  return list;
}
const d2 = (a, b) => ((a.lon - b.lon) * Math.cos((a.lat * Math.PI) / 180)) ** 2 + (a.lat - b.lat) ** 2;

export async function refreshJma(env) {
  const latest = (await (await fetch(`${BASE}/data/latest_time.txt`, { signal: AbortSignal.timeout(15000) })).text()).trim();
  const when = new Date(latest); // 例: 2026-11-08T13:00:00+09:00
  if (Number.isNaN(when.getTime())) throw new Error('bad latest_time: ' + latest);
  if (when.getUTCMinutes() !== 0) return console.log('[jma] skip non-hourly', latest); // 毎時0分の観測のみ蓄積
  const stamp = latest.replace(/[-:T]/g, '').slice(0, 14);
  const [map, list] = await Promise.all([getJson(`${BASE}/data/map/${stamp}.json`), stations()]);
  const withP = list.filter((s) => map[s.id]?.normalPressure?.[0] != null);
  const stmts = [];
  for (const code of await targetAreas(env)) {
    const a = AREAS.find((x) => x.code === code);
    const st = withP.reduce((best, s) => (!best || d2(s, a) < d2(best, a) ? s : best), null);
    if (!st) continue;
    const o = map[st.id];
    stmts.push([
      `INSERT INTO points(area_code,ts,temp,pressure,icon,descr,source) VALUES(?,?,?,?,NULL,?,'jma')
       ON CONFLICT(area_code,ts,source) DO UPDATE SET temp=excluded.temp, pressure=excluded.pressure, descr=excluded.descr`,
      code, when.getTime(), o.temp?.[0] ?? null, o.normalPressure[0], `アメダス ${st.name}`,
    ]);
  }
  await batch(env.DB, stmts);
  console.log(`[jma] stored ${stmts.length} areas @ ${latest}`);
}

/** 気象庁 府県天気予報の要約（今日〜数日の天気文と降水確率）。主地域(areas[0])を採用。 */
export function summarizeForecast(data) {
  const short = data?.[0]?.timeSeries;
  if (!short?.[0]?.areas?.[0]) return [];
  const w = short[0];
  const pops = short.find((t) => t.areas?.[0]?.pops);
  const maxPop = {};
  pops?.timeDefines.forEach((t, i) => {
    const d = t.slice(0, 10); // JSTの日付
    const v = Number(pops.areas[0].pops[i]);
    if (Number.isFinite(v)) maxPop[d] = Math.max(maxPop[d] ?? 0, v);
  });
  return w.timeDefines.map((t, i) => ({
    date: t.slice(0, 10),
    weather: String(w.areas[0].weathers?.[i] ?? '').replace(/[\u3000\s]+/g, ' ').trim(),
    pop: maxPop[t.slice(0, 10)] ?? null,
  }));
}

export async function refreshJmaForecastArea(env, code) {
  const a = AREAS.find((x) => x.code === code);
  const data = await getJson(`https://www.jma.go.jp/bosai/forecast/data/forecast/${a.jma}.json`);
  await setMeta(env.DB, 'jmaFc:' + code, JSON.stringify({ at: Date.now(), office: data[0]?.publishingOffice, days: summarizeForecast(data) }));
}

export async function refreshJmaForecast(env) {
  let ok = 0;
  for (const code of await targetAreas(env)) {
    try {
      await refreshJmaForecastArea(env, code);
      ok++;
    } catch (e) {
      console.error('[jma:forecast]', code, e.message);
    }
  }
  console.log(`[jma] forecast ${ok} areas`);
}
