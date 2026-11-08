// 分析・インサイト: 痛み記録時点の気圧変動を、全期間の分布と比較して簡易レポートを生成する。
import { db } from './db.js';
import { HOUR, interpolate } from './pressure.js';

const PAIN_MIN = 3; // 「不調」とみなす痛みの度合い（5段階中）
const LOOKBACK_H = 3;
const MIN_EVENTS = 5;

export function pressureSeries(areaCode, from, to) {
  // 実績重視: 同一tsでは owm/demo を使用。jma(実況)は別系統で重ねて表示するだけにする
  return db
    .prepare(
      `SELECT ts, pressure FROM points WHERE area_code=? AND source IN ('owm','demo') AND ts BETWEEN ? AND ? AND pressure IS NOT NULL ORDER BY ts`,
    )
    .all(areaCode, from, to);
}

export function buildInsights(userId, now = Date.now()) {
  const logs = db.prepare('SELECT ts, pain, area_code FROM logs WHERE user_id=? AND ts<=? ORDER BY ts').all(userId, now);
  const out = { totalLogs: logs.length, events: 0, analyzed: 0, text: '', detail: null };
  const events = logs.filter((l) => l.pain >= PAIN_MIN && l.area_code);
  out.events = events.length;
  if (!events.length) {
    out.text = logs.length ? '「痛み3以上」の記録がまだありません。記録が増えると傾向を分析できます。' : '体調を記録すると、気圧との関係をここに表示します。';
    return out;
  }

  const cache = new Map();
  const seriesFor = (code) => {
    if (!cache.has(code)) cache.set(code, pressureSeries(code, 0, now));
    return cache.get(code);
  };

  // 不調時点での直前3時間の気圧変化
  const drops = [];
  for (const e of events) {
    const s = seriesFor(e.area_code);
    const p1 = interpolate(s, e.ts);
    const p0 = interpolate(s, e.ts - LOOKBACK_H * HOUR);
    if (p1 != null && p0 != null) drops.push(p1 - p0);
  }
  out.analyzed = drops.length;
  if (drops.length < MIN_EVENTS) {
    out.text = `気圧データと照合できた不調の記録が ${drops.length} 件です。${MIN_EVENTS} 件以上たまると傾向を分析します。`;
    return out;
  }

  // 比較対象: 記録期間中の全時刻(1時間刻み)での3時間変化の分布
  const code = events[events.length - 1].area_code;
  const s = seriesFor(code);
  const from = Math.min(...events.map((e) => e.ts));
  const to = Math.max(Date.now() > now ? now : now, from);
  const base = [];
  for (let t = from; t <= to; t += HOUR) {
    const p1 = interpolate(s, t);
    const p0 = interpolate(s, t - LOOKBACK_H * HOUR);
    if (p1 != null && p0 != null) base.push(p1 - p0);
  }
  const frac = (arr, thr) => (arr.length ? arr.filter((d) => d <= -thr).length / arr.length : 0);

  // 「不調時にX hPa以上下がっていた割合」が全期間の割合の1.3倍以上になる、最も大きいXを探す
  let best = null;
  for (const thr of [1, 2, 3, 4, 5, 6]) {
    const a = frac(drops, thr);
    const b = frac(base, thr);
    if (a >= 0.3 && b > 0 && a / b >= 1.3 && drops.filter((d) => d <= -thr).length >= 3) best = { thr, a, b };
  }
  const mean = (arr) => arr.reduce((x, y) => x + y, 0) / (arr.length || 1);
  out.detail = {
    meanDropAtEvents: round1(mean(drops)),
    meanDropBaseline: round1(mean(base)),
    threshold: best?.thr ?? null,
    shareAtEvents: best ? Math.round(best.a * 100) : null,
    shareBaseline: best ? Math.round(best.b * 100) : null,
  };
  if (best) {
    out.text =
      `気圧が3時間で ${best.thr}hPa 以上下がったタイミングで不調が起きやすい傾向があります。` +
      `不調を記録した ${drops.length} 件のうち ${Math.round(best.a * 100)}% が直前に ${best.thr}hPa 以上の低下でした` +
      `（記録期間全体では ${Math.round(best.b * 100)}%）。`;
  } else {
    out.text = `不調を記録した ${drops.length} 件を分析しましたが、気圧の低下との明確な関連は今のところ見られません（あくまで簡易的な統計です）。`;
  }
  return out;
}

const round1 = (x) => Math.round(x * 10) / 10;
