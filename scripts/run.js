// 外部cron等から個別にバッチを実行する: node scripts/run.js <weather|jma|alert|stats>
import { refreshAll } from '../src/weather.js';
import { refreshJma } from '../src/jma.js';
import { runAlertBatch } from '../src/notify.js';
import { runStatsBatch } from '../src/stats.js';

const jobs = { weather: refreshAll, jma: refreshJma, alert: () => runAlertBatch(), stats: async () => runStatsBatch() };
const name = process.argv[2];
if (!jobs[name]) {
  console.error('usage: run.js <' + Object.keys(jobs).join('|') + '>');
  process.exit(1);
}
await jobs[name]();
