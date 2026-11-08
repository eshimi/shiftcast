// アラート判定＆事前通知（FCM HTTP v1 を fetch + WebCrypto で直接呼ぶ。firebase-admin はWorkers非対応）
import { all, get, run } from './db.js';
import { AREA_BY_CODE } from './areas.js';
import { annotate, worstDrop, SEVERITY, LEVEL_LABEL, jstDayStart, jstDateStr, HOUR } from './pressure.js';

const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const enc = (o) => b64url(new TextEncoder().encode(JSON.stringify(o)));

let tokenCache = null;
async function accessToken(sa) {
  if (tokenCache && tokenCache.exp > Date.now() + 60e3) return tokenCache.token;
  const iat = Math.floor(Date.now() / 1000);
  const unsigned = `${enc({ alg: 'RS256', typ: 'JWT' })}.${enc({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat, exp: iat + 3600 })}`;
  const pem = sa.private_key.replace(/-----[^-]+-----|\s/g, '');
  const key = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${b64url(sig)}` }),
  });
  if (!res.ok) throw new Error('fcm oauth ' + res.status);
  const j = await res.json();
  tokenCache = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return tokenCache.token;
}

function fcmClient(env) {
  if (!env.FIREBASE_SERVICE_ACCOUNT) return null;
  const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
  return async (token, data) => {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: 'POST',
      headers: { authorization: `Bearer ${await accessToken(sa)}`, 'content-type': 'application/json' },
      body: JSON.stringify({ message: { token, data, webpush: { headers: { Urgency: 'high' } } } }),
    });
    if (!res.ok) {
      const e = new Error(`fcm ${res.status}`);
      e.gone = res.status === 404 || res.status === 400;
      throw e;
    }
  };
}

/** 対象日(JST)の予報から最大の低下区間を取り出す */
export async function forecastForDay(db, areaCode, dayStart) {
  const rows = await all(db, `SELECT ts, pressure FROM points WHERE area_code=? AND source IN ('owm','demo') AND ts BETWEEN ? AND ? AND pressure IS NOT NULL ORDER BY ts`, areaCode, dayStart - 3 * HOUR, dayStart + 24 * HOUR);
  return worstDrop(annotate(rows).filter((p) => p.ts >= dayStart && p.ts <= dayStart + 24 * HOUR));
}

export async function runAlertBatch(env, now = Date.now()) {
  const tomorrow = jstDayStart(now) + 24 * HOUR;
  const dateStr = jstDateStr(tomorrow);
  const users = await all(env.DB, 'SELECT id, fcm_token FROM users WHERE notify=1 AND fcm_token IS NOT NULL AND (last_notified IS NULL OR last_notified<>?)', dateStr);
  const send = fcmClient(env);
  let sent = 0;
  for (const u of users) {
    const areas = await all(env.DB, 'SELECT area_code FROM user_areas WHERE user_id=? ORDER BY pos', u.id);
    let hit = null;
    for (const { area_code } of areas) {
      const w = await forecastForDay(env.DB, area_code, tomorrow);
      if (w && SEVERITY[w.level] >= SEVERITY.caution && (!hit || w.rate < hit.w.rate)) hit = { w, area_code };
    }
    if (!hit) continue;
    const hh = new Date(hit.w.ts + 9 * HOUR).getUTCHours();
    const msg = {
      title: `明日は気圧が下がります（${LEVEL_LABEL[hit.w.level]}）`,
      body: `${AREA_BY_CODE.get(hit.area_code).name}：${hh}時ごろ 約${Math.abs(hit.w.rate).toFixed(1)}hPa/h で低下する見込みです。早めの休息や服薬の準備を。`,
    };
    if (!send) console.log(`[alert:dry-run] ${u.id.slice(0, 8)} ${msg.title} / ${msg.body}`);
    else {
      try {
        await send(u.fcm_token, msg);
      } catch (e) {
        console.error('[fcm] send failed:', e.message);
        if (e.gone) await run(env.DB, 'UPDATE users SET fcm_token=NULL WHERE id=?', u.id);
        continue;
      }
    }
    sent++;
    await run(env.DB, 'UPDATE users SET last_notified=? WHERE id=?', dateStr, u.id);
  }
  console.log(`[alert] ${dateStr} candidates=${users.length} notified=${sent}${send ? '' : ' (FCM未設定: dry-run)'}`);
}
