// デザインシステム「QRO Eyewear」(design/qro-eyewear.tokens.json) から public/ds.css を生成する。
// 使い方: node scripts/build-ds-css.mjs   （トップページ以外のページ・アプリ・利用規約が、この変数を使う）
import fs from 'node:fs';

const t = JSON.parse(fs.readFileSync(new URL('../design/qro-eyewear.tokens.json', import.meta.url), 'utf8'));
// 上書き設定(design/overrides.json): デザインシステムの元データは変えず、サイト固有の差分だけをここで適用する
const ov = fs.existsSync(new URL('../design/overrides.json', import.meta.url)) ? JSON.parse(fs.readFileSync(new URL('../design/overrides.json', import.meta.url), 'utf8')) : {};
Object.assign(t.type.families, ov.type?.families ?? {});
const themes = t.color.themes.map((x) => x.id); // [light, dark]
const colorVars = (theme) => t.color.tokens.map((c) => `  --${c.name}: ${c.value[theme] ?? c.value[themes[0]]};`).join('\n');
const spacing = t.spacing.tokens.map((s) => `  --${s.name}: ${s.value};`).join('\n');
const radius = t.radius.tokens.map((r) => `  --${r.name}: ${r.value};`).join('\n');
const fam = Object.entries(t.type.families).map(([k, v]) => `  --font-${k}: ${v};`).join('\n');
const styles = t.type.groups.flatMap((g) => g.styles).map((s) => `  --fs-${s.name}: ${s.fontSize}; --lh-${s.name}: ${s.lineHeight}; --fw-${s.name}: ${s.fontWeight};`).join('\n');

const css = `/* ${t.name} — generated from design/qro-eyewear.tokens.json + design/overrides.json (scripts/build-ds-css.mjs). 手で編集しないこと。 */
:root {
${colorVars(themes[0])}
${spacing}
${radius}
${fam}
${styles}
}
@media (prefers-color-scheme: dark) {
  :root {
${colorVars(themes[1]).replace(/^/gm, '  ')}
  }
}
`;
fs.writeFileSync(new URL('../public/ds.css', import.meta.url), css);
console.log('public/ds.css', css.length, 'bytes');
