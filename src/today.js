// 今日の気圧まとめ(/today): 各地方の代表都市の「現在の気圧」と「今後24時間の変化」をD1から集計する。
// 取得はCron(EXTRA_AREAS)に任せ、古いデータのときだけ ensureFresh で補う。
import { all } from './db.js';
import { AREA_BY_CODE } from './areas.js';
import { annotate, worstDrop, LEVEL_LABEL, SEVERITY, HOUR } from './pressure.js';
import { ensureFresh } from './weather.js';
import { buildWeek } from './week.js';

// 北海道・東北・関東・中部・近畿・中国・九州・沖縄の代表(道府県庁所在地)
export const TODAY_AREAS = [['北海道', '01'], ['東北', '04'], ['関東', '13'], ['中部', '23'], ['近畿', '27'], ['中国', '34'], ['四国', '38'], ['九州', '40'], ['沖縄', '47']];

// 47都道府県のタイル地図の色は、その都道府県が属する地方の代表都市の体調そらもようを使う(全県を毎回取得すると、無料枠の取得回数を超えるため)
export function repCodeOf(code) {
  const n = Number(code);
  if (n === 1) return '01';
  if (n <= 7) return '04';
  if (n <= 14) return '13';
  if (n <= 23) return '23';
  if (n <= 30) return '27';
  if (n <= 35) return '34';
  if (n <= 39) return '38';
  if (n <= 46) return '40';
  return '47';
}

export async function todaySummary(env, now = Date.now()) {
  const rows = await Promise.all(TODAY_AREAS.map(async ([region, code]) => {
    await ensureFresh(env, code);
    let mood = null;
    try { mood = (await buildWeek(env, code, now)).mood; } catch (e) { console.error('[today:mood]', code, e.message); }
    const pts = await all(env.DB, `SELECT ts,pressure FROM points WHERE area_code=? AND source IN ('owm','demo') AND ts BETWEEN ? AND ? AND pressure IS NOT NULL ORDER BY ts`, code, now - 6 * HOUR, now + 27 * HOUR);
    if (!pts.length) return { region, code, name: AREA_BY_CODE.get(code).name, ok: false, mood };
    const ann = annotate(pts);
    const past = ann.filter((p) => p.ts <= now);
    const cur = past[past.length - 1] ?? ann[0];
    const worst = worstDrop(ann.filter((p) => p.ts > now && p.ts <= now + 24 * HOUR));
    return {
      region, code, name: AREA_BY_CODE.get(code).name, ok: true, mood: mood ? { level: mood.level, label: mood.label, score: mood.score } : null,
      pressure: Math.round(cur.pressure * 10) / 10,
      level: worst ? worst.level : 'none', label: LEVEL_LABEL[worst ? worst.level : 'none'],
      rate: worst ? worst.rate : null, at: worst ? worst.ts : null, severity: worst ? SEVERITY[worst.level] : 0,
    };
  }));
  return { now, rows };
}
