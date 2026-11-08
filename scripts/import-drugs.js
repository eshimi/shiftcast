// 使い方: node scripts/import-drugs.js <CSVのパスまたはURL> [出力SQL(既定: data/drugs_import.sql)]
// 生成後: npx wrangler d1 execute DB --remote --file data/drugs_import.sql
import fs from 'node:fs';
import { csvToSql, decodeCsv } from '../src/drugs.js';

const [src, out = 'data/drugs_import.sql'] = process.argv.slice(2);
if (!src) {
  console.error('usage: node scripts/import-drugs.js <csv path or url> [out.sql]');
  process.exit(1);
}
const buf = /^https?:\/\//.test(src) ? Buffer.from(await (await fetch(src)).arrayBuffer()) : fs.readFileSync(src);
const { sql, count } = csvToSql(decodeCsv(buf));
fs.writeFileSync(out, sql);
console.log(`${count} rows -> ${out}`);
