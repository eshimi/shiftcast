import test from 'node:test';
import assert from 'node:assert/strict';
import { weatherInfo, dailyPressure, mergeWeek, tempInfo } from '../src/week.js';
import { wetInfo, factorSummary } from '../src/extras.js';
import { moodInfo, MOOD_MAX } from '../src/mood.js';
import { summarizeWeekly } from '../src/jma.js';
import { annotate } from '../src/pressure.js';

const H = 3600e3;
const JST = 9 * H;
const at = (date, hh) => Date.parse(`${date}T00:00:00+09:00`) + hh * H;

test('weatherInfo: 既知コードと未知コード', () => {
  assert.deepEqual(weatherInfo('100'), { text: '晴れ', icon: '☀️', key: 'sun' });
  assert.equal(weatherInfo('101').key, 'cloud-sun');
  assert.equal(weatherInfo('102').key, 'rain-sun');
  assert.equal(weatherInfo('200').key, 'cloud');
  assert.equal(weatherInfo('202').key, 'rain');
  assert.equal(weatherInfo('209').key, 'fog');
  assert.equal(weatherInfo('140').key, 'thunder');
  assert.equal(weatherInfo('400').key, 'snow');
  assert.equal(weatherInfo('304').key, 'sleet');
  assert.equal(weatherInfo('202').icon, '🌦️');
  assert.equal(weatherInfo('300').icon, '🌧️');
  assert.equal(weatherInfo('140').icon, '⛈️');
  assert.equal(weatherInfo('400').icon, '❄️');
  assert.equal(weatherInfo('999').text, ''); // 範囲外は空
  assert.equal(weatherInfo('117').text, '晴れのち雪');
  assert.equal(weatherInfo('').icon, '·');
  assert.equal(weatherInfo('').key, null);
});

test('summarizeWeekly: 週間予報の要約（空文字は null）', () => {
  const data = [{}, { timeSeries: [
    { timeDefines: ['2026-11-10T00:00:00+09:00', '2026-11-11T00:00:00+09:00'], areas: [{ weatherCodes: ['202', '100'], pops: ['', '10'], reliabilities: ['', 'A'] }] },
    { timeDefines: ['2026-11-10T00:00:00+09:00', '2026-11-11T00:00:00+09:00'], areas: [{ tempsMin: ['', '7'], tempsMax: ['', '17'] }] },
  ] }];
  assert.deepEqual(summarizeWeekly(data), [
    { date: '2026-11-10', code: '202', pop: null, reliability: '', tmin: null, tmax: null },
    { date: '2026-11-11', code: '100', pop: 10, reliability: 'A', tmin: 7, tmax: 17 },
  ]);
  assert.deepEqual(summarizeWeekly(null), []);
});

test('dailyPressure: 日本時間の日付でまとめ、最大の低下の段階を返す', () => {
  // 11/10 は 18時に1013 → 21時に1008 (-1.67hPa/h = 警戒)
  const pts = annotate([
    { ts: at('2026-11-10', 12), pressure: 1014, temp: 15, icon: '01d' },
    { ts: at('2026-11-10', 15), pressure: 1013, temp: 17, icon: '01d' },
    { ts: at('2026-11-10', 18), pressure: 1013, temp: 13, icon: '01n' },
    { ts: at('2026-11-10', 21), pressure: 1008, temp: 11, icon: '01n' },
    { ts: at('2026-11-11', 0), pressure: 1007.5, temp: 10, icon: '01n' },
  ]);
  const d = dailyPressure(pts);
  assert.equal(d['2026-11-10'].level, 'warning');
  assert.equal(d['2026-11-10'].min, 1008);
  assert.equal(d['2026-11-10'].max, 1014);
  assert.equal(d['2026-11-10'].tmax, 17);
  assert.equal(jstDate(d['2026-11-10'].at), '2026-11-10');
  assert.equal(d['2026-11-11'].level, 'none');
});
const jstDate = (ts) => new Date(ts + JST).toISOString().slice(0, 10);

test('mergeWeek: 今日は気象庁に無くても気圧側で埋め、7日分を返す', () => {
  const jma = {
    days: [{ date: '2026-11-10', code: '311', weather: '雨のち晴れ', pop: 70 }],
    week: [{ date: '2026-11-10', code: '202', pop: null, reliability: '', tmin: null, tmax: null }, { date: '2026-11-11', code: '100', pop: 10, reliability: 'A', tmin: 7, tmax: 17 }],
  };
  const pressure = { '2026-11-09': { min: 1010, max: 1015, tmin: 9, tmax: 19, level: 'slight', rate: -0.6, at: 1, icon: '⛅', partial: false } };
  const w = mergeWeek({ today: '2026-11-09', jma, pressure });
  assert.equal(w.length, 7);
  assert.equal(w[0].source, 'owm');
  assert.equal(w[0].tmax, 19);
  assert.equal(w[0].label, '今日');
  assert.equal(w[0].pressure.label, 'やや注意');
  assert.equal(w[1].source, 'jma');
  assert.equal(w[1].text, 'くもり一時雨');
  assert.equal(w[2].tmax, 17);
  assert.equal(w[2].dow, '水');
  assert.equal(w[6].source, 'none');
});

