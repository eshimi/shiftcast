// 医薬品リスト（厚生労働省 一般用医薬品オープンデータ等のCSVを取り込み、サジェストに利用）
import fs from 'node:fs';
import { db, tx } from './db.js';

/** 検索用正規化: NFKC・小文字化・ひらがな→カタカナ・空白/記号除去 */
export function norm(s) {
  return String(s ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60))
    .replace(/[\s・\-ー()（）【】\[\]「」]/g, '');
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') (cur += '"'), i++;
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') (row.push(cur), (cur = ''));
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cur);
      cur = '';
      if (row.some((x) => x !== '')) rows.push(row);
      row = [];
    } else cur += c;
  }
  row.push(cur);
  if (row.some((x) => x !== '')) rows.push(row);
  return rows;
}

const NAME_KEYS = ['販売名', '製品名', '医薬品名', '商品名', '品名', 'name'];
const MAKER_KEYS = ['製造販売業者', '製造販売元', '会社名', '販売会社', 'maker'];
const INGR_KEYS = ['有効成分', '成分', '主成分', 'ingredient'];

function pick(header, keys) {
  for (const k of keys) {
    const i = header.findIndex((h) => h.trim().toLowerCase().includes(k.toLowerCase()));
    if (i >= 0) return i;
  }
  return -1;
}

function decode(buf) {
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buf);
  if (!utf8.includes('�')) return utf8.replace(/^﻿/, '');
  return new TextDecoder('shift_jis').decode(buf); // 公的CSVはShift_JISの場合が多い
}

/** CSV(ファイルパス or URL)を取り込む。列名はヘッダから推定。 */
export async function importDrugs(src) {
  const buf = /^https?:\/\//.test(src)
    ? Buffer.from(await (await fetch(src, { signal: AbortSignal.timeout(60000) })).arrayBuffer())
    : fs.readFileSync(src);
  const rows = parseCsv(decode(buf));
  const header = rows.shift() || [];
  const ni = pick(header, NAME_KEYS);
  if (ni < 0) throw new Error(`販売名の列が見つかりません。ヘッダ: ${header.join(' | ')}`);
  const mi = pick(header, MAKER_KEYS);
  const ii = pick(header, INGR_KEYS);
  const ins = db.prepare(
    `INSERT INTO drugs(name,name_norm,maker,ingredient) VALUES(?,?,?,?)
     ON CONFLICT(name,maker) DO UPDATE SET name_norm=excluded.name_norm, ingredient=excluded.ingredient`,
  );
  let n = 0;
  tx(() => {
    for (const r of rows) {
      const name = (r[ni] || '').trim();
      if (!name) continue;
      ins.run(name, norm(name), mi >= 0 ? (r[mi] || '').trim() : '', ii >= 0 ? (r[ii] || '').trim() : '');
      n++;
    }
  });
  return n;
}

export function searchDrugs(q, limit = 20) {
  const n = norm(q);
  if (n.length < 1) return [];
  const esc = n.replace(/[%_\\]/g, '\\$&');
  return db
    .prepare(
      `SELECT name, maker FROM drugs WHERE name_norm LIKE ? ESCAPE '\\' OR (ingredient<>'' AND ingredient LIKE ? ESCAPE '\\')
       ORDER BY (name_norm LIKE ? ESCAPE '\\') DESC, length(name) LIMIT ?`,
    )
    .all(`%${esc}%`, `%${q.replace(/[%_\\]/g, '\\$&')}%`, `${esc}%`, limit);
}

export async function seedDrugsIfEmpty() {
  const c = db.prepare('SELECT COUNT(*) c FROM drugs').get().c;
  if (c > 0) return;
  const sample = new URL('../data/drugs_sample.csv', import.meta.url);
  const n = await importDrugs(sample.pathname);
  console.log(`[drugs] seeded ${n} sample rows (本番は厚労省データを import:drugs で取り込んでください)`);
}
