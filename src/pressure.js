// 気圧変化量の算出と4段階判定（仕様 3. 気圧変動アラート）
export const HOUR = 3600e3;
export const JST = 9 * HOUR;

export const LEVEL_LABEL = {
  none: '安定',
  rise: '上昇注意',
  slight: 'やや注意',
  caution: '注意',
  warning: '警戒',
};

// 低下側の重さ（通知判定・最大値の比較用）。上昇注意は別系統なので0扱い。
export const SEVERITY = { none: 0, rise: 0, slight: 1, caution: 2, warning: 3 };

// レベルごとの一言コメント（明日カード等の表示用）。
// レベル定義と同じこのモジュールで持ち、各ページ（サーバー描画・/api/week経由のクライアント描画）で文言がずれないようにする。
export const LEVEL_COMMENT = {
  warning: '大きく下がります。早めの休息と備えを',
  caution: '下がり幅が目立ちます。無理のない予定に',
  slight: '少し下がります。様子を見ながら',
  rise: '上がった後の反動に注意',
  none: '大きな変化は見込まれていません',
};

/** 1時間あたりの変化量(hPa/h) → レベル */
export function levelOf(rate) {
  if (rate == null || Number.isNaN(rate)) return 'none';
  if (rate >= 1.0) return 'rise';
  if (rate <= -1.5) return 'warning';
  if (rate <= -1.0) return 'caution';
  if (rate <= -0.5) return 'slight';
  return 'none';
}

/** 点列(ts昇順)に rate/level を付与。6時間超の欠測をまたぐ区間と、45分未満の近すぎる区間(整数hPaを短時間で割ると極端な値になる)は評価しない。 */
export const MIN_GAP_H = 0.75;
export function annotate(points) {
  return points.map((p, i) => {
    if (i === 0) return { ...p, rate: null, level: 'none' };
    const q = points[i - 1];
    const dh = (p.ts - q.ts) / HOUR;
    if (dh < MIN_GAP_H || dh > 6 || p.pressure == null || q.pressure == null) return { ...p, rate: null, level: 'none' };
    const rate = (p.pressure - q.pressure) / dh;
    return { ...p, rate: Math.round(rate * 100) / 100, level: levelOf(rate) };
  });
}

/** 区間内の最悪の低下レベルと最大下降区間 */
export function worstDrop(annotated) {
  let worst = null;
  for (const p of annotated) {
    if (p.rate == null) continue;
    if (SEVERITY[p.level] > 0 && (!worst || p.rate < worst.rate)) worst = p;
  }
  return worst;
}

export const jstDayStart = (ts) => Math.floor((ts + JST) / (24 * HOUR)) * 24 * HOUR - JST;
export const jstDateStr = (ts) => new Date(ts + JST).toISOString().slice(0, 10);
export const jstHour = (ts) => new Date(ts + JST).getUTCHours();

/** 線形補間。前後の点が maxGapH 以内にある場合のみ値を返す。 */
export function interpolate(points, ts, maxGapH = 4) {
  if (!points.length) return null;
  let lo = 0;
  let hi = points.length - 1;
  if (ts < points[0].ts || ts > points[hi].ts) return null;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid].ts <= ts) lo = mid;
    else hi = mid;
  }
  const a = points[lo];
  const b = points[hi];
  if (a.ts === ts) return a.pressure;
  if (b.ts === ts) return b.pressure;
  if ((b.ts - a.ts) / HOUR > maxGapH * 2) return null;
  const f = (ts - a.ts) / (b.ts - a.ts);
  return a.pressure + (b.pressure - a.pressure) * f;
}
