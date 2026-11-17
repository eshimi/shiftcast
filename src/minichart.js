// 気圧の推移・予報の小さなグラフ(SVG文字列)。週間天気(/api/week の chartHtml)と都道府県ページで共通。
// 実線=実況、点線=予報、色の帯=気圧の動きへの注意レベル。時刻はJSTで表示する。
const H6 = 6 * 3600e3, JST = 9 * 3600e3;
export function miniChartHtml(w) {
  const pts = (w?.hourly48 || []).filter((p) => p.pressure != null);
  if (pts.length < 4) return '';
  const W = 340, H = 156, L = 34, R = 8, T = 24, B = 24;
  const t0 = pts[0].ts, t1 = pts[pts.length - 1].ts;
  const lo = Math.floor(Math.min(...pts.map((p) => p.pressure)) - 2);
  let hi = Math.ceil(Math.max(...pts.map((p) => p.pressure)) + 2);
  if (hi - lo < 8) hi = lo + 8;
  const x = (t) => L + ((t - t0) / (t1 - t0)) * (W - L - R), y = (v) => T + ((hi - v) / (hi - lo)) * (H - T - B);
  const f = (n) => n.toFixed(1);
  const bands = pts.map((p, i) => (i && p.level && p.level !== 'none' ? `<rect x="${f(x(pts[i - 1].ts))}" y="${T}" width="${f(x(p.ts) - x(pts[i - 1].ts))}" height="${H - T - B}" fill="var(--lv-${p.level})" opacity=".24"/>` : '')).join('');
  const pa = pts.filter((p) => p.ts <= w.now), fu = pts.filter((p) => p.ts >= w.now);
  const line = (a) => a.map((p, i) => `${i ? 'L' : 'M'}${f(x(p.ts))} ${f(y(p.pressure))}`).join('');
  const step = hi - lo > 20 ? 10 : hi - lo > 10 ? 5 : 2;
  let grid = '';
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) grid += `<line x1="${L}" x2="${W - R}" y1="${f(y(v))}" y2="${f(y(v))}" stroke="var(--color-border)"/><text x="${L - 4}" y="${f(y(v) + 3)}" text-anchor="end">${v}</text>`;
  let xt = '';
  for (let t = Math.ceil((t0 + JST) / H6) * H6 - JST; t <= t1; t += H6) {
    const d = new Date(t + JST), hr = d.getUTCHours();
    xt += `<text x="${f(x(t))}" y="${H - 8}" text-anchor="middle">${hr === 0 ? `${d.getUTCMonth() + 1}/${d.getUTCDate()}` : hr + '時'}</text>`;
  }
  const nx = x(w.now), cur = pa.length ? pa[pa.length - 1] : null;
  return `<div class="mood-chart"><p class="mc-h"><b>気圧の推移・予報</b><small>hPa</small></p>
<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="気圧の推移と予報のグラフ" class="mc-svg">${bands}${grid}${xt}
<path d="${line(pa)}" fill="none" stroke="var(--color-ink)" stroke-width="2.4" stroke-linejoin="round"/>
<path d="${line(fu)}" fill="none" stroke="var(--color-primary)" stroke-width="2.4" stroke-dasharray="5 4" stroke-linejoin="round"/>
<line x1="${f(nx)}" x2="${f(nx)}" y1="${T - 6}" y2="${H - B}" stroke="var(--color-primary)" stroke-dasharray="3 3"/>
<rect x="${f(nx - 13)}" y="${T - 22}" width="26" height="16" rx="8" fill="var(--color-primary)"/><text x="${f(nx)}" y="${f(T - 10.5)}" text-anchor="middle" fill="#fff" style="font-weight:700">今</text>
${cur ? `<circle cx="${f(nx)}" cy="${f(y(cur.pressure))}" r="4.5" fill="var(--color-primary)"/>` : ''}</svg>
<p class="mc-n">実線＝実況　点線＝予報　色の帯＝気圧の動きに注意</p></div>`;
}
