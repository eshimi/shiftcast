// 降水量・湿度(表示専用)。points表を変えずに済むよう、地域ごとに meta テーブルへJSONで保存する。
//   obs: 気象庁アメダスの実測(毎時) [{ ts, r1: 1時間降水量mm, r24: 24時間降水量mm, h: 湿度% }]
//   fc : OpenWeatherMapの予報(3時間おき) [{ ts, r3: 3時間降水量mm|null, h: 湿度%, pop: 降水確率0-1|null }]
import { getMeta, setMeta } from './db.js';
import { HOUR } from './pressure.js';

const key = (code) => 'wxx:' + code;
export async function loadExtras(db, code) {
  try {
    const raw = await getMeta(db, key(code));
    const j = raw ? JSON.parse(raw) : {};
    return { obs: j.obs || [], fc: j.fc || [] };
  } catch {
    return { obs: [], fc: [] };
  }
}

/** obs は追記(古い・重複を除く)、fc は置き換え。 */
export async function saveExtras(db, code, { obs, fc }, now = Date.now()) {
  const cur = await loadExtras(db, code);
  let nextObs = cur.obs;
  if (obs?.length) {
    const m = new Map(cur.obs.map((o) => [o.ts, o]));
    obs.forEach((o) => m.set(o.ts, o));
    nextObs = [...m.values()].filter((o) => o.ts >= now - 40 * HOUR).sort((a, b) => a.ts - b.ts);
  }
  const nextFc = fc ? fc.sort((a, b) => a.ts - b.ts) : cur.fc;
  await setMeta(db, key(code), JSON.stringify({ obs: nextObs, fc: nextFc }));
}

const r1 = (x) => Math.round(x * 10) / 10;
const near = (list, ts, maxH) => {
  let best = null;
  for (const o of list) if (Math.abs(o.ts - ts) <= maxH * HOUR && (!best || Math.abs(o.ts - ts) < Math.abs(best.ts - ts))) best = o;
  return best;
};
const lerpFc = (fc, ts) => {
  const p = fc.filter((o) => o.h != null);
  const a = [...p].reverse().find((o) => o.ts <= ts);
  const b = p.find((o) => o.ts >= ts);
  if (a && b && a !== b && b.ts - a.ts <= 8 * HOUR) return a.h + ((b.h - a.h) * (ts - a.ts)) / (b.ts - a.ts);
  return (a || b)?.h ?? null;
};

// ---- 表示専用の暫定の目安(医学的な基準ではない) ----
export const RAIN_LABEL = { none: '雨の心配は小さめ', small: '雨あり', mid: 'まとまった雨', big: '雨が多め' };
export const HUM_LABEL = { none: '湿度は ふつう', mid: '湿度 高め', big: '湿度 かなり高め' };
export const WET_RULE = { smallMm: 1, midMm: 10, bigMm: 30, humMid: 75, humBig: 85 };

/** 降水(直近24時間の実測と今後24時間の予測)と湿度。データが無い要素は null。 */
export function wetInfo({ obs, fc }, now) {
  const o = near(obs, now, 2.5);
  const o24 = near(obs, now - 24 * HOUR, 2.5);
  const next = fc.filter((x) => x.ts > now && x.ts <= now + 24 * HOUR);
  const nextRain = next.some((x) => x.r3 != null) ? next.reduce((s, x) => s + (x.r3 || 0), 0) : null;
  const popMax = next.some((x) => x.pop != null) ? Math.max(...next.map((x) => x.pop ?? 0)) : null;
  const past24 = o?.r24 ?? null;
  let rain = null;
  if (o || nextRain != null) {
    const m = Math.max(past24 ?? 0, nextRain ?? 0);
    const level = m >= WET_RULE.bigMm ? 'big' : m >= WET_RULE.midMm ? 'mid' : m >= WET_RULE.smallMm ? 'small' : 'none';
    rain = { now1h: o?.r1 ?? null, past24: past24 == null ? null : r1(past24), prev24: o24?.r24 == null ? null : r1(o24.r24), next24: nextRain == null ? null : r1(nextRain), popMax: popMax == null ? null : Math.round(popMax * 100), level, label: RAIN_LABEL[level] };
  }
  const hNow = o?.h ?? lerpFc(fc, now);
  let hum = null;
  if (hNow != null) {
    const hs = next.map((x) => x.h).filter((x) => x != null);
    const hMax = Math.max(hNow, ...hs);
    const hMin = Math.min(hNow, ...hs);
    const level = hMax >= WET_RULE.humBig ? 'big' : hMax >= WET_RULE.humMid ? 'mid' : 'none';
    hum = { now: Math.round(hNow), d24: o24?.h == null ? null : Math.round(hNow - o24.h), min: Math.round(hMin), max: Math.round(hMax), level, label: HUM_LABEL[level] };
  }
  return { rain, hum };
}

/** 気圧・気温差・降水・湿度のうち、気になる要因を並べて文章にする(表示専用)。 */
export function factorSummary({ pressureLevel, temp, rain, hum }) {
  const f = [];
  if (['slight', 'caution', 'warning'].includes(pressureLevel)) f.push({ key: 'pressure', text: pressureLevel === 'slight' ? '気圧のやや大きな低下' : '気圧の大きな低下' });
  else if (pressureLevel === 'rise') f.push({ key: 'pressure', text: '気圧の上昇' });
  if (temp && temp.level !== 'none') f.push({ key: 'temp', text: temp.level === 'big' ? '大きな気温差' : '気温差' });
  if (rain && (rain.level === 'mid' || rain.level === 'big')) f.push({ key: 'rain', text: rain.level === 'big' ? '雨の多さ' : 'まとまった雨' });
  if (hum && hum.level !== 'none') f.push({ key: 'hum', text: hum.level === 'big' ? 'かなり高い湿度' : '高い湿度' });
  const names = f.map((x) => x.text);
  const text = !f.length ? 'いまのところ、気圧・気温差・降水・湿度のうち、気になる要因は見られません。'
    : f.length === 1 ? `気になる要因は「${names[0]}」です。`
      : `「${names.join('」「')}」が重なる見込みです。体調に変化を感じやすい日かもしれません。早めの休息を。`;
  return { count: f.length, factors: f.map((x) => x.key), text };
}
