// 「今日の見通し」の要因タイル(気圧・気温・降水・湿度)とまとめ。サーバーで描画し、
// 都道府県ページにそのまま埋め込むほか、週間天気ページには /api/week の tilesHtml として渡す。
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// 手描き風の線画(64x64)。色は CSS の --face-stroke
const ICONS = {
  pressure: '<path d="M9 44a23 23 0 0146 0"/><path d="M32 44l11-14"/><path d="M8 52h48"/><path d="M32 20v4M15.5 29l3 3M48.5 29l-3 3"/>',
  temp: '<path d="M26.5 14a5.5 5.5 0 0111 0v22a11.5 11.5 0 11-11 0z"/><path d="M32 24v22"/><path d="M43 18h6M43 27h6"/>',
  rain: '<path d="M7 31a25 23 0 0150 0z"/><path d="M32 31v18a5.5 5.5 0 01-11 0"/><path d="M32 9V5"/>',
  hum: '<path d="M32 7c9 12 14 19 14 28a14 14 0 01-28 0c0-9 5-16 14-28z"/><path d="M24 38q4 4 8 0t8 0"/>',
};
// 体調そらもよう(キャラクターのイラスト: public/img/mood/mood-{段階}-{on|off}.webp)。
// 今の段階だけ色つき(on)、ほかは灰色(off)で、5段階をならべて見せる。
const MOOD_NAMES = ['おだやか', '少し気にかけて', '注意', '要注意', '警戒'];
export const moodImg = (level, on, cls = '') => `<img class="mi ${cls}" src="/img/mood/mood-${level}-${on ? 'on' : 'off'}.webp" alt="${on ? esc(MOOD_NAMES[level - 1]) : ''}"${on ? '' : ' aria-hidden="true"'} width="120" height="120" loading="lazy" decoding="async">`;
export const moodStrip = (level) => `<div class="mood-strip" role="img" aria-label="体調そらもよう ${esc(MOOD_NAMES[level - 1])}（5段階の${level}）">${[1, 2, 3, 4, 5].map((i) => `<div class="ms${i === level ? ' on' : ''}" data-l="${i}">${moodImg(i, i === level)}<i class="mdot"></i></div>`).join('')}</div>`;

const hm = (ts) => { const d = new Date(ts + 9 * 3600e3); return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${d.getUTCHours()}時ごろ`; };
const CH_NAME = { pressure: '気圧', temp: '気温差', rain: '降水', hum: '湿度' };
const CH_ICON = { pressure: 'pressure', temp: 'temp', rain: 'rain', hum: 'hum' };

/** 体調そらもよう(大きなパネル) */
export function moodBlockHtml(w) {
  const m = w?.mood;
  if (!m) return '';
  const chips = m.factors.length ? m.factors.map((k) => `<span class="fx-chip">${fxIcon(CH_ICON[k], 20)}${CH_NAME[k]}</span>`).join('') : '<span class="fx-chip ok">✓ 気になる要因なし</span>';
  const bar = [1, 2, 3, 4, 5].map((i) => `<i class="${i <= m.level ? `on m${i}` : ''}"></i>`).join('');
  return `<div class="mood mood-${m.level}" role="group" aria-label="体調そらもよう">
  ${moodStrip(m.level)}
  <div class="mood-body">
    <p class="mood-en">今日の体調そらもよう</p>
    <p class="mood-t"><b>${esc(m.label)}</b></p>
    <div class="mood-bar" aria-hidden="true">${bar}</div>
    <p class="mood-s">スコア <b>${m.score}</b> / 100${m.worst ? `　<small>気圧が最も動く時間帯 ${hm(m.worst.at)}</small>` : ''}</p>
    <div class="fx-chips">${chips}</div>
    <p class="mood-r">${esc(m.reason)}${m.advice ? esc(m.advice) : ''}</p>
  </div>
</div>`;
}

/** トップの一行ニュース用の小さな表示 */
export function moodMiniHtml(w) {
  const m = w?.mood;
  if (!m) return '';
  return `<span class="mood-mini mood-${m.level}">${moodImg(m.level, true, 'mi-mini')}<span><b>体調そらもよう：${esc(m.label)}</b>（${m.score}/100）<br><small>${esc(m.reason)}${m.advice ? esc(m.advice) : ''}</small></span></span>`;
}

export const fxIcon = (name, size = 34) => `<svg class="fxi" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">${ICONS[name]}</svg>`;

const sgn = (n) => (n > 0 ? '+' : n < 0 ? '−' : '±');
const arrow = (n) => (n > 0 ? '<i class="ar up">▲</i>' : n < 0 ? '<i class="ar dn">▼</i>' : '<i class="ar">－</i>');
const mm = (x) => (Math.round(x * 10) / 10).toFixed(1);
const pill = (cls, label) => `<span class="pill ${cls}">${esc(label)}</span>`;
const tile = (icon, title, cls, value, unit, cap, rows, pl) =>
  `<div class="fx ${cls}"><div class="fx-h">${fxIcon(icon, 30)}<b>${title}</b></div>${cap ? `<div class="fx-cap">${cap}</div>` : ''}<div class="fx-v">${value}<small>${unit}</small></div>${rows.map((r) => `<div class="fx-r">${r}</div>`).join('')}${pl ? `<div class="fx-p">${pl}</div>` : ''}</div>`;
const na = (icon, title) => `<div class="fx na"><div class="fx-h">${fxIcon(icon, 30)}<b>${title}</b></div><div class="fx-na">データ準備中</div></div>`;

export function factorTilesHtml(w) {
  if (!w) return '';
  const n = w.next24 ?? { level: 'none', label: '安定' };
  const cur = w.current;
  const t = w.temp, r = w.rain, h = w.humidity;
  const tiles = [
    cur
      ? tile('pressure', '気圧', `lv-${n.level}`, Math.round(cur.pressure), 'hPa', '', [cur.d3 != null ? `${arrow(cur.d3)}直近3時間 ${sgn(cur.d3)}${Math.abs(cur.d3).toFixed(1)}` : '', '今後24時間'].filter(Boolean), pill(`lv-${n.level}`, n.label))
      : na('pressure', '気圧'),
    t
      ? tile('temp', '気温', `tp-${t.level}`, Math.round(t.now), '℃', '', [t.d24 != null ? `${arrow(t.d24)}前日同時刻比 ${sgn(t.d24)}${Math.abs(t.d24).toFixed(1)}℃` : '', `今後24時間 ${Math.round(t.min)}〜${Math.round(t.max)}℃`].filter(Boolean), pill(`tp-${t.level}`, t.label))
      : na('temp', '気温'),
    r && (r.past24 != null || r.next24 != null)
      ? tile('rain', '降水', `tp-${r.level}`, r.past24 != null ? mm(r.past24) : '–', 'mm', '直近24時間', [r.prev24 != null ? `前日同時刻の24時間 ${mm(r.prev24)}mm` : '', r.next24 != null ? `今後24時間 約${mm(r.next24)}mm${r.popMax != null ? `（降水確率 ${r.popMax}%）` : ''}` : ''].filter(Boolean), pill(`tp-${r.level}`, r.label))
      : na('rain', '降水'),
    h
      ? tile('hum', '湿度', `tp-${h.level}`, h.now, '%', '', [h.d24 != null ? `${arrow(h.d24)}前日同時刻比 ${sgn(h.d24)}${Math.abs(h.d24)}%` : '', `今後24時間 ${h.min}〜${h.max}%`].filter(Boolean), pill(`tp-${h.level}`, h.label))
      : na('hum', '湿度'),
  ];
  return `<div class="fx-grid">${tiles.join('')}</div>`;
}
