// 「体調そらもよう」: 気圧・気温差・降水・湿度の4つを1つの空模様(5段階)と点数(0〜100)にまとめる。
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
// 合計点 → 段階(上限の点数)
export const MOOD_LEVELS = [
  { level: 1, key: 'sunny', label: '晴れ', name: 'おだやか', max: 1 },
  { level: 2, key: 'partly', label: '晴れ時々くもり', name: '少し気にかけて', max: 3 },
  { level: 3, key: 'cloudy', label: 'くもり', name: '注意', max: 5 },
  { level: 4, key: 'rainy', label: '雨', name: '要注意', max: 8 },
  { level: 5, key: 'stormy', label: '雷', name: '警戒', max: Infinity },
];

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
  const advice = lv.level >= 4 ? '早めの休息と、いつもの薬の確認を。' : lv.level === 3 ? '無理のない予定で、こまめに休みましょう。' : '';
  const worst = next24 && next24.level !== 'none' && next24.at ? { at: next24.at, rate: next24.rate } : null;
  return { points, max: MOOD_MAX, score: Math.round((points / MOOD_MAX) * 100), level: lv.level, key: lv.key, label: lv.label, name: lv.name, reason, advice, factors: f.factors, parts, bonus, worst };
}
