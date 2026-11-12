// 週間天気: 気象庁の週間予報（天気・降水確率・気温）に、OpenWeatherMapの気圧予報から求めた
// 「その日の気圧の最低値・最大の下がり方（4段階）」を重ねて返す。
import { all, get } from './db.js';
import { AREA_BY_CODE } from './areas.js';
import { annotate, worstDrop, interpolate, SEVERITY, LEVEL_LABEL, HOUR, jstDateStr, jstDayStart } from './pressure.js';
import { ensureFresh, isDemo } from './weather.js';
import { loadJmaCached } from './jma.js';
import { loadExtras, wetInfo, factorSummary } from './extras.js';
import { moodInfo } from './mood.js';

// 気象庁の天気コード(telop)の主なもの。無い場合は百の位(1晴/2曇/3雨/4雪)で代用する。
const CODE_TEXT = {
  100: '晴れ', 101: '晴れ時々くもり', 102: '晴れ一時雨', 103: '晴れ時々雨', 104: '晴れ一時雪', 105: '晴れ時々雪', 106: '晴れ一時雨か雪', 107: '晴れ時々雨か雪', 108: '晴れ一時雨か雷雨',
  110: '晴れのち時々くもり', 111: '晴れのちくもり', 112: '晴れのち一時雨', 113: '晴れのち時々雨', 114: '晴れのち雨', 115: '晴れのち一時雪', 116: '晴れのち時々雪', 117: '晴れのち雪', 118: '晴れのち雨か雪', 119: '晴れのち雨か雷雨',
  120: '晴れ朝夕一時雨', 121: '晴れ朝の内一時雨', 122: '晴れ夕方一時雨', 123: '晴れ山沿い雷雨', 124: '晴れ山沿い雪', 125: '晴れ午後は雷雨', 126: '晴れ昼頃から雨', 127: '晴れ夕方から雨', 128: '晴れ夜は雨', 140: '晴れ時々雨で雷を伴う',
  200: 'くもり', 201: 'くもり時々晴れ', 202: 'くもり一時雨', 203: 'くもり時々雨', 204: 'くもり一時雪', 205: 'くもり時々雪', 206: 'くもり一時雨か雪', 207: 'くもり時々雨か雪', 208: 'くもり一時雨か雷雨', 209: '霧',
  210: 'くもりのち時々晴れ', 211: 'くもりのち晴れ', 212: 'くもりのち一時雨', 213: 'くもりのち時々雨', 214: 'くもりのち雨', 215: 'くもりのち一時雪', 216: 'くもりのち時々雪', 217: 'くもりのち雪', 218: 'くもりのち雨か雪', 219: 'くもりのち雨か雷雨',
  220: 'くもり朝夕一時雨', 221: 'くもり朝の内一時雨', 222: 'くもり夕方一時雨', 223: 'くもり日中時々晴れ', 224: 'くもり昼頃から雨', 225: 'くもり夕方から雨', 226: 'くもり夜は雨', 240: 'くもり時々雨で雷を伴う',
  300: '雨', 301: '雨時々晴れ', 302: '雨時々止む', 303: '雨時々雪', 304: '雨か雪', 306: '大雨', 308: '雨で暴風を伴う', 309: '雨一時雪', 311: '雨のち晴れ', 313: '雨のちくもり', 314: '雨のち時々雪', 315: '雨のち雪',
  320: '朝の内雨のち晴れ', 321: '朝の内雨のちくもり', 323: '雨昼頃から晴れ', 324: '雨夕方から晴れ', 325: '雨夜は晴れ', 328: '雨一時強く降る', 329: '雨一時みぞれ', 340: '雪か雨', 350: '雨で雷を伴う',
  400: '雪', 401: '雪時々晴れ', 402: '雪時々止む', 403: '雪時々雨', 405: '大雪', 406: '風雪強い', 407: '暴風雪', 409: '雪一時雨', 411: '雪のち晴れ', 413: '雪のちくもり', 414: '雪のち雨',
};
const CATEGORY = { 1: '晴れ', 2: 'くもり', 3: '雨', 4: '雪' };

/** 気象庁の天気コード → {text, icon(絵文字・互換用), key(public/wx.js の線画アイコンのキー)}。未知のコードでも百の位から推定する。 */
export function weatherInfo(code) {
  const c = Number(code);
  if (!Number.isFinite(c) || c < 100) return { text: '', icon: '·', key: null };
  const major = Math.floor(c / 100);
  const text = CODE_TEXT[c] || CATEGORY[major] || '';
  let icon;
  if (/雷/.test(text)) icon = '⛈️';
  else if (/雨か雪|雪か雨|みぞれ/.test(text)) icon = '🌨️';
  else if (major === 4 || (/雪/.test(text) && !/雨/.test(text))) icon = '❄️';
  else if (/雨/.test(text)) icon = major <= 2 ? '🌦️' : '🌧️';
  else if (major === 1) icon = /くもり/.test(text) ? '⛅' : '☀️';
  else if (major === 2) icon = /晴れ/.test(text) ? '⛅' : '☁️';
  else icon = '☁️';
  if (c === 209) icon = '🌫️';
  let key;
  if (c === 209) key = 'fog';
  else if (/雷/.test(text)) key = 'thunder';
  else if (/雨か雪|雪か雨|みぞれ/.test(text)) key = 'sleet';
  else if (major === 4 || (/雪/.test(text) && !/雨/.test(text))) key = 'snow';
  else if (/雨/.test(text)) key = major === 1 ? 'rain-sun' : 'rain';
  else if (major === 1) key = /くもり/.test(text) ? 'cloud-sun' : 'sun';
  else if (major === 2) key = /晴れ/.test(text) ? 'cloud-sun' : 'cloud';
  else key = 'cloud';
  return { text, icon, key };
}

