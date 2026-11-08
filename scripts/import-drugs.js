// 使い方: npm run import:drugs -- <CSVのパスまたはURL>
import { importDrugs } from '../src/drugs.js';

const src = process.argv[2];
if (!src) {
  console.error('usage: npm run import:drugs -- <csv path or url>');
  process.exit(1);
}
console.log('imported', await importDrugs(src), 'rows');
