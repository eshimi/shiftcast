// 医薬品リスト（厚生労働省 一般用医薬品オープンデータ等のCSV）。
// 取り込みは scripts/import-drugs.js がCSV→SQLを生成し、wrangler d1 execute で投入する。
import { all } from './db.js';

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
const pick = (header, keys) => {
  for (const k of keys) {
    const i = header.findIndex((h) => h.trim().toLowerCase().includes(k.toLowerCase()));
    if (i >= 0) return i;
  }
  return -1;
};

export function decodeCsv(buf) {
  const utf8 = new TextDecoder('utf-8').decode(buf);
  if (!utf8.includes('�')) return utf8.replace(/^﻿/, '');
  return new TextDecoder('shift_jis').decode(buf); // 公的CSVはShift_JISのことが多い
}

const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;

/** CSV文字列 → INSERT文のSQL（列名はヘッダから推定） */
export function csvToSql(text) {
  const rows = parseCsv(text);
  const header = rows.shift() || [];
  const ni = pick(header, NAME_KEYS);
  if (ni < 0) throw new Error(`販売名の列が見つかりません。ヘッダ: ${header.join(' | ')}`);
  const mi = pick(header, MAKER_KEYS);
  const ii = pick(header, INGR_KEYS);
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    const name = (r[ni] || '').trim();
    const maker = mi >= 0 ? (r[mi] || '').trim() : '';
    if (!name || seen.has(name + '\0' + maker)) continue;
    seen.add(name + '\0' + maker);
    const ingr = ii >= 0 ? (r[ii] || '').trim() : '';
    out.push(
      `INSERT INTO drugs(name,name_norm,maker,ingredient) VALUES(${lit(name)},${lit(norm(name))},${lit(maker)},${lit(ingr)}) ` +
        `ON CONFLICT(name,maker) DO UPDATE SET name_norm=excluded.name_norm, ingredient=excluded.ingredient;`,
    );
  }
  return { sql: out.join('\n') + '\n', count: out.length };
}

export async function searchDrugs(db, q, limit = 20) {
  const n = norm(q);
  if (!n) return [];
  const esc = (s) => s.replace(/[%_\\]/g, '\\$&');
  return all(
    db,
    `SELECT name, maker FROM drugs WHERE name_norm LIKE ?1 ESCAPE '\\' OR (ingredient<>'' AND ingredient LIKE ?2 ESCAPE '\\')
     ORDER BY (name_norm LIKE ?3 ESCAPE '\\') DESC, length(name) LIMIT ?4`,
    `%${esc(n)}%`,
    `%${esc(q)}%`,
    `${esc(n)}%`,
    limit,
  );
}
