// Cron Triggers: 10分ごとに起動し、時刻(JST)に応じてジョブを振り分ける。
import { refreshAll } from './weather.js';
import { refreshJma, refreshJmaForecast } from './jma.js';
import { runAlertBatch } from './notify.js';
import { runStatsBatch } from './stats.js';
import { jstHour } from './pressure.js';

export async function scheduled(controller, env) {
  const now = controller.scheduledTime;
  const minute = new Date(now).getUTCMinutes();
  const first = minute < 10; // 毎時の最初の起動枠
  const hour = jstHour(now);
  const jobs = [['stats', () => runStatsBatch(env)]];
  if (first && hour % Number(env.WEATHER_INTERVAL_H || 3) === 0) {
    jobs.push(['weather', () => refreshAll(env)]);
    jobs.push(['jma-forecast', () => refreshJmaForecast(env)]);
  }
  if (minute >= 10 && minute < 20) jobs.push(['jma', () => refreshJma(env)]); // 毎時0分観測の公開を待って取得
  // 通知時刻はユーザーごとに選べる(フェーズ3-2)ため毎時の最初の枠で起動し、対象ユーザーの絞り込みは runAlertBatch 側で行う
  if (first) jobs.push(['alert', () => runAlertBatch(env)]);
  for (const [name, fn] of jobs) {
    try {
      await fn();
    } catch (e) {
      console.error(`[cron] ${name} failed:`, e.message);
    }
  }
}