test('tempInfo: 前日同時刻比と今後24時間の差から気温差の段階を出す', () => {
  const now = at('2026-11-10', 12);
  const row = (h, temp) => ({ ts: now + h * H, temp });
  // 24時間前 18℃ → 現在 10℃(−8℃)、今後24時間は 10〜12℃
  const rows = [row(-24, 18), row(-12, 14), row(0, 10), row(6, 11), row(12, 10), row(24, 12)];
  const t = tempInfo(rows, now);
  assert.equal(t.now, 10);
  assert.equal(t.d24, -8);
  assert.equal(t.range, 2);
  assert.equal(t.level, 'big');
  // 変化が小さい
  const small = tempInfo([row(-24, 11), row(0, 12), row(12, 13), row(24, 12)], now);
  assert.equal(small.level, 'none');
  assert.equal(small.d24, 1);
  // 前日のデータが無ければ d24 は null、日較差だけで判定
  const noAgo = tempInfo([row(0, 8), row(12, 20), row(24, 9)], now);
  assert.equal(noAgo.d24, null);
  assert.equal(noAgo.level, 'big');
  assert.equal(tempInfo([], now), null);
});

test('mergeWeek: 最高・最低気温の前日比', () => {
  const days = mergeWeek({
    today: '2026-11-10',
    jma: { days: [], week: [{ date: '2026-11-10', code: '100', tmax: 20, tmin: 10 }, { date: '2026-11-11', code: '100', tmax: 15, tmin: 11 }] },
    pressure: {},
  });
  assert.equal(days[0].dtmax, null);
  assert.equal(days[1].dtmax, -5);
  assert.equal(days[1].dtmin, 1);
});

test('wetInfo: 直近24時間の降水・今後の予測・湿度', () => {
  const now = at('2026-11-10', 12);
  const obs = [{ ts: now - 24 * H, r1: 0, r24: 2, h: 60 }, { ts: now, r1: 1.5, r24: 12, h: 82 }];
  const fc = [{ ts: now + 3 * H, r3: 6, h: 88, pop: 0.8 }, { ts: now + 6 * H, r3: 5, h: 90, pop: 0.9 }, { ts: now + 27 * H, r3: 50, h: 50, pop: 1 }];
  const { rain, hum } = wetInfo({ obs, fc }, now);
  assert.equal(rain.past24, 12);
  assert.equal(rain.prev24, 2);
  assert.equal(rain.next24, 11); // 24時間を超える予報は含めない
  assert.equal(rain.popMax, 90);
  assert.equal(rain.level, 'mid');
  assert.equal(hum.now, 82);
  assert.equal(hum.d24, 22);
  assert.equal(hum.max, 90);
  assert.equal(hum.level, 'big');
  // データが無ければ null
  const none = wetInfo({ obs: [], fc: [] }, now);
  assert.equal(none.rain, null);
  assert.equal(none.hum, null);
});

test('factorSummary: 気になる要因を文章にする', () => {
  assert.equal(factorSummary({ pressureLevel: 'none', temp: { level: 'none' }, rain: { level: 'small' }, hum: { level: 'none' } }).count, 0);
  const one = factorSummary({ pressureLevel: 'caution', temp: null, rain: null, hum: null });
  assert.equal(one.count, 1);
  assert.match(one.text, /気圧の大きな低下/);
  const many = factorSummary({ pressureLevel: 'warning', temp: { level: 'big' }, rain: { level: 'mid' }, hum: { level: 'mid' } });
  assert.equal(many.count, 4);
  assert.match(many.text, /重なる/);
});

test('moodInfo: 4つの指標を5段階の体調レベル(5=気候が快調〜1=体調不良に注意)と0〜100の点数(高いほど快調)にまとめる', () => {
  const calm = moodInfo({ pressureLevel: 'none', temp: { level: 'none' }, rain: { level: 'small' }, hum: { level: 'none' } });
  assert.equal(calm.level, 5);
  assert.equal(calm.label, '気候が快調');
  assert.equal(calm.score, 100);
  assert.match(calm.reason, /気になる要因は見られません/);
  // 気圧 やや注意(2) + 気温差あり(1) = 3点 → 4 おおむね良好
  const m2 = moodInfo({ pressureLevel: 'slight', temp: { level: 'mid' }, rain: null, hum: null });
  assert.equal(m2.points, 3);
  assert.equal(m2.level, 4);
  assert.equal(m2.label, 'おおむね良好');
  // 気圧 注意(4) + 気温差大(2) = 6点 → 2 体調に影響しそう
  assert.equal(moodInfo({ pressureLevel: 'caution', temp: { level: 'big' }, rain: null, hum: null }).level, 2);
  // 全部重なる: 6+2+1+2 + 重なり補正1 = 12点 → 1 体調不良に注意 / スコアは 100 - 12/13
  const bad = moodInfo({ pressureLevel: 'warning', temp: { level: 'big' }, rain: { level: 'mid' }, hum: { level: 'big' } });
  assert.equal(bad.points, 12);
  assert.equal(bad.bonus, 1);
  assert.equal(bad.level, 1);
  assert.equal(bad.score, 100 - Math.round((12 / MOOD_MAX) * 100));
  assert.match(bad.reason, /重なっています/);
  // データが無い要素は 0 点として扱う
  assert.equal(moodInfo({ pressureLevel: 'none', temp: null, rain: null, hum: null }).level, 5);
});
