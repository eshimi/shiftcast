// 軽量スケジューラ（外部cron不要）。実行済みスロットは meta に保存し、再起動しても二重実行しない。
// 本番で複数インスタンスにする場合は `npm run batch:*` を外部cronから呼ぶ構成に切り替える（SCHEDULER=off）。
import { getMeta, setMeta } from './db.js';
import { refreshAll } from './weather.js';
import { refreshJma } from './jma.js';
import { runAlertBatch } from './notify.js';
import { runStatsBatch } from './stats.js';
import { JST, HOUR, jstDateStr, jstHour } from './pressure.js';

const ALERT_HOUR = Number(process.env.ALERT_HOUR ?? 20);
const WEATHER_EVERY_H = Number(process.env.WEATHER_INTERVAL_H ?? 3);

function due(name, slot) {
  if (getMeta('run:' + name) === String(slot)) return false;
  setMeta('run:' + name, slot);
  return true;
}

async function tick() {
  const now = Date.now();
  const jobs = [];
  if (due('weather', Math.floor((now + JST) / (WEATHER_EVERY_H * HOUR)))) jobs.push(['weather', refreshAll]);
  if (due('jma', Math.floor(now / (30 * 60e3)))) jobs.push(['jma', refreshJma]);
  if (due('stats', Math.floor(now / (10 * 60e3)))) jobs.push(['stats', async () => runStatsBatch()]);
  if (jstHour(now) >= ALERT_HOUR && due('alert', jstDateStr(now))) jobs.push(['alert', () => runAlertBatch()]);
  for (const [name, fn] of jobs) {
    try {
      await fn();
    } catch (e) {
      console.error(`[scheduler] ${name} failed:`, e.message);
    }
  }
}

export function startScheduler() {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await tick();
    } finally {
      running = false;
    }
  };
  run();
  return setInterval(run, 60e3);
}
