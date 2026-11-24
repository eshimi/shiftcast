// 今日の気象病予報(デイリー記事)の保存と読み出し。D1 の meta テーブルに「daily:YYYY-MM-DD」で、その日の集計(todaySummary)を JSON で残す。
// 毎朝6時台(JST)の cron で確定版を保存する。保存前に /daily が開かれた場合は、その場で集計して保存する(6時以降のみ)。
import { all, getMeta, setMeta } from './db.js';
import { todaySummary } from './today.js';

export const DAILY_HOUR = 6; // 朝刊の確定時刻(JST)
export const jstDate = (ts) => new Date(ts + 9 * 3600e3).toISOString().slice(0, 10);
const jstH = (ts) => new Date(ts + 9 * 3600e3).getUTCHours();
const KEY = (d) => `daily:${d}`;
export const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');

export async function loadDaily(env, date) {
  const v = await getMeta(env.DB, KEY(date));
  try { return v ? JSON.parse(v) : null; } catch { return null; }
}

/** 今日の分が未保存なら集計して保存する(6時前は保存せず、その時点の集計を返す) */
export async function ensureDaily(env, now = Date.now()) {
  const date = jstDate(now);
  const saved = await loadDaily(env, date);
  if (saved) return { date, sum: saved, saved: true };
  const sum = await todaySummary(env, now);
  const okRows = sum.rows.filter((r) => r.mood).length;
  if (jstH(now) >= DAILY_HOUR && okRows >= 5) { await setMeta(env.DB, KEY(date), JSON.stringify(sum)); return { date, sum, saved: true }; }
  return { date, sum, saved: false };
}

/** 保存済みの日付(新しい順) */
export async function dailyDates(env, limit = 400) {
  const rows = await all(env.DB, "SELECT k FROM meta WHERE k LIKE 'daily:%' ORDER BY k DESC LIMIT ?", limit);
  return rows.map((r) => r.k.slice(6)).filter(isDate);
}

/** cron: 6時台に1回、今日の分を確定保存 */
export async function runDailyBatch(env, now = Date.now()) {
  if (jstH(now) !== DAILY_HOUR) return;
  const r = await ensureDaily(env, now);
  console.log(`[daily] ${r.date} saved=${r.saved}`);
}
