// 「体調そらもよう」: 気圧・気温差・降水・湿度の4つを、かおのアイコン(5段階)と点数(0〜100)にまとめる。
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
  { level: 1, key: 'calm', label: 'おだやか', name: 'おだやか', max: 1, desc: '体調に響きそうな要因は少ない日です。いつもどおり過ごせそうです。' },
  { level: 2, key: 'mild', label: '少し気にかけて', name: '少し気にかけて', max: 3, desc: '軽い要因があります。無理をしなければ大丈夫なことが多い日です。' },
  { level: 3, key: 'care', label: '注意', name: '注意', max: 5, desc: '体調に影響しそうな要因がいくつかあります。予定に余裕を持ち、こまめに休みましょう。' },
  { level: 4, key: 'alert', label: '要注意', name: '要注意', max: 8, desc: '強い要因、または複数の要因が重なっています。早めに休み、いつもの薬を確認しておきましょう。' },
  { level: 5, key: 'warn', label: '警戒', name: '警戒', max: Infinity, desc: '大きな気圧の低下や、複数の要因の重なりがあります。無理をせず、休息を最優先にしましょう。' },
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
  return { desc: lv.desc, points, max: MOOD_MAX, score: Math.round((points / MOOD_MAX) * 100), level: lv.level, key: lv.key, label: lv.label, name: lv.name, reason, advice, factors: f.factors, parts, bonus, worst };
}
