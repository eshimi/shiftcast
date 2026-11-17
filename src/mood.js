// 「体調そらもよう」: 気圧・気温差・降水・湿度の4つを、5段階の体調レベル(5=気候が快調 〜 1=体調不良に注意)と点数(0〜100、高いほど快調)にまとめる。
// 表示専用の暫定のロジックで、医学的に検証された基準ではない。通知には使わない。
// 重み: 気圧は体調との関係の報告が最も多いと考え、他の要因より大きくしている。
import { factorSummary } from './extras.js';
import { careFor } from './care.js';

export const MOOD_POINTS = {
  pressure: { none: 0, rise: 1, slight: 2, caution: 4, warning: 6 },
  temp: { none: 0, mid: 1, big: 2 },
  rain: { none: 0, small: 0, mid: 1, big: 2 },
  hum: { none: 0, mid: 1, big: 2 },
  // 過去24時間に実際に下がった量(hPa)。予報の「これから」だけでは、すでに下がった分を見落とすため
  past24: [[-10, 3], [-6, 2], [-3, 1]], // [下がった量の上限, 加点]
  lowPressure: [[1000, 2], [1008, 1]], // [気圧の上限, 加点]
  overlapBonus: 1, // 気になる要因が3つ以上重なったときの加点
  overlapFrom: 3,
};
export const MOOD_MAX = 6 + 2 + 2 + 2 + 3 + 2 + 1; // 18
const r1 = (x) => Math.round(x * 10) / 10;

/** 過去24時間の実際の気圧の動き。points=[{ts, pressure}]（ts昇順、実測が望ましい）。足りなければ null を返す項目あり。 */
export function pastInfo(points, now) {
  const pts = points.filter((p) => p.pressure != null && p.ts <= now);
  if (pts.length < 3) return null;
  const near = (ts, tol) => { let b = null; for (const p of pts) if (Math.abs(p.ts - ts) <= tol && (!b || Math.abs(p.ts - ts) < Math.abs(b.ts - ts))) b = p; return b; };
  const cur = pts[pts.length - 1];
  if (now - cur.ts > 3 * 3600e3) return null;
  const a24 = near(cur.ts - 24 * 3600e3, 2.5 * 3600e3);
  const a12 = near(cur.ts - 12 * 3600e3, 2.5 * 3600e3);
  // 毎時の最大の低下(隣り合う点の間隔が45分〜1.5時間のとき)
  let maxDrop = null;
  for (let i = 1; i < pts.length; i++) {
    const dh = (pts[i].ts - pts[i - 1].ts) / 3600e3;
    if (pts[i].ts < cur.ts - 24 * 3600e3 || dh < 0.75 || dh > 1.5) continue;
    const r = (pts[i].pressure - pts[i - 1].pressure) / dh;
    if (maxDrop == null || r < maxDrop) maxDrop = r;
  }
  return { cur: r1(cur.pressure), d24: a24 ? r1(cur.pressure - a24.pressure) : null, d12: a12 ? r1(cur.pressure - a12.pressure) : null, maxDrop: maxDrop == null ? null : r1(maxDrop) };
}
// 合計点(気になる要因の多さ) → 体調レベル。5が「気候が快調」、1が「体調不良に注意」(数字が大きいほど快調)。
export const MOOD_LEVELS = [
  { level: 5, key: 'great', st: '気候が快調', label: '気候が快調', max: 1, desc: '体調への影響は、ほぼなさそうです。活動にも向いた日です。', short: '活動にも向いた日' },
  { level: 4, key: 'good', st: 'おおむね良好', label: 'おおむね良好', max: 3, desc: '体調への影響は、小さそうです。ふだん通りに過ごせます。', short: 'ふだん通りに過ごせる' },
  { level: 3, key: 'tired', st: 'やや不安定', label: 'やや不安定', max: 5, desc: '気候の変化で、少し疲れやすいかもしれません。休憩をはさんで過ごしましょう。', short: '休憩をはさんで過ごそう' },
  { level: 2, key: 'care', st: '影響しそう', label: '体調に影響しそう', max: 8, desc: '体調を崩しやすい要因があります。無理せず、しっかり休みましょう。', short: '無理せずしっかり休もう' },
  { level: 1, key: 'bad', st: '不調に注意', label: '体調不良に注意', max: Infinity, desc: '体調不良を引き起こしそうなので注意。早めに静養し、いつもの薬を確認しましょう。', short: '早めに静養を' },
];
export const moodScore = (points) => 100 - Math.round((points / MOOD_MAX) * 100); // 高いほど快調

export function moodInfo({ pressureLevel = 'none', temp, rain, hum, next24, past }) {
  const f = factorSummary({ pressureLevel, temp, rain, hum, past });
  const parts = {
    pressure: MOOD_POINTS.pressure[pressureLevel] ?? 0,
    temp: MOOD_POINTS.temp[temp?.level] ?? 0,
    rain: MOOD_POINTS.rain[rain?.level] ?? 0,
    hum: MOOD_POINTS.hum[hum?.level] ?? 0,
    past: (() => { const d = past?.d24; const a = d == null ? 0 : (MOOD_POINTS.past24.find(([lim]) => d <= lim)?.[1] ?? 0); const c = past?.cur; const b = c == null ? 0 : (MOOD_POINTS.lowPressure.find(([lim]) => c < lim)?.[1] ?? 0); return a + b; })(),
  };
  let points = parts.pressure + parts.temp + parts.rain + parts.hum + parts.past;
  const bonus = f.count >= MOOD_POINTS.overlapFrom ? MOOD_POINTS.overlapBonus : 0;
  points += bonus;
  const lv = MOOD_LEVELS.find((l) => points <= l.max);
  const names = f.names;
  const reason = !names.length
    ? '気になる要因は見られません。おだやかな一日になりそうです。'
    : names.length === 1 ? `「${names[0]}」が気になります。`
      : `「${names.join('」と「')}」が重なっています。`;
  const worst = next24 && next24.level !== 'none' && next24.at ? { at: next24.at, rate: next24.rate } : null;
  return { care: careFor(lv.level, f.factors), desc: lv.desc, short: lv.short, points, max: MOOD_MAX, score: moodScore(points), level: lv.level, key: lv.key, label: lv.label, reason, factors: f.factors, parts, bonus, worst };
}
