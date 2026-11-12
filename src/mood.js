// 「体調そらもよう」: 気圧・気温差・降水・湿度の4つを、5段階の体調レベル(5=とても元気 〜 1=体調が悪い)と点数(0〜100、高いほど元気)にまとめる。
// 表示専用の暫定のロジックで、医学的に検証された基準ではない。通知には使わない。
// 重み: 気圧は体調との関係の報告が最も多いと考え、他の要因より大きくしている。
import { factorSummary } from './extras.js';

export const MOOD_POINTS = {
  pressure: { none: 0, rise: 1, slight: 2, caution: 4, warning: 6 },
  temp: { none: 0, mid: 1, big: 2 },
  rain: { none: 0, small: 0, mid: 1, big: 2 },
  hum: { none: 0, mid: 1, big: 2 },
  overlapBonus: 1, // 気になる要因が3つ以上重なったときの加点
  overlapFrom: 3,
};
export const MOOD_MAX = 6 + 2 + 2 + 2 + 1; // 13
// 合計点(気になる要因の多さ) → 体調レベル。5が「とても元気」、1が「体調が悪い」(数字が大きいほど元気)。
export const MOOD_LEVELS = [
  { level: 5, key: 'great', label: 'とても元気', max: 1, desc: '活動に最適なコンディションの見込みです。', short: '活動に最適なコンディション' },
  { level: 4, key: 'good', label: '元気', max: 3, desc: 'ふだん通りに過ごせそうです。', short: 'ふだん通りに過ごせる' },
  { level: 3, key: 'tired', label: 'やや疲れ気味', max: 5, desc: '少し休憩して、リフレッシュを。', short: '少し休憩してリフレッシュを' },
  { level: 2, key: 'care', label: '体調に注意', max: 8, desc: '無理せず、しっかり休みましょう。', short: '無理せずしっかり休もう' },
  { level: 1, key: 'bad', label: '体調が悪い', max: Infinity, desc: '早めに静養を。いつもの薬の確認も。', short: '早めに静養を' },
];
export const moodScore = (points) => 100 - Math.round((points / MOOD_MAX) * 100); // 高いほど元気

export function moodInfo({ pressureLevel = 'none', temp, rain, hum, next24 }) {
  const f = factorSummary({ pressureLevel, temp, rain, hum });
  const parts = {
    pressure: MOOD_POINTS.pressure[pressureLevel] ?? 0,
    temp: MOOD_POINTS.temp[temp?.level] ?? 0,
    rain: MOOD_POINTS.rain[rain?.level] ?? 0,
    hum: MOOD_POINTS.hum[hum?.level] ?? 0,
  };
  let points = parts.pressure + parts.temp + parts.rain + parts.hum;
  const bonus = f.count >= MOOD_POINTS.overlapFrom ? MOOD_POINTS.overlapBonus : 0;
  points += bonus;
  const lv = MOOD_LEVELS.find((l) => points <= l.max);
  const names = f.names;
  const reason = !names.length
    ? '気になる要因は見られません。おだやかな一日になりそうです。'
    : names.length === 1 ? `「${names[0]}」が気になります。`
      : `「${names.join('」と「')}」が重なっています。`;
  const worst = next24 && next24.level !== 'none' && next24.at ? { at: next24.at, rate: next24.rate } : null;
  return { desc: lv.desc, short: lv.short, points, max: MOOD_MAX, score: moodScore(points), level: lv.level, key: lv.key, label: lv.label, reason, factors: f.factors, parts, bonus, worst };
}
