// 匿名統計データ生成。ユーザーID・個別ログは出力せず、都道府県ごとの人数のみ保存する。
import { all, get, batch, run } from './db.js';
import { HOUR } from './pressure.js';

export const WINDOW_H = 6; // 直近何時間の「痛み」記録を数えるか
const ACTIVE_H = 24; // アクティブ = 直近24時間にアプリ利用
const PAIN_MIN = 2; // 痛みの度合い2以上を「不調」とカウント
const minK = (env) => Number(env.MIN_K || 5); // k-匿名性: 母数がこれ未満の地域は非表示

export async function runStatsBatch(env, now = Date.now()) {
  const rows = await all(
    env.DB,
    `SELECT ua.area_code AS area_code,
            COUNT(DISTINCT u.id) AS active,
            COUNT(DISTINCT CASE WHEN EXISTS (
              SELECT 1 FROM logs l WHERE l.user_id=u.id AND l.ts>=?1 AND l.ts<=?2 AND l.pain>=?3
            ) THEN u.id END) AS pained
     FROM users u JOIN user_areas ua ON ua.user_id=u.id AND ua.pos=0
     WHERE u.last_seen>=?4 GROUP BY ua.area_code`,
    now - WINDOW_H * HOUR, now, PAIN_MIN, now - ACTIVE_H * HOUR,
  );
  await run(env.DB, 'DELETE FROM area_stats');
  await batch(env.DB, rows.map((r) => ['INSERT INTO area_stats(area_code,active,pained,window_h,updated_at) VALUES(?,?,?,?,?)', r.area_code, r.active, r.pained, WINDOW_H, now]));
  console.log(`[stats] ${rows.length} areas`);
}

export async function getAreaStats(env, areaCode) {
  const r = await get(env.DB, 'SELECT * FROM area_stats WHERE area_code=?', areaCode);
  if (!r || r.active < minK(env)) return { hidden: true, windowH: WINDOW_H };
  return { hidden: false, windowH: r.window_h, percent: Math.round((r.pained / r.active) * 100), updatedAt: r.updated_at };
}