const OWM_ICON = { '01': '☀️', '02': '⛅', '03': '☁️', '04': '☁️', '09': '🌧️', '10': '🌦️', '11': '⛈️', '13': '❄️', '50': '🌫️' };
const owmIcon = (c) => OWM_ICON[(c || '').slice(0, 2)] || '·';
const OWM_KEY = { '01d': 'sun', '01n': 'moon', '02d': 'cloud-sun', '02n': 'cloud-moon', '03': 'cloud', '04': 'cloud', '09': 'rain', '10d': 'rain-sun', '10n': 'rain-moon', '11': 'thunder', '13': 'snow', '50': 'fog' };
export const owmKey = (c) => OWM_KEY[c] || OWM_KEY[(c || '').slice(0, 2)] || 'cloud';

/**
 * 気圧の点列(ts昇順, annotate済み)を日本時間の日付ごとに集計する。
 * 戻り値: { 'YYYY-MM-DD': { min, max, tmin, tmax, level, rate, at, icon } }
 * level は、その日の最大の「低下」の段階（低下が無く急上昇があれば rise、無ければ none）。
 */
export function dailyPressure(points) {
  const days = {};
  for (const p of points) (days[jstDateStr(p.ts)] ||= []).push(p);
  const out = {};
  for (const [date, pts] of Object.entries(days)) {
    const pr = pts.filter((p) => p.pressure != null);
    if (!pr.length) continue;
    const drop = worstDrop(pts);
    const rise = pts.filter((p) => p.level === 'rise').sort((a, b) => b.rate - a.rate)[0];
    const temps = pts.map((p) => p.temp).filter((t) => t != null);
    const noon = pts.reduce((best, p) => (Math.abs(new Date(p.ts + 9 * HOUR).getUTCHours() - 12) < Math.abs(new Date(best.ts + 9 * HOUR).getUTCHours() - 12) ? p : best), pts[0]);
    out[date] = {
      min: Math.round(Math.min(...pr.map((p) => p.pressure)) * 10) / 10,
      max: Math.round(Math.max(...pr.map((p) => p.pressure)) * 10) / 10,
      tmin: temps.length ? Math.round(Math.min(...temps)) : null,
      tmax: temps.length ? Math.round(Math.max(...temps)) : null,
      level: drop ? drop.level : rise ? 'rise' : 'none',
      rate: drop ? drop.rate : rise ? rise.rate : null,
      at: drop ? drop.ts : rise ? rise.ts : null,
      icon: owmIcon(noon.icon),
      key: owmKey(noon.icon),
      partial: pts.length < 6, // 3時間おき8点のうち6点未満=一部の時間帯のみ
    };
  }
  return out;
}

const addDays = (dateStr, n) => jstDateStr(Date.parse(dateStr + 'T00:00:00+09:00') + n * 24 * HOUR);
const DOW = ['日', '月', '火', '水', '木', '金', '土'];

/** 気象庁の予報(短期+週間)と気圧の日別集計を日付で突き合わせ、今日から7日分を返す。 */
// ---- 気温の変化(表示専用の暫定の目安。医学的な基準ではない) ----
// 前日の同時刻との差(d24)と、今後24時間の最高・最低の差(range)で、「気温差」の大きさを3段階に分ける。
export const TEMP_LABEL = { none: '変化は小さめ', mid: '気温差あり', big: '気温差 大' };
export const TEMP_RULE = { midD24: 5, bigD24: 8, midRange: 9, bigRange: 12 };
const r1 = (x) => Math.round(x * 10) / 10;

/** rows: [{ts, temp}]（ts昇順）。気温データが足りなければ null。 */
export function tempInfo(rows, now) {
  const pts = rows.filter((r) => r.temp != null).map((r) => ({ ts: r.ts, pressure: r.temp })); // interpolate は pressure を値として扱う
  const cur = interpolate(pts, now);
  if (cur == null) return null;
  const ago = interpolate(pts, now - 24 * HOUR);
  const next = pts.filter((p) => p.ts > now && p.ts <= now + 24 * HOUR).map((p) => p.pressure);
  next.push(cur);
  const min = Math.min(...next);
  const max = Math.max(...next);
  const d24 = ago == null ? null : cur - ago;
  const range = max - min;
  const a = d24 == null ? 0 : Math.abs(d24);
  const level = a >= TEMP_RULE.bigD24 || range >= TEMP_RULE.bigRange ? 'big' : a >= TEMP_RULE.midD24 || range >= TEMP_RULE.midRange ? 'mid' : 'none';
  return { now: r1(cur), d24: d24 == null ? null : r1(d24), min: r1(min), max: r1(max), range: r1(range), level, label: TEMP_LABEL[level] };
}

