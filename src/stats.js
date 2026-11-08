// 匿名統計データ生成バッチ。ユーザーID・個別ログは出力せず、都道府県ごとの人数のみを保存する。
import { db } from './db.js';
import { HOUR } from './pressure.js';

export const WINDOW_H = 6; // 「痛み」を記録したとみなす直近の時間
const ACTIVE_H = 24; // アクティブ = 直近24時間にアプリを利用
const PAIN_MIN = 2; // 痛みの度合い2以上を「不調」とカウント
export const MIN_K = Number(process.env.MIN_K || 5); // k-匿名性: 母数がこれ未満の地域は非表示

export function runStatsBatch(now = Date.now()) {
  const rows = db
    .prepare(
      `SELECT ua.area_code AS area_code,
              COUNT(DISTINCT u.id) AS active,
              COUNT(DISTINCT CASE WHEN EXISTS (
                SELECT 1 FROM logs l WHERE l.user_id=u.id AND l.ts>=? AND l.ts<=? AND l.pain>=?
              ) THEN u.id END) AS pained
       FROM users u JOIN user_areas ua ON ua.user_id=u.id AND ua.pos=0
       WHERE u.last_seen>=?
       GROUP BY ua.area_code`,
    )
    .all(now - WINDOW_H * HOUR, now, PAIN_MIN, now - ACTIVE_H * HOUR);
  db.exec('DELETE FROM area_stats');
  const ins = db.prepare('INSERT INTO area_stats(area_code,active,pained,window_h,updated_at) VALUES(?,?,?,?,?)');
  rows.forEach((r) => ins.run(r.area_code, r.active, r.pained, WINDOW_H, now));
  console.log(`[stats] ${rows.length} areas`);
}

export function getAreaStats(areaCode) {
  const r = db.prepare('SELECT * FROM area_stats WHERE area_code=?').get(areaCode);
  if (!r || r.active < MIN_K) return { hidden: true, windowH: WINDOW_H };
  return {
    hidden: false,
    windowH: r.window_h,
    percent: Math.round((r.pained / r.active) * 100),
    updatedAt: r.updated_at,
  };
}
