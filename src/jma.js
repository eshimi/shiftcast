// 気象庁（アメダス実況）による国内データの補完。
// 気圧を観測している最寄りの観測所の「海面気圧(normalPressure)」を実況値として保存し、予報の答え合わせ/過去の分析に使う。
import { db, tx } from './db.js';
import { AREAS } from './areas.js';
import { targetAreas } from './weather.js';

const BASE = 'https://www.jma.go.jp/bosai/amedas';
let stationCache = null;

async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json();
}

async function stations() {
  if (stationCache && Date.now() - stationCache.at < 24 * 3600e3) return stationCache.list;
  const t = await getJson(`${BASE}/const/amedastable.json`);
  const list = Object.entries(t).map(([id, s]) => ({
    id,
    lat: s.lat[0] + s.lat[1] / 60,
    lon: s.lon[0] + s.lon[1] / 60,
    name: s.kjName,
  }));
  stationCache = { at: Date.now(), list };
  return list;
}

const d2 = (a, b) => ((a.lon - b.lon) * Math.cos((a.lat * Math.PI) / 180)) ** 2 + (a.lat - b.lat) ** 2;

export async function refreshJma() {
  const latest = (await (await fetch(`${BASE}/data/latest_time.txt`, { signal: AbortSignal.timeout(15000) })).text()).trim();
  const when = new Date(latest); // 例: 2026-11-08T13:20:00+09:00
  if (Number.isNaN(when.getTime())) throw new Error('bad latest_time: ' + latest);
  const stamp = latest.replace(/[-:T]/g, '').slice(0, 14); // YYYYMMDDHHmmss
  const [map, list] = await Promise.all([getJson(`${BASE}/data/map/${stamp}.json`), stations()]);
  const withP = list.filter((s) => map[s.id]?.normalPressure?.[0] != null);
  const ins = db.prepare(`INSERT INTO points(area_code,ts,temp,pressure,icon,descr,source) VALUES(?,?,?,?,NULL,?,'jma')
    ON CONFLICT(area_code,ts,source) DO UPDATE SET temp=excluded.temp, pressure=excluded.pressure, descr=excluded.descr`);
  // 10分値を保存すると増えすぎるので、毎時0分の観測のみ蓄積する
  if (when.getMinutes() !== 0) return console.log('[jma] skip non-hourly', latest);
  let n = 0;
  tx(() => {
    for (const code of targetAreas()) {
      const a = AREAS.find((x) => x.code === code);
      const st = withP.reduce((best, s) => (!best || d2(s, a) < d2(best, a) ? s : best), null);
      if (!st) continue;
      const o = map[st.id];
      ins.run(code, when.getTime(), o.temp?.[0] ?? null, o.normalPressure[0], `アメダス ${st.name}`);
      n++;
    }
  });
  console.log(`[jma] stored ${n} areas @ ${latest}`);
}
