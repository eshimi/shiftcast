import test from 'node:test';
import assert from 'node:assert/strict';
import { weatherInfo, dailyPressure, mergeWeek } from '../src/week.js';
import { summarizeWeekly } from '../src/jma.js';
import { annotate } from '../src/pressure.js';

const H = 3600e3;
const JST = 9 * H;
const at = (date, hh) => Date.parse(`${date}T00:00:00+09:00`) + hh * H;

test('weatherInfo: 既知コードと未知コード', () => {
  assert.deepEqual(weatherInfo('100'), { text: '晴れ', icon: '☀️' });
  assert.equal(weatherInfo('202').icon, '🌦️');
  assert.equal(weatherInfo('300').icon, '🌧️');
  assert.equal(weatherInfo('140').icon, '⛈️');
  assert.equal(weatherInfo('400').icon, '❄️');
  assert.equal(weatherInfo('999').text, ''); // 範囲外は空
  assert.equal(weatherInfo('117').text, '晴れのち雪');
  assert.equal(weatherInfo('').icon, '·');
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
