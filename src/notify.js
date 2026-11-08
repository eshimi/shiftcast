// アラート判定＆事前通知バッチ（FCM）。毎日 ALERT_HOUR 時(JST)に翌日の気圧変動を判定。
import fs from 'node:fs';
import { db } from './db.js';
import { AREA_BY_CODE } from './areas.js';
import { annotate, worstDrop, SEVERITY, LEVEL_LABEL, jstDayStart, jstDateStr, HOUR } from './pressure.js';

let messaging; // undefined=未初期化, null=無効
async function getMessaging() {
  if (messaging !== undefined) return messaging;
  messaging = null;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT; // JSON文字列 or ファイルパス
  if (!raw && !process.env.GOOGLE_APPLICATION_CREDENTIALS) return messaging;
  try {
    const admin = (await import('firebase-admin')).default;
    const cred = raw
      ? admin.credential.cert(JSON.parse(raw.trim().startsWith('{') ? raw : fs.readFileSync(raw, 'utf8')))
      : admin.credential.applicationDefault();
    admin.initializeApp({ credential: cred });
    messaging = admin.messaging();
  } catch (e) {
    console.error('[fcm] init failed:', e.message);
  }
  return messaging;
}

/** 指定エリアの対象日(JST)の予報から最大の低下を取り出す */
export function forecastForDay(areaCode, dayStart) {
  const rows = db
    .prepare(
      `SELECT ts, pressure FROM points WHERE area_code=? AND source IN ('owm','demo') AND ts BETWEEN ? AND ? AND pressure IS NOT NULL ORDER BY ts`,
    )
    .all(areaCode, dayStart - 3 * HOUR, dayStart + 24 * HOUR);
  const ann = annotate(rows).filter((p) => p.ts >= dayStart && p.ts <= dayStart + 24 * HOUR);
  return worstDrop(ann);
}

export async function runAlertBatch(now = Date.now()) {
  const tomorrow = jstDayStart(now) + 24 * HOUR;
  const dateStr = jstDateStr(tomorrow);
  const users = db
    .prepare("SELECT id, fcm_token FROM users WHERE notify=1 AND fcm_token IS NOT NULL AND (last_notified IS NULL OR last_notified<>?)")
    .all(dateStr);
  const fcm = await getMessaging();
  let sent = 0;
  for (const u of users) {
    const areas = db.prepare('SELECT area_code FROM user_areas WHERE user_id=? ORDER BY pos').all(u.id);
    let hit = null;
    for (const { area_code } of areas) {
      const w = forecastForDay(area_code, tomorrow);
      if (w && SEVERITY[w.level] >= SEVERITY.caution && (!hit || w.rate < hit.w.rate)) hit = { w, area_code };
    }
    if (!hit) continue;
    const hh = new Date(hit.w.ts + 9 * HOUR).getUTCHours();
    const msg = {
      title: `明日は気圧が下がります（${LEVEL_LABEL[hit.w.level]}）`,
      body: `${AREA_BY_CODE.get(hit.area_code).name}：${hh}時ごろ 約${Math.abs(hit.w.rate).toFixed(1)}hPa/h で低下する見込みです。早めの休息や服薬の準備を。`,
    };
    if (!fcm) {
      console.log(`[alert:dry-run] ${u.id.slice(0, 8)} ${msg.title} / ${msg.body}`);
      sent++;
    } else {
      try {
        await fcm.send({ token: u.fcm_token, data: msg, webpush: { headers: { Urgency: 'high' } } });
        sent++;
      } catch (e) {
        console.error('[fcm] send failed:', e.code || e.message);
        if (/registration-token-not-registered|invalid-argument/.test(e.code || '')) {
          db.prepare('UPDATE users SET fcm_token=NULL WHERE id=?').run(u.id);
        }
        continue;
      }
    }
    db.prepare('UPDATE users SET last_notified=? WHERE id=?').run(dateStr, u.id);
  }
  console.log(`[alert] ${dateStr} candidates=${users.length} notified=${sent}${fcm ? '' : ' (FCM未設定: dry-run)'}`);
}