export function mergeWeek({ today, jma, pressure }) {
  const short = Object.fromEntries((jma?.days ?? []).map((d) => [d.date, d]));
  const week = Object.fromEntries((jma?.week ?? []).map((d) => [d.date, d]));
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i);
    const w = week[date];
    const s = short[date];
    const p = pressure[date];
    const code = w?.code || s?.code || null;
    const info = code ? weatherInfo(code) : { text: s?.weather || '', icon: p?.icon || '·', key: p?.key || null };
    const dow = DOW[new Date(date + 'T00:00:00Z').getUTCDay()];
    return {
      date,
      dow,
      label: i === 0 ? '今日' : i === 1 ? '明日' : `${Number(date.slice(5, 7))}/${Number(date.slice(8))}`,
      text: info.text || s?.weather || '',
      icon: info.icon,
      key: info.key,
      pop: w?.pop ?? s?.pop ?? null,
      tmax: w?.tmax ?? p?.tmax ?? null,
      tmin: w?.tmin ?? p?.tmin ?? null,
      reliability: w?.reliability || '',
      source: code ? 'jma' : p ? 'owm' : 'none',
      pressure: p ? { min: p.min, max: p.max, level: p.level, label: LEVEL_LABEL[p.level], rate: p.rate, at: p.at, partial: p.partial } : null,
    };
  });
  // 前日比（最高・最低気温）。前日の値が無い日(今日)は null
  return days.map((d, i) => ({
    ...d,
    dtmax: i > 0 && d.tmax != null && days[i - 1].tmax != null ? Math.round(d.tmax - days[i - 1].tmax) : null,
    dtmin: i > 0 && d.tmin != null && days[i - 1].tmin != null ? Math.round(d.tmin - days[i - 1].tmin) : null,
  }));
}

/** /api/week の本体 */
export async function buildWeek(env, code, now = Date.now()) {
  await ensureFresh(env, code);
  const [rows, jma] = await Promise.all([
    all(env.DB, `SELECT ts,temp,pressure,icon,source FROM points WHERE area_code=? AND source IN ('owm','demo') AND ts BETWEEN ? AND ? ORDER BY ts`, code, now - 30 * HOUR, now + 7 * 24 * HOUR),
    loadJmaCached(env, code),
  ]);
  const ann = annotate(rows.filter((r) => r.pressure != null));
  const today = jstDateStr(now);
  const dayStart = jstDayStart(now);
  const days = mergeWeek({ today, jma, pressure: dailyPressure(ann.filter((p) => p.ts >= dayStart)) });

  const past = ann.filter((p) => p.ts <= now);
  const cur = past[past.length - 1] ?? ann[0] ?? null;
  const ago3 = cur ? [...ann].reverse().find((p) => p.ts <= cur.ts - 3 * HOUR) : null;
  const next = ann.filter((p) => p.ts > now && p.ts <= now + 24 * HOUR);
  const worst = worstDrop(next);
  const temp = tempInfo(rows, now);
  const wet = wetInfo(await loadExtras(env.DB, code), now);
  const fetchedAt = Number((await get(env.DB, 'SELECT v FROM meta WHERE k=?', 'fetched:' + code))?.v || 0) || null;
  return {
    area: { code, name: AREA_BY_CODE.get(code).name },
    now,
    demo: isDemo(env) || rows.some((r) => r.source === 'demo'),
    fetchedAt,
    jma: jma ? { office: jma.office, reported: jma.reported } : null,
    temp,
    rain: wet.rain,
    humidity: wet.hum,
    factors: factorSummary({ pressureLevel: worst ? worst.level : 'none', temp, rain: wet.rain, hum: wet.hum }),
    mood: moodInfo({ pressureLevel: worst ? worst.level : 'none', temp, rain: wet.rain, hum: wet.hum, next24: worst ? { level: worst.level, at: worst.ts, rate: worst.rate } : null }),
    current: cur ? { pressure: Math.round(cur.pressure * 10) / 10, d3: cur && ago3 ? Math.round((cur.pressure - ago3.pressure) * 10) / 10 : null } : null,
    next24: worst
      ? { level: worst.level, label: LEVEL_LABEL[worst.level], rate: worst.rate, at: worst.ts, severe: SEVERITY[worst.level] >= SEVERITY.caution }
      : { level: 'none', label: LEVEL_LABEL.none, rate: null, at: null, severe: false },
    hourly: ann.filter((p) => p.ts >= now - 3 * HOUR && p.ts <= now + 27 * HOUR).map((p) => ({ ts: p.ts, temp: p.temp, pressure: p.pressure, icon: owmIcon(p.icon), key: owmKey(p.icon), rate: p.rate, level: p.level })),
    days,
  };
}
