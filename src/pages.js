// サーバー側で描画するページ（トップ / 週間天気 / コラム）。共通のヘッダー・フッターをここで持つ。
import { COLUMNS, COLUMN_UPDATED, COLUMN_KEYWORDS, findColumn } from './columns.js';
import { PEOPLE, PERSON } from './people.js';
import { SITE_URL, SITE_NAME, OG_IMAGE } from './siteconfig.js';
import { APP_BODY, APP_TABS } from './appbody.js';
import { GLOSSARY } from './glossary.js';
import { CARE_FACTORS, CARE_TIMES, CARE_HELP, CARE_MAX_LEVEL, CARE_GENERAL } from './care.js';
import { factorTilesHtml, moodBlockHtml } from './tiles.js';
import { miniChartHtml } from './minichart.js';
import { COLUMN_EXTRA } from './column-extra.js';
import { REGION_NOTES, PREF_NOTES } from './pref-notes.js';
import { SYMPTOMS, symptomBySlug } from './symptoms.js';
import { repCodeOf } from './today.js';
import { MAP_COLS, MAP_ROWS, MAP_DOTS } from './japanmap.js';
import { LAND_W, LAND_H, LAND_PROJ, LAND_PATHS } from './japanland.js';
import { AREA_BY_CODE } from './areas.js';
import { PREFS, REGIONS, regionOf, neighbors } from './prefectures.js';

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const SITE = SITE_NAME;
const SITE_TITLE = 'ウェルミー'; // <title>・og:site_name・構造化データのサイト名(表示上のロゴ・本文は「ウェルミー」)
const TAGLINE = '気圧と体調のノート';
// トップのHERO背景をランダムに選ぶ（描画前に実行）。直前に見たものとは別の写真にする。?hero=0|1|2 で固定表示も可能。
// 写真ごとに、文字が読めるよう暗いオーバーレイの色・濃さ(a=[上,中,下])と、画面に見せたい位置(p)を設定している。
const HERO_PICKER = `<script>
(function () {
  var L = [
    { s: '/hero/bg/dusk.webp', p: '41% center', v: '20, 40, 62', a: [0.34, 0.10, 0.78] },
    { s: '/hero/bg/water.webp', p: '30% 50%', v: '12, 56, 92', a: [0.34, 0.24, 0.76] },
    { s: '/hero/bg/sky.webp', p: '50% 50%', v: '40, 92, 158', a: [0.30, 0.22, 0.72] },
    { s: '/hero/bg/mist.webp', p: '50% 55%', v: '34, 60, 100', a: [0.50, 0.46, 0.84] }
  ];
  var i = Math.floor(Math.random() * L.length);
  var q = /[?&]hero=(\\d)/.exec(location.search);
  if (q && L[+q[1]]) { i = +q[1]; }
  else {
    try {
      var last = parseInt(localStorage.getItem('heroLast'), 10);
      if (i === last) i = (i + 1 + Math.floor(Math.random() * (L.length - 1))) % L.length;
      localStorage.setItem('heroLast', i);
    } catch (e) {}
  }
  var c = L[i], r = document.documentElement.style;
  r.setProperty('--hero-img', 'url("' + c.s + '")');
  r.setProperty('--hero-pos', c.p);
  r.setProperty('--ov', c.v);
  r.setProperty('--o1', c.a[0]); r.setProperty('--o2', c.a[1]); r.setProperty('--o3', c.a[2]);
  var l = document.createElement('link'); l.rel = 'preload'; l.as = 'image'; l.href = c.s; document.head.appendChild(l);
})();
</script>`;

// 人物イラスト（飾り）。alt は空で、スクリーンリーダーには読ませない。大きさ k は元画像に対する倍率(CSS px)。
const person = (name, { k = 0.6, cls = '', style = '' } = {}) => {
  const p = PERSON[name];
  return `<img class="ppl ${cls}" src="/img/people/${p.file}" width="${Math.round(p.w * k)}" height="${Math.round(p.h * k)}" alt="" loading="lazy" decoding="async" aria-hidden="true"${style ? ` style="${style}"` : ''}>`;
};
// フッターの上に、毎回ランダムな人物を並べる（描画後にブラウザ側で選ぶ。HTMLはキャッシュされるため）
const STREET_SCRIPT = `<script>
(function () {
  var el = document.querySelector('[data-street]');
  if (!el) return;
  var L = ${JSON.stringify(PEOPLE.map((p) => [p.file, p.w, p.h]))};
  // 毎回ランダムに1人だけ、中央に置く
  var room = Math.min(window.innerWidth, 1100) - 40, used = 0, picked = [], tries = 0;
  while (tries++ < 80 && picked.length < 1) {
    var c = L[Math.floor(Math.random() * L.length)], w = c[1] * 0.5 + 14;
    if (picked.indexOf(c) >= 0 || used + w > room) continue;
    picked.push(c); used += w;
  }
  picked.forEach(function (c) {
    var im = new Image(); im.className = 'ppl'; im.alt = ''; im.setAttribute('aria-hidden', 'true'); im.decoding = 'async';
    im.width = Math.round(c[1] * 0.5); im.height = Math.round(c[2] * 0.5); im.src = '/img/people/' + c[0];
    el.appendChild(im);
  });
})();
</script>`;

const LOGO = '<img class="logo-img" src="/logo-h.webp" alt="ウェルミー" width="104" height="36">';

// ヘッダーの2段ナビ: 種類別のグループ(1段目) → そのグループのページ(2段目)。ラベルは各ページの h1(ページ見出し)の先頭と同じ言葉にそろえる。
// [id, ラベル, URL]。id は layout の page 名(コラム記事は 'column' も 'columns' として扱う)
const NAV_GROUPS = [
  { name: '気圧を見る', items: [['weather', '週間天気', '/weather'], ['today', '全国の地図', '/today'], ['pressure', '都道府県別の気圧予報', '/pressure']] },
  { name: '体調を整える', items: [['care', '今日の過ごし方', '/care'], ['guide', '気象病ガイド・症状別', '/guide'], ['check', '気象病セルフチェック', '/check']] },
  { name: '記録・分析', items: [['app', '気圧・記録', '/app/']] },
  { name: '読む・知る', items: [['columns', 'コラム', '/columns'], ['glossary', '用語集', '/glossary'], ['about', 'サービス紹介', '/about']] },
];
const navHtml = (page) => {
  const id = page === 'column' ? 'columns' : page === 'symptom' ? 'guide' : page;
  const cur = NAV_GROUPS.find((g) => g.items.some((i) => i[0] === id));
  const row1 = NAV_GROUPS.map((g) => `<a href="${g.items[0][2]}"${g === cur ? ' aria-current="true" class="on"' : ''}>${g.name}</a>`).join('');
  const sub = cur && cur.items.length > 1 ? `\n  <div class="nav-sub-bg"><nav class="wrap nav nav-sub" aria-label="${cur.name}のページ">${cur.items.map(([i, l, h]) => `<a href="${h}"${i === id ? ' aria-current="page"' : ''}>${l}</a>`).join('')}</nav></div>` : '';
  return `<nav class="wrap nav nav-groups" aria-label="メインメニュー">${row1}</nav>${sub}`;
};

// フォント: 全ページ明朝体(Shippori Mincho B1)。デザインシステム側のゴシック体指定は design/overrides.json で上書き
const FONT_URL = 'https://fonts.googleapis.com/css2?family=Shippori+Mincho+B1:wght@400;500;600;700&family=Jost:wght@400;500;600&display=swap';
// Webフォントは描画をブロックしない(media=print → 読み込み後に all)。JSなしでは通常の読み込み
const TOP_FONTS = `<link rel="stylesheet" href="${FONT_URL}" media="print" onload="this.media='all'">\n<noscript><link rel="stylesheet" href="${FONT_URL}"></noscript>`;
const DS_FONTS = TOP_FONTS; // トップ以外も明朝体にそろえる(design/overrides.json)

const jsonLd = (list) => list.map((o) => `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', ...o }).replace(/</g, '\\u003c')}</script>`).join('\n');

function layout({ title, rawTitle, description, keywords, page, path, jsonld = [], noindex = false, body, extraHead = '', scripts = '', wide = false, chrome = true, bodyClass = '' }) {
  const full = rawTitle || `${title} | ${SITE_TITLE}`;
  const url = path ? SITE_URL + path : '';
  const ogType = page === 'column' ? 'article' : 'website';
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#F7FBFD">
<title>${esc(full)}</title>
<meta name="description" content="${esc(description)}">
${keywords ? `<meta name="keywords" content="${esc(keywords.join(','))}">\n` : ''}
${url ? `<link rel="canonical" href="${esc(url)}">\n<meta property="og:url" content="${esc(url)}">\n` : ''}<meta property="og:title" content="${esc(full)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="${esc(SITE_TITLE)}">
<meta property="og:locale" content="ja_JP">
<meta property="og:image" content="${SITE_URL}${OG_IMAGE}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
${page === 'none' || noindex ? '<meta name="robots" content="noindex">\n' : ''}${jsonLd(jsonld)}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
${chrome ? DS_FONTS : TOP_FONTS}
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon-48.png" sizes="48x48" type="image/png">
<link rel="icon" href="/favicon-96.png" sizes="96x96" type="image/png">
<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
<link rel="icon" href="/icon-192.png?v=2" sizes="192x192" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png?v=2">
<link rel="manifest" href="/manifest.json">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="ウェルミー">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<link rel="stylesheet" href="/tokens.css">
${chrome ? '<link rel="stylesheet" href="/ds.css">\n<link rel="stylesheet" href="/header.css">\n' : ''}<link rel="stylesheet" href="/site.css">
${chrome ? '<link rel="stylesheet" href="/ds-pages.css">\n' : ''}${extraHead}
<link rel="stylesheet" href="/brand.css">
</head>
<body data-page="${page}" class="${[chrome ? 'ds' : '', chrome && page !== 'app' ? 'has-rec' : '', bodyClass].filter(Boolean).join(' ')}">
${chrome ? `<header class="site-h">
  <div class="wrap h-in">
    <a class="logo" href="/" aria-label="ウェルミー トップへ">${LOGO}</a>
    ${page === 'app' ? '<span id="demoBadge" class="badge" hidden>デモデータ</span>' : ''}
    <a class="btn sm h-rec" href="/app/#log" data-quicklog>${page === 'app' ? '記録する' : '体調を記録する'}</a>
  </div>
  ${navHtml(page)}
</header>` : ''}
${chrome ? `<main${wide ? '' : ' class="wrap"'}>
${body}
</main>` : body}
${chrome ? `<footer class="site-f">
  <div class="street" data-street aria-hidden="true"></div>
  <div class="wrap">
    <p class="f-logo"><img src="/logo-h.webp" alt="ウェルミー" width="115" height="40"></p>
    <p>本サービスの気圧データは海面気圧の変動傾向を示す目安であり、絶対値の保証や医学的な診断を提供するものではありません。</p>
    <p><a href="/terms.html">利用規約・プライバシー</a> ・ <a href="/about">サービス紹介</a> ・ <a href="/guide">気象病ガイド</a> ・ <a href="/columns">コラム</a> ・ <a href="/weather">週間天気</a> ・ <a href="/today">今日の気圧</a> ・ <a href="/pressure">都道府県別の気圧</a> ・ <a href="/check">気象病セルフチェック</a> ・ <a href="/care">今日の過ごし方</a> ・ <a href="/glossary">用語集</a> ・ <a href="/app/">気圧・記録</a></p>
    <p class="muted">天気: 気象庁 / OpenWeatherMap　© ${SITE}</p>
  </div>
</footer>` : ''}
${chrome && page !== 'app' ? bnav(page) : ''}
${chrome ? STREET_SCRIPT : ''}
<script src="/pwa.js" defer></script>
${scripts}
${chrome ? '<script src="/faces.js"></script>\n<script src="/actions.js" defer></script>' : ''}
</body>
</html>`;
}

/* ---------- 共通パーツ ---------- */

// 地域バー: ふだんは「地域名＋変更」だけのコンパクト表示（地域は初回アクセス時に都道府県単位で自動推定）。
// 「変更」を押すか、推定できなかったときは、従来の選択UI（セレクト＋現在地）を表示する（site.js）。
const areaBar = `<div class="area-bar">
  <div class="area-cur" id="areaCur" hidden><span id="areaName"></span><button type="button" id="areaChange" class="link-btn">変更</button></div>
  <label for="areaSel" class="sr">地域</label>
  <select id="areaSel" aria-label="地域を選ぶ"></select>
  <button type="button" id="locate" class="btn sm" aria-label="現在地の都道府県を選ぶ">📍 現在地</button>
</div>`;

const LEVELS = `<div class="legend" aria-label="気圧変化の凡例">
  <span><i class="dot lv-rise"></i>上昇注意</span><span><i class="dot lv-slight"></i>やや注意</span><span><i class="dot lv-caution"></i>注意</span><span><i class="dot lv-warning"></i>警戒</span>
</div>`;

const secHead2 = (en, ja, id) => `<div class="sx-h"><h2 id="${id}">${en}</h2><p class="ja">${ja}</p></div>`;

// 通知登録CTA（再利用コンポーネント）。クライアント処理は public/actions.js（説明モーダルを1枚挟んでから許可リクエスト）。
// 登録済みの端末ではボタンが「通知はオンです」に切り替わる。
export const notifyCta = () => `<section class="ncta" data-ncta aria-label="通知の登録" hidden>
  <p class="ncta-h">明日が危ない日は、前の晩にお知らせ</p>
  <p class="ncta-d">翌日が「注意」以上の気圧低下のときだけ、毎晩20時に通知します。それ以外の日は送りません。</p>
  <div class="ncta-sample" aria-hidden="true">
    <span class="ncta-ico"><img src="/icon-192.png" alt="" width="34" height="34"></span>
    <span class="ncta-stxt"><b>ウェルミー 気圧アラート</b><span>明日は「注意」の気圧低下の見込みです。早めの休息と、いつもの薬の確認を。</span><small>昨日 20:00</small></span>
  </div>
  <p class="ncta-btnrow"><button type="button" class="btn primary block" data-ncta-btn>通知を受け取る</button></p>
  <p class="muted small ncta-note" data-ncta-note hidden></p>
</section>`;

// モバイルの下部固定ナビ（ホーム／週間／記録／コラム）。現在地のタブをハイライトし、safe-areaに対応。
// 「記録」はワンタップ記録モーダル（public/actions.js）を開き、JSが使えないときは /app/#log へ遷移する。
const BNAV_ICON = {
  home: '<path d="M4 11.5L12 4l8 7.5"/><path d="M6 10v9h12v-9"/>',
  '気圧を見る': '<path d="M3.5 19.5c3-.3 4-6 6.5-6.5s3.5 3.5 6 1.5 3-8.5 4.5-9"/><path d="M3.5 4.5v15.2h17"/>',
  '体調を整える': '<path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z"/>',
  '記録・分析': '<path d="M5 20l.8-4L17.2 4.6a1.8 1.8 0 012.6 2.5L8.4 18.7z"/><path d="M14.5 7.5l2.8 2.8"/>',
  '読む・知る': '<path d="M12 6c-2-1.6-4.5-2-7-2v14c2.5 0 5 .4 7 2 2-1.6 4.5-2 7-2V4c-2.5 0-5 .4-7 2z"/><path d="M12 6v14"/>',
};
// 下部タブ: ホーム + ヘッダーと同じ4つの種類(NAV_GROUPS)。現在のページの種類を強調する
const bnav = (page) => {
  const id = page === 'column' ? 'columns' : page === 'symptom' ? 'guide' : page;
  const cur = NAV_GROUPS.find((g) => g.items.some((i) => i[0] === id));
  const tab = (href, label, icon, on) => `<a href="${href}"${on ? ' aria-current="page"' : ''}><svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg>${label}</a>`;
  return `<nav class="bnav" aria-label="メインメニュー">
  ${tab('/', 'ホーム', BNAV_ICON.home, page === 'top')}
  ${NAV_GROUPS.map((g) => tab(g.items[0][2], g.name, BNAV_ICON[g.name], g === cur)).join('\n  ')}
</nav>`;
};
const secHead = (en, ja, id) => `<div class="sec-h"><p class="en">${en}</p><h2 id="${id}">${ja}</h2></div>`;

const columnCard = (c, i) => `<a class="col-card" href="/columns/${esc(c.slug)}">
  <span class="col-no" aria-hidden="true">${String(COLUMNS.indexOf(c) + 1).padStart(2, '0')}</span>
  <span class="col-body"><b>${esc(c.title)}</b><span class="muted">${esc(c.summary)}</span><small class="muted">約${c.readMin}分で読めます</small></span>
</a>`;

/* ---------- トップ ---------- */

// トップに出すコラム(JSが使えないときの既定の3本。ふだんは18本からランダムに入れ替わる)
const TOP_COLUMNS = ['what-is-kishobyo', 'day-before', 'kiatsu-zutsu'].map((sl) => findColumn(sl)).filter(Boolean);

export function topPage() {
  const footNav = `<a href="/">トップ</a><a href="/weather">週間天気</a><a href="/columns">コラム</a><a href="/guide">気象病ガイド</a><a href="/about">サービス紹介</a><a href="/app/">気圧・記録</a>`;
  const body = `
<div class="stage">
  <aside class="side" aria-label="サイト紹介">
    <div class="side-top">
      <a class="side-logo" href="/" aria-label="ウェルミー トップへ"><img src="/logo-h-white.webp" alt="ウェルミー" width="199" height="70"><small class="logo-sub">今日を知って、心地よく暮らす。</small></a>
      <p class="side-title" aria-hidden="true">気圧の変化を、<br>先回りで知る。</p>
    </div>
    <div class="side-copy">
      <p>天気痛・気象病に備える、気圧予報と頭痛の記録ノート。</p>
      <p>気圧の低下を、前の晩にお知らせする機能を準備中です。</p>
      <p>体調を記録するほど、あなたの<br>「不調になりやすい条件」が見えてきます。</p>
    </div>
    <ol class="side-index" aria-label="このページの内容">
      <li><a href="#today" data-sec="today">Today<small>今日・明日の気圧</small></a></li>
      <li><a href="#exp" data-sec="exp">Experience<small>体験</small></a></li>
      <li><a href="#weekly" data-sec="weekly">Weekly<small>今週の天気</small></a></li>
      <li><a href="#column" data-sec="column">Column<small>コラム</small></a></li>
    </ol>
  </aside>

  <div class="phone" id="phone">
    <section class="m-hero" aria-labelledby="hero-title">
      <h1 id="hero-title" class="m-title">気圧の変化を、<br>先回りで知る。<span class="sr-only">（ウェルミー：天気痛・気象病の気圧予報と頭痛の記録ノート）</span></h1>
      <div class="m-brand">
        <img src="/logo-v-white.webp" alt="ウェルミー" width="241" height="190">
        <span class="m-tag">今日を知って、心地よく暮らす。</span>
      </div>
      <a class="m-scroll" href="#today" aria-label="下へスクロール">SCROLL</a>
    </section>

    <section class="sx cream" id="today" aria-labelledby="t-today">
      <div class="sx-in">
        <img id="todayFig" class="ppl fig-tr fig-live" alt="" aria-hidden="true" hidden>
        ${secHead2('Today', '今日の気圧', 't-today')}
        ${areaBar}
        <div id="tmrwCard" class="card tmrw" aria-live="polite"><p class="muted">読み込み中…</p></div>
        <div id="todayNews" class="news news-sm" aria-live="polite" hidden></div>
        <p class="sx-btn sx-btn2"><a class="btn block" href="/today">全国の地図を見る</a></p>
      </div>
    </section>

    <section class="sx blush" id="exp" aria-labelledby="t-exp">
      <div class="sx-in">
        ${secHead2('Experience', '体験', 't-exp')}
        <div id="hero-root" class="exp-phones"></div>
      </div>
    </section>


    <section class="sx cream" id="weekly" aria-labelledby="t-week">
      <div class="sx-in">
        ${person('runner', { k: 0.5, cls: 'fig-tl' })}
        ${secHead2('Weekly', '今週の天気と気圧', 't-week')}
        <div id="weekStrip" class="strip" aria-live="polite"><p class="muted">読み込み中…</p></div>
        ${LEVELS}
        <p class="sx-btn"><a class="btn dark block" href="/weather">Weekly All</a></p>
        <p class="sx-more"><a href="/today">全国の地図で見る →</a>　<a href="/pressure">都道府県別の気圧予報 →</a></p>
      </div>
    </section>

    <section class="sx blush" id="column" aria-labelledby="t-col">
      <div class="sx-in">
        ${person('hiker', { k: 0.5, cls: 'fig-tr' })}
        ${secHead2('Column', '天気痛・気象病のコラム', 't-col')}
        <ul class="menu" id="colMenu">${TOP_COLUMNS.map((c, i) => `<li><a href="/columns/${esc(c.slug)}"><span class="no">${String(i + 1).padStart(2, '0')}</span><span class="t">${esc(c.title)}</span><span class="m">${c.readMin}分</span></a></li>`).join('')}</ul>
        <script>(function () { // 18本の中から毎回ランダムに3本を表示する(JSが使えないときは、上の3本のまま)
          var L = ${JSON.stringify(COLUMNS.map((c) => [c.slug, c.title, c.readMin])).replace(/</g, '\\u003c')}, ul = document.getElementById('colMenu');
          if (!ul) return;
          for (var i = L.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = L[i]; L[i] = L[j]; L[j] = t; }
          ul.textContent = '';
          L.slice(0, 3).forEach(function (c, n) {
            var li = document.createElement('li'), a = document.createElement('a'); a.href = '/columns/' + c[0];
            [['no', ('0' + (n + 1)).slice(-2)], ['t', c[1]], ['m', c[2] + '分']].forEach(function (x) { var sp = document.createElement('span'); sp.className = x[0]; sp.textContent = x[1]; a.appendChild(sp); });
            li.appendChild(a); ul.appendChild(li);
          });
        })();</script>
        <p class="sx-btn"><a class="btn dark block" href="/columns">Column All</a></p>
        <p class="sx-more"><a href="/guide">気象病ガイド・症状別 →</a>　<a href="/check">気象病セルフチェック →</a></p>
      </div>
    </section>

    <footer class="lp-f">
      <p class="f-logo"><img src="/logo-h.webp" alt="ウェルミー" width="115" height="40"></p>
      <nav class="lp-f-nav">${footNav}</nav>
      <p>本サービスの気圧データは海面気圧の変動傾向を示す目安であり、絶対値の保証や医学的な診断を提供するものではありません。</p>
      <p><a href="/terms.html">利用規約・プライバシー</a></p>
      <p class="muted">天気: 気象庁 / OpenWeatherMap　© ウェルミー</p>
    </footer>
    ${bnav('top')}
  </div>
</div>`;
  return layout({
    rawTitle: `${SITE_TITLE}｜天気痛・気象病の気圧予報と頭痛の記録ノート`,
    description: '天気痛・気象病で気圧の変化に頭痛や不調が出やすい人のための、気圧予報と体調の記録ノート。記録から自分の傾向を見つけます。週間天気・コラムも。無料・登録不要。',
    keywords: COLUMN_KEYWORDS,
    page: 'top',
    path: '/',
    jsonld: [
      { '@type': 'WebSite', name: SITE_TITLE, alternateName: SITE, url: SITE_URL + '/', inLanguage: 'ja' },
      { '@type': 'WebApplication', name: SITE, url: SITE_URL + '/app/', applicationCategory: 'HealthApplication', operatingSystem: 'Web', inLanguage: 'ja', description: '天気痛・気象病の気圧予報と、頭痛・体調の記録ノート', offers: { '@type': 'Offer', price: '0', priceCurrency: 'JPY' } },
    ],
    body,
    chrome: false,
    bodyClass: 'lp',
    extraHead: `<link rel="stylesheet" href="/hero/hero.css">\n${HERO_PICKER}`,
    scripts: '<script src="/wx.js"></script>\n<script src="/site.js" defer></script>\n<script src="/hero/hero.js" defer></script>\n<script src="/faces.js"></script>\n<script src="/actions.js" defer></script>',
  });
}

/* ---------- 週間天気 ---------- */

export function weatherPage(w) {
  const wn = w?.next24, wc = w?.current, wname = w?.area?.name || '';
  const ssrToday = w && wc ? `<div class="t-body"><div class="muted small">${esc(wname)}・現在の海面気圧</div><div class="big">${Math.round(wc.pressure)}<small> hPa</small></div><div>今後24時間：<span class="pill lv-${wn.level}">${esc(wn.label)}</span></div><p class="muted small">最新の値は読み込み後に表示されます。</p></div>` : '<p class="muted">読み込み中…</p>';
  const ssrDays = w?.days?.length ? w.days.map(dayRowHtml).join('') : '<p class="muted">読み込み中…</p>';
  const body = `
<div class="page-head has-ppl"><div class="wrap"><p class="en">WEEKLY FORECAST</p><h1>週間天気</h1><p>気象庁の週間予報に、気圧の変化（4段階）を重ねて表示します。崩れそうな日の前に準備しましょう。</p></div><div class="pg-ppl" aria-hidden="true">${person('runner', { k: 0.5 })}</div></div>
<div class="wrap">
${areaBar}
<p class="map-link"><a href="/today">全国の地図で見る →</a></p>

<div id="today" class="card today" aria-live="polite">${ssrToday}</div>

<section class="sec" aria-labelledby="w-days">
  ${secHead('7 Days', '7日間の予報', 'w-days')}
  <div id="days" class="days" aria-live="polite">${ssrDays}</div>
  ${LEVELS}
  <p class="share-row"><button type="button" id="shareWeekend" class="btn block" hidden>この週末の見通しを共有する</button></p>
  <details class="crit"><summary>表示の見かた・判定基準</summary>
  <p class="muted small">気圧の欄は、その日の予測される最低・最高気圧（海面気圧）と、1時間あたりの最大の低下の段階です。気圧の予報は約5日先までのため、それより先の日は表示されません。「気温差」は、前日の同じ時刻との差が5℃以上、または今後24時間の最高と最低の差が9℃以上で「あり」、8℃以上／12℃以上で「大」とする暫定の目安です。降水は直近24時間または今後24時間の合計が1mm以上で「雨あり」、10mm以上で「まとまった雨」、30mm以上で「雨が多め」、湿度は75%以上で「高め」、85%以上で「かなり高め」としています。いずれも医学的な基準ではありません（表示のみで、通知には使っていません）。「気になる要因」は、気圧・気温差・降水・湿度のうち目安に当てはまるものを並べたものです。</p>
  </details>
</section>

<section class="sec" aria-labelledby="w-hour">
  ${secHead('Hourly', 'これからの3時間ごと', 'w-hour')}
  <div id="hourly" class="strip hourly" aria-live="polite"><p class="muted">読み込み中…</p></div>
</section>

<p><a class="btn primary block" href="/app/">気圧グラフと体調の記録を見る</a></p>
<section class="sec rel-links" aria-labelledby="w-rel"><h2 id="w-rel" class="pg-h">気圧が下がる日に</h2>
  <ul class="plain"><li><a href="/care">今日の過ごし方（体調が崩れやすい日の対策）</a></li><li><a href="/columns/day-before">気圧が下がる前日にできる5つの準備</a></li><li><a href="/symptoms/headache">気圧で起こる頭痛の原因と対処</a>・<a href="/guide">気象病ガイド・症状別</a></li><li><a href="/pressure">都道府県別の気圧予報</a>・<a href="/check">気象病セルフチェック</a></li></ul>
</section>
${notifyCta()}
<p class="disclaimer">天気予報は気象庁、気圧予報は OpenWeatherMap のデータです。海面気圧の変動傾向を示す目安であり、医学的な診断を提供するものではありません。</p>
</div>`;
  return layout({
    title: '週間天気と気圧予報｜今日・明日の気圧と天気痛・気象病の頭痛に備える',
    description: '1週間の天気・気温・降水確率と、気圧が下がる日の目安を都道府県別に確認できます。天気痛・気象病・気圧による頭痛に備えて、崩れる日の前に準備できます。',
    keywords: COLUMN_KEYWORDS,
    page: 'weather',
    path: '/weather',
    jsonld: [
      { '@type': 'WebPage', name: '週間天気と気圧予報', url: SITE_URL + '/weather', inLanguage: 'ja', about: ['気圧', '天気痛', '気象病'], isPartOf: { '@type': 'WebSite', name: SITE, url: SITE_URL } },
      { '@type': 'Dataset', name: '都道府県別の週間天気と気圧予報', description: '全国の天気・気温・降水確率と、気圧の変化(4段階)を10分ごとに更新。', url: SITE_URL + '/weather', inLanguage: 'ja', isAccessibleForFree: true, license: `${SITE_URL}/terms.html`, creator: { '@type': 'Organization', name: SITE, url: SITE_URL }, temporalCoverage: 'P7D', variableMeasured: ['海面気圧(hPa)', '気温', '降水確率'], measurementTechnique: '気象庁・OpenWeatherMap' },
      { '@type': 'BreadcrumbList', itemListElement: [['トップ', '/'], ['週間天気', '/weather']].map(([nm, pth], i) => ({ '@type': 'ListItem', position: i + 1, name: nm, item: SITE_URL + pth })) },
    ],
    body,
    wide: true,
    scripts: '<script src="/wx.js"></script>\n<script src="/faces.js"></script>\n<script src="/site.js" defer></script>',
  });
}

/* ---------- コラム ---------- */

// コラム一覧の分類(全記事がどこかに入ること: test で確認)
export const COL_CATS = [
  ['basic', '基礎知識', '気象病と気圧のしくみ', ['what-is-kishobyo', 'kiatsu-zutsu', 'pressure-pattern', 'tenkitsu-season', 'typhoon-headache']],
  ['care', '備えとセルフケア', '前日の準備・その場の対処・習慣', ['day-before', 'when-it-hurts', 'daily-habits', 'ear-stretch', 'neck-shoulder-stretch']],
  ['symptom', '症状別', '頭痛以外の不調・続くとき', ['sleepy-dizzy', 'old-injury', 'how-long']],
  ['doctor', '受診・薬・記録', '医療機関・市販薬・頭痛ダイアリー', ['when-to-see-doctor', 'which-department', 'otc-medicine', 'headache-diary', 'how-to-use-app']],
];
export function columnsPage() {
  const body = `
<div class="page-head has-ppl"><div class="wrap"><p class="en">COLUMN</p><h1>コラム｜天気痛・気象病</h1><p>気圧の変化による頭痛や不調との付き合い方を、やさしくまとめました。</p></div><div class="pg-ppl" aria-hidden="true">${person('yoga', { k: 0.5 })}</div></div>
<div class="wrap">
<nav class="col-cats" aria-label="分類">${COL_CATS.map(([id, n]) => `<a href="#cat-${id}">${n}</a>`).join('')}</nav>
${COL_CATS.map(([id, n, d, slugs]) => `<section class="col-cat" id="cat-${id}" aria-labelledby="h-${id}"><h2 id="h-${id}" class="pg-h">${n}<small>${d}</small></h2>
<div class="col-list">${slugs.map((sl) => findColumn(sl)).filter(Boolean).map((c) => columnCard(c)).join('')}</div></section>`).join('\n')}
<p class="muted small">症状から探す：${SYMPTOMS.map((y) => `<a href="/symptoms/${y.slug}">${esc(y.name)}</a>`).join('・')}　／　<a href="/guide">気象病ガイド・症状別</a></p>
<p class="disclaimer">コラムは一般的な情報で、診断や治療の代わりにはなりません。症状が強い・続くときは医療機関に相談してください。</p>
</div>`;
  return layout({
    title: 'コラム｜天気痛・気象病・気圧頭痛の対策',
    description: '天気痛・気象病・気圧による頭痛の仕組み、前日の準備、セルフケア、頭痛ダイアリー、季節ごとの特徴、受診の目安までをまとめたコラム。',
    keywords: COLUMN_KEYWORDS,
    page: 'columns',
    path: '/columns',
    jsonld: [{ '@type': 'CollectionPage', name: 'コラム｜天気痛・気象病・気圧と頭痛の対策', url: SITE_URL + '/columns', inLanguage: 'ja', hasPart: COLUMNS.map((c) => ({ '@type': 'Article', headline: c.title, url: `${SITE_URL}/columns/${c.slug}` })) }],
    body,
    wide: true,
  });
}

/* ---------- 都道府県別の気圧(/pressure) ---------- */

const jstHM = (ts) => { const d = new Date(ts + 9 * 3600e3); return `${d.getUTCHours()}時${String(d.getUTCMinutes()).padStart(2, '0')}分`; };
const jstDH = (ts) => { const d = new Date(ts + 9 * 3600e3); return `${d.getUTCDate()}日${d.getUTCHours()}時`; }; // 表の短い日時(例: 23日12時)
const jstMD = (ts) => { const d = new Date(ts + 9 * 3600e3); return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日 ${d.getUTCHours()}時`; };
const sgn = (n) => (n > 0 ? '+' : n < 0 ? '−' : '±');
const LV_ORDER = ['none', 'rise', 'slight', 'caution', 'warning'];

function dayRowHtml(d) {
  const p = d.pressure;
  const lv = p?.level ?? 'none';
  const t = (v) => (v == null ? '–' : `${Math.round(v)}°`);
  return `<div class="day lv-${lv}">
  <div class="d"><b>${esc(d.label)}</b><small>(${esc(d.dow)})</small></div>
  <div class="w"><span>${esc(d.text || '予報なし')}</span></div>
  <div class="t"><span class="hi">${t(d.tmax)}</span> / <span class="lo">${t(d.tmin)}</span>${d.pop != null ? `<small>降水確率 ${d.pop}%</small>` : ''}${d.dtmax != null ? `<small>最高 前日比 ${sgn(d.dtmax)}${Math.abs(d.dtmax)}℃</small>` : ''}</div>
  <div class="p">${p ? `<span class="pill lv-${lv}">気圧 ${esc(p.label)}</span><span>${Math.round(p.min)}〜${Math.round(p.max)} hPa</span>${lv !== 'none' && p.rate != null ? `<span>${jstHM(p.at)}ごろ ${sgn(p.rate)}${Math.abs(p.rate).toFixed(1)}hPa/h</span>` : ''}` : '<span>気圧の予報は約5日先までです</span>'}</div>
</div>`;
}

export function pressurePage(pref, w) {
  const name = pref.name;
  const n = w?.next24 ?? { level: 'none', label: '安定', rate: null, at: null, severe: false };
  const cur = w?.current;
  const risky = (w?.days ?? []).filter((d) => d.pressure && LV_ORDER.indexOf(d.pressure.level) >= 3);
  const near = neighbors(pref);
  const lead = cur
    ? `${name}の現在の海面気圧は約${Math.round(cur.pressure)}hPa${cur.d3 != null ? `（直近3時間で${sgn(cur.d3)}${Math.abs(cur.d3).toFixed(1)}hPa）` : ''}。今後24時間の気圧の変化は「${n.label}」の見込みです。`
    : `${name}の気圧の予報を準備中です。しばらくしてからもう一度ご覧ください。`;
  const detail = n.level !== 'none' && n.rate != null ? `${jstMD(n.at)}ごろに、1時間あたり${sgn(n.rate)}${Math.abs(n.rate).toFixed(1)}hPaの変化が見込まれます。` : n.level === 'none' && cur ? '大きな気圧の変化は見込まれていません。' : '';
  const weekNote = risky.length ? `1週間のうち、気圧が「注意」以上で下がる見込みの日は${risky.map((d) => `${d.label}（${d.dow}）`).join('、')}です。前日の夜に、早めの休息と睡眠、いつもの薬の確認をしておくと安心です。` : '1週間のうち、気圧が「注意」以上で大きく下がる見込みの日は、いまのところありません（気圧の予報は約5日先まで）。';
  const prefFaq = [
    [`${name}の今日の気圧は？`, lead + detail],
    [`${name}で気圧が下がると頭痛が出やすいですか？`, '気圧の低下で頭痛やだるさが出る人がいます（天気痛・気象病）。感じ方には個人差があります。気圧が下がる前日は睡眠と予定の余裕を。'],
    ['気圧のレベルはどう決めていますか？', '1時間あたりの気圧の変化量で、上昇注意・やや注意・注意・警戒の4段階に分けています（気象庁・OpenWeatherMapのデータ）。'],
  ];
  const body = `
<div class="page-head has-ppl"><div class="wrap"><p class="en">PRESSURE · ${esc(regionOf(pref.code))}</p><h1>${esc(name)}の気圧予報｜天気痛・気象病の頭痛の目安</h1><p>${esc(name)}の今日の気圧と1週間の見通しで、天気痛・気象病・気圧による頭痛に備えましょう。</p></div><div class="pg-ppl" aria-hidden="true">${person('reading', { k: 0.5 })}</div></div>
<div class="wrap">
<div class="card today has-fx lv-${n.level}">
  <div class="t-body">
    <div class="muted small">${esc(name)}・今日の気圧${w?.demo ? ' <span class="badge">デモデータ</span>' : ''}${w?.fetchedAt ? `（${jstMD(w.fetchedAt)}更新）` : ''}</div>
    <div class="big">${cur ? Math.round(cur.pressure) : '–'}<small> hPa</small></div>
    <div>今後24時間：<span class="pill lv-${n.level}">${esc(n.label)}</span></div>
    <p>${esc(lead)}${esc(detail)}</p>
  </div>
  <div class="fx-wrap">${moodBlockHtml(w).replace(/(<p class="mood-r">[\s\S]*?<\/p>)/, (m) => m + miniChartHtml(w))}${factorTilesHtml(w)}</div>
</div>
<section class="sec" aria-labelledby="p-days"><h2 id="p-days" class="pg-h">${esc(name)}の7日間の天気と気圧</h2>
  <div class="days">${(w?.days ?? []).map(dayRowHtml).join('')}</div>
  ${LEVELS}
  <p>${esc(weekNote)}</p>
  <details class="crit"><summary>表示の見かた・判定基準</summary>
  <p class="muted small">気圧は海面気圧の変化の目安です（気象庁・OpenWeatherMap）。気温の「気温差」は、前日の同じ時刻との差が5℃以上、または今後24時間の最高と最低の差が9℃以上で「あり」、8℃以上／12℃以上で「大」とする暫定の表示です。降水は直近24時間または今後24時間の合計が1mm以上で「雨あり」、10mm以上で「まとまった雨」、30mm以上で「雨が多め」、湿度は75%以上で「高め」、85%以上で「かなり高め」としています。いずれも医学的な基準ではありません（表示のみで、通知には使っていません）。</p>
  </details>
</section>
<section class="sec" aria-labelledby="p-feat"><h2 id="p-feat" class="pg-h">${esc(name)}の気圧・天気の特徴</h2>
  <p>${esc(PREF_NOTES[pref.code] || '')}</p>
  <p>${esc(regionOf(pref.code))}地方の傾向：${esc(REGION_NOTES[regionOf(pref.code)] || '')}</p>
  <p class="muted small">気象の一般的な特徴をまとめたもので、実際の気圧の動きは、日々の予報（このページ上部）でご確認ください。気圧の変化の感じ方には個人差があります。</p>
</section>
<section class="sec"><h2 class="pg-h">${esc(name)}で天気痛・気象病に備えるには</h2>
  <ul class="plain">
    <li>気圧が下がる前日の夜は、睡眠と予定に余裕を。<a href="/columns/day-before">気圧が下がる前日にできる5つの準備</a></li>
    <li>頭痛が出たら、早めに休んでセルフケアを。<a href="/columns/when-it-hurts">気圧で頭痛・不調を感じたら</a></li>
    <li>頭痛と気圧の関係を知りたいときは。<a href="/columns/kiatsu-zutsu">気圧で頭痛が起こるのはなぜ？</a> ・ <a href="/columns/headache-diary">頭痛ダイアリーのつけ方</a></li>
    <li>仕組みを知りたいときは。<a href="/columns/what-is-kishobyo">気象病（天気痛）とは？</a> ・ <a href="/guide">気象病ガイド・症状別</a></li>
    <li>体調が崩れやすい日は。<a href="/care">今日の過ごし方</a> ・ 症状別：<a href="/symptoms/headache">頭痛</a>・<a href="/symptoms/dizziness">めまい</a>・<a href="/symptoms/fatigue">だるさ</a>・<a href="/symptoms/joint-pain">関節痛</a></li>
    <li>自分の出やすさを知るには。<a href="/check">気象病セルフチェック（10問）</a> ・ <a href="/today">全国の地図</a></li>
  </ul>
  <p class="row"><a class="btn primary" href="/app/">頭痛・体調を記録する</a><a class="btn" href="/weather?area=${pref.code}">${esc(name)}の1時間ごとの気圧を見る</a></p>
</section>
${faqHtml(prefFaq)}
<section class="sec"><h2 class="pg-h">近くの都道府県の気圧予報</h2>
  <ul class="chips-l">${near.map((q) => `<li><a href="/pressure/${q.slug}">${esc(q.name)}</a></li>`).join('')}<li><a href="/pressure">すべての都道府県</a></li></ul>
</section>
${notifyCta()}
<p class="disclaimer">気圧の予報は目安であり、体調の変化を保証したり、診断・治療を行ったりするものではありません。症状が強い・続くときは医療機関に相談してください。</p>
</div>`;
  return layout({
    title: `${name}の気圧予報｜今日・明日の気圧と天気痛・頭痛の目安`,
    description: `${name}の今日の気圧と7日間の天気・気圧の変化を掲載。天気痛・気象病・気圧による頭痛に備えて、気圧が下がる日の前に準備できます。${cur ? `現在は約${Math.round(cur.pressure)}hPa、今後24時間は「${n.label}」。` : ''}`,
    keywords: [`${name} 気圧`, `${name} 天気痛`, `${name} 気象病`, '気圧 頭痛'],
    page: 'pressure',
    path: `/pressure/${pref.slug}`,
    jsonld: [
      { '@type': 'BreadcrumbList', itemListElement: [['トップ', '/'], ['都道府県別の気圧', '/pressure'], [`${name}の気圧予報`, `/pressure/${pref.slug}`]].map(([nm, pth], i) => ({ '@type': 'ListItem', position: i + 1, name: nm, item: SITE_URL + pth })) },
      { '@type': 'WebPage', name: `${name}の気圧予報`, url: `${SITE_URL}/pressure/${pref.slug}`, inLanguage: 'ja', about: ['気圧', '天気痛', '気象病'], isPartOf: { '@type': 'WebSite', name: SITE, url: SITE_URL }, ...(w?.fetchedAt ? { dateModified: new Date(w.fetchedAt).toISOString() } : {}) },
      { '@type': 'Dataset', name: `${name}の気圧予報（海面気圧・7日間）`, description: `${name}の海面気圧(hPa)の実況と予報、1時間あたりの変化量による4段階のレベル。`, url: `${SITE_URL}/pressure/${pref.slug}`, inLanguage: 'ja', isAccessibleForFree: true, license: `${SITE_URL}/terms.html`, creator: { '@type': 'Organization', name: SITE, url: SITE_URL }, spatialCoverage: name, temporalCoverage: 'P7D', variableMeasured: '海面気圧(hPa)', measurementTechnique: '気象庁アメダス観測・OpenWeatherMap予報' },
      faqLd(prefFaq),
    ],
    body,
    wide: true,
  });
}

export function pressureIndexPage() {
  const body = `
<div class="page-head has-ppl"><div class="wrap"><p class="en">PRESSURE BY PREFECTURE</p><h1>都道府県別の気圧予報</h1><p>お住まいの地域を選んで、今日の気圧と1週間の見通しを確認できます。天気痛・気象病・気圧による頭痛の備えに。</p></div><div class="pg-ppl" aria-hidden="true">${person('yukata', { k: 0.5 })}</div></div>
<div class="wrap">
${REGIONS.map(([r, codes]) => `<section class="sec"><h2 class="pg-h">${esc(r)}</h2><ul class="chips-l">${codes.map((c) => PREFS.find((p) => p.code === c)).map((q) => `<li><a href="/pressure/${q.slug}">${esc(q.name)}</a></li>`).join('')}</ul></section>`).join('\n')}
<p class="row"><a class="btn" href="/today">全国の今日の気圧まとめを見る</a></p>
<p class="disclaimer">気圧の予報は目安であり、体調の変化を保証したり、診断・治療を行ったりするものではありません。</p>
</div>`;
  return layout({
    title: '都道府県別の気圧予報｜天気痛・気象病・気圧と頭痛',
    description: '全国47都道府県の今日の気圧と7日間の気圧予報。天気痛・気象病・気圧による頭痛に備えて、お住まいの地域を選べます。',
    keywords: COLUMN_KEYWORDS,
    page: 'pressure',
    path: '/pressure',
    body,
    wide: true,
  });
}

/* ---------- 気圧・記録(/app/) ---------- */

export function appPage() {
  const body = `
<div class="page-head has-ppl app-head"><div class="wrap"><p class="en">PRESSURE &amp; LOG</p><p class="app-h1" role="heading" aria-level="1">気圧・記録</p><p>気圧の予報と、頭痛・体調の記録。自分のパターンを見つけるノートです。</p></div><div class="pg-ppl" aria-hidden="true">${person('reading', { k: 0.5 })}</div></div>
<div class="wrap app-main">
${APP_BODY}
</div>
${APP_TABS}`;
  return layout({
    title: '気圧・記録｜気圧の予報と頭痛・体調の記録',
    description: '気圧の推移と予報を見て、頭痛・症状・服薬を記録できます。記録と気圧の傾向を分析。天気痛・気象病の備えに。',
    page: 'app',
    path: '/app/',
    body,
    wide: true,
    extraHead: '<link rel="stylesheet" href="/style.css">\n<link rel="stylesheet" href="/dash.css">',
    scripts: '<script src="/vendor/chart.js"></script>\n<script src="/wx.js"></script>\n<script src="/faces.js"></script>\n<script src="/app.js" type="module"></script>',
  });
}

/* ---------- 今日の気圧まとめ(/today) ---------- */


// 47都道府県のドット(点描)地図。形は scripts/build-japanmap.py で作った点のデータ(src/japanmap.js)。沖縄は右下に移して並べている。
const DOT_DX = 0.8; // 点の横の間隔(緯度の約37度での、経度と緯度の長さの比)
function dotMapHtml(rows) {
  const rep = Object.fromEntries(rows.map((r) => [r.code, r]));
  const by = new Map();
  for (const [c, r, code] of MAP_DOTS) { const k = String(code).padStart(2, '0'); (by.get(k) || by.set(k, []).get(k)).push([c, r]); }
  const W = (MAP_COLS * DOT_DX).toFixed(1);
  const groups = PREFS.map((pref, i) => {
    const dots = by.get(pref.code) || [];
    const r = rep[repCodeOf(pref.code)];
    const lv = r && r.mood ? r.mood.level : 0;
    const label = `${pref.name}（${r && r.mood ? r.mood.label : '準備中'}）`;
    return `<a class="mp tm-${lv}${i % 2 ? ' alt' : ''}" href="/pressure/${pref.slug}" aria-label="${esc(label)}" data-name="${esc(pref.name)}"><title>${esc(label)}</title>${dots.map(([c, rr]) => `<circle cx="${((c + 0.5) * DOT_DX).toFixed(2)}" cy="${rr + 0.5}" r="0.4"/>`).join('')}</a>`;
  }).join('');
  return `<figure class="dmap"><svg viewBox="0 0 ${W} ${MAP_ROWS}" role="group" aria-label="日本地図(47都道府県)。色は、その地方の代表都市の、今日の体調そらもよう。">${groups}</svg><figcaption id="dmapName" class="muted small" aria-live="polite">県にふれると、名前が出ます。押すと、その県の気圧予報が開きます。</figcaption></figure>
<script>(function(){var f=document.querySelector('.dmap'),c=document.getElementById('dmapName');if(!f)return;var d=c.textContent;function s(e){var a=e.target.closest&&e.target.closest('a.mp');if(a)c.textContent=a.dataset.name+'（'+a.getAttribute('aria-label').split('（')[1].replace('）','')+'）';}f.addEventListener('mouseover',s);f.addEventListener('focusin',s);f.addEventListener('touchstart',s,{passive:true});f.addEventListener('mouseleave',function(){c.textContent=d;});})();</script>`;
}

export function todayPage(sum) {
  const d = new Date(sum.now + 9 * 3600e3);
  const date = `${d.getUTCMonth() + 1}月${d.getUTCDate()}日（${'日月火水木金土'[d.getUTCDay()]}）`;
  const ok = sum.rows.filter((r) => r.ok);
  const alert = ok.filter((r) => r.severity >= 2);
  const slight = ok.filter((r) => r.severity === 1);
  const rise = ok.filter((r) => r.level === 'rise');
  const names = (a) => a.map((r) => `${r.region}（${r.name.replace(/[都府県]$/, '')}）`).join('、');
  const lines = [];
  if (!ok.length) lines.push('全国の気圧データを準備中です。しばらくしてからもう一度ご覧ください。');
  else {
    if (alert.length) lines.push(`今後24時間で、気圧が「注意」以上で下がる見込みの地方は、${names(alert)}です。前日の夜から、睡眠と予定に余裕を持ち、いつもの薬を確認しておくと安心です。`);
    else lines.push('今後24時間で、気圧が「注意」以上で大きく下がる見込みの地方は、代表都市ではありません。');
    if (slight.length) lines.push(`「やや注意」の見込みは、${names(slight)}です。`);
    if (rise.length) lines.push(`気圧が上がる変化（上昇注意）の見込みは、${names(rise)}です。`);
  }
  const pk = (r) => `<tr><th scope="row">${esc(r.region)}<small>${esc(r.name)}</small></th>${r.ok ? `<td>${Math.round(r.pressure)}<small> hPa</small></td><td><span class="pill lv-${r.level}">${esc(r.label)}</span></td><td>${r.rate != null && r.level !== 'none' ? `${jstDH(r.at)}<small>${sgn(r.rate)}${Math.abs(r.rate).toFixed(1)}hPa/h</small>` : '—'}</td>` : '<td colspan="3">準備中</td>'}</tr>`;
  const body = `
<div class="page-head has-ppl"><div class="wrap"><p class="en">TODAY'S PRESSURE</p><h1>全国の地図｜今日の気圧と天気痛の目安（${esc(date)}）</h1><p>全国の主要都市の今日の気圧と、今後24時間の変化。天気痛・気象病・気圧頭痛への備えにどうぞ。</p></div><div class="pg-ppl" aria-hidden="true">${person('jogger', { k: 0.5 })}</div></div>
<div class="wrap">
<section class="sec"><h2 class="pg-h">全国の地図</h2>
<p class="muted small">各県の色は、その県が属する地方の代表都市(北海道=札幌、東北=仙台、関東=東京、中部=名古屋、近畿=大阪、中国=広島、四国=松山、九州=福岡、沖縄=那覇)の、今日の体調そらもようです。県を押すと、その県の気圧予報が開きます。</p>
${dotMapHtml(sum.rows)}
<ul class="tmap-legend" aria-label="色の意味"><li><i class="tm-5"></i>気候が快調</li><li><i class="tm-4"></i>おおむね良好</li><li><i class="tm-3"></i>やや不安定</li><li><i class="tm-2"></i>影響しそう</li><li><i class="tm-1"></i>体調不良に注意</li></ul>
</section>
<section class="sec"><h2 class="pg-h">全国のようす</h2>
${lines.map((l) => `<p>${esc(l)}</p>`).join('\n')}
<div class="tbl-wrap"><table class="tbl"><thead><tr><th>地方（代表都市）</th><th>現在の気圧</th><th>今後24時間</th><th>変化が大きい時間帯</th></tr></thead><tbody>
${sum.rows.map(pk).join('\n')}
</tbody></table></div>
${LEVELS}
<p class="muted small">各地方の県庁所在地の海面気圧をもとにした目安です（気象庁・OpenWeatherMap）。気圧の変化は、1時間あたりのhPaで評価しています。診断や医学的な基準ではありません。</p>
</section>
<section class="sec"><h2 class="pg-h">お住まいの地域を見る</h2>
<p>都道府県ごとの今日の気圧と、7日間の天気・気圧の見通しはこちらです。</p>
<p class="row"><a class="btn primary" href="/pressure">都道府県別の気圧予報</a><a class="btn" href="/weather">週間天気</a><a class="btn" href="/app/">気圧・記録へ</a></p>
</section>
<section class="sec"><h2 class="pg-h">気圧が下がる日の過ごし方</h2>
<ul class="plain">
<li><a href="/columns/day-before">気圧が下がる前日にできる5つの準備</a></li>
<li><a href="/columns/when-it-hurts">気圧で頭痛・不調を感じたら：その場でできるセルフケア</a></li>
<li><a href="/columns/pressure-pattern">気圧が変化する4つのパターン</a></li>
<li><a href="/glossary">天気痛・気象病の用語集</a> ・ <a href="/check">気象病セルフチェック</a></li>
</ul>
</section>
<p class="disclaimer">気圧の予報は目安であり、体調の変化を保証したり、診断・治療を行ったりするものではありません。症状が強い・続くときは医療機関に相談してください。</p>
</div>`;
  return layout({
    title: `全国の地図｜今日の気圧と天気痛の目安（${date}）`,
    description: `${date}の全国の気圧と今後24時間の変化。${alert.length ? `${names(alert)}で気圧が「注意」以上で下がる見込みです。` : '全国の代表都市で、大きく下がる見込みはありません。'}天気痛・気象病・気圧頭痛に備えて。`,
    keywords: ['今日の気圧', '天気痛', '気象病', '気圧 頭痛'],
    page: 'today',
    path: '/today',
    jsonld: [
      { '@type': 'WebPage', name: '全国の地図｜今日の気圧と天気痛の目安', url: SITE_URL + '/today', inLanguage: 'ja', about: ['気圧', '天気痛', '気象病'], isPartOf: { '@type': 'WebSite', name: SITE, url: SITE_URL }, dateModified: new Date().toISOString() },
      { '@type': 'Dataset', name: '全国の今日の気圧と今後24時間の変化', description: '全国の主要地域の現在の気圧と、今後24時間の気圧の変化レベル。', url: SITE_URL + '/today', inLanguage: 'ja', isAccessibleForFree: true, license: `${SITE_URL}/terms.html`, creator: { '@type': 'Organization', name: SITE, url: SITE_URL }, temporalCoverage: 'P1D', spatialCoverage: '日本', variableMeasured: '海面気圧(hPa)' },
      { '@type': 'BreadcrumbList', itemListElement: [['トップ', '/'], ['全国の地図', '/today']].map(([nm, pth], i) => ({ '@type': 'ListItem', position: i + 1, name: nm, item: SITE_URL + pth })) },
    ],
    body,
    wide: true,
  });
}

/* ---------- 気象病セルフチェック(/check) ---------- */

const CHECK_Q = [
  '天気が崩れる前や雨の日に、頭痛が起こりやすい',
  '乗り物（車・バス・船など）に酔いやすい',
  '首や肩のこりが強く、よく頭痛につながる',
  'めまいやふらつき、耳鳴りを感じることがある',
  '台風や低気圧が近づくと、体のだるさや眠気が強くなる',
  '雨の前に、古傷や関節が痛んだりうずいたりする',
  '片頭痛（ズキズキと脈打つ頭痛）と言われたことがある、または思い当たる',
  '睡眠不足や疲れがたまると、天気の影響を受けやすいと感じる',
  '梅雨や季節の変わり目に、気分が落ち込んだりイライラしたりしやすい',
  '「天気予報で気圧が下がる」と聞くと、体調が悪くなりそうで心配になる',
];

export function checkPage() {
  const body = `
<div class="page-head has-ppl"><div class="wrap"><p class="en">SELF CHECK</p><h1>気象病セルフチェック（10問）</h1><p>当てはまるものを選ぶと、天気痛・気象病の「出やすさの傾向」の目安が分かります。診断ではありません。</p></div><div class="pg-ppl" aria-hidden="true">${person('schoolgirl', { k: 0.5 })}</div></div>
<div class="wrap">
<form id="chk" class="chk" novalidate>
<ol class="chk-q">${CHECK_Q.map((q, i) => `<li><fieldset><legend>${esc(q)}</legend><label><input type="radio" name="q${i}" value="1"> 当てはまる</label><label><input type="radio" name="q${i}" value="0"> 当てはまらない</label></fieldset></li>`).join('')}</ol>
<p class="row"><button type="submit" class="btn primary">結果を見る</button><button type="reset" class="btn">やり直す</button></p>
<p id="chkErr" class="muted" role="alert" hidden>すべての質問に答えてください。</p>
</form>
<section id="chkRes" class="card chk-res" hidden aria-live="polite" tabindex="-1">
  <p class="en">RESULT</p>
  <h2 id="chkTitle"></h2>
  <p id="chkScore" class="muted"></p>
  <p id="chkText"></p>
  <ul id="chkLinks" class="plain"></ul>
  <p class="row"><a class="btn primary" href="/app/#log" data-quicklog>体調の記録をはじめる</a><a class="btn" href="/pressure">お住まいの気圧予報</a></p>
  <p class="muted small">もっと知る：<a href="/guide">気象病ガイド・症状別</a>・<a href="/symptoms/headache">頭痛</a>・<a href="/symptoms/dizziness">めまい</a>・<a href="/care">今日の過ごし方</a>・<a href="/columns/which-department">何科を受診する？</a></p>
  ${notifyCta()}
</section>
<p class="disclaimer">このチェックは、医学的に確立した診断基準ではなく、一般的に知られている傾向をもとにした目安です。回答はこの端末の中だけで処理され、保存・送信されません。気になる症状が強い・続くときは、医療機関に相談してください。</p>
</div>`;
  return layout({
    title: '気象病セルフチェック｜天気痛・気圧頭痛の出やすさ診断（10問）',
    description: '10問に答えるだけで、天気痛・気象病・気圧頭痛の出やすさの傾向の目安が分かるセルフチェック。診断ではなく、備えのきっかけに。回答は保存されません。',
    keywords: ['気象病 セルフチェック', '天気痛', '気圧 頭痛', '気象病'],
    page: 'check',
    path: '/check',
    jsonld: [{ '@type': 'WebPage', name: '気象病セルフチェック', url: SITE_URL + '/check', inLanguage: 'ja' }],
    body,
    wide: true,
    scripts: '<script src="/check.js" defer></script>',
  });
}

/* ---------- 今日の対策(/care) ---------- */

export function carePage() {
  const body = `
<div class="page-head has-ppl"><div class="wrap"><p class="en">TODAY'S CARE</p><h1>今日の過ごし方・体調を整える対策</h1><p>気圧・気温差・降水・湿度で体調が崩れやすい日の、セルフケアのまとめです。</p></div><div class="pg-ppl" aria-hidden="true">${person('yoga', { k: 0.5 })}</div></div>
<div class="wrap care-page">
<nav class="crumb" aria-label="パンくず"><a href="/">トップ</a> › <span aria-current="page">今日の過ごし方</span></nav>
<section id="careToday" class="card care-today" hidden aria-live="polite"></section>
<section class="sec"><h2 class="pg-h">要因別の対策</h2>
<p class="muted small">体調そらもようの判定に効いた要因は、「今日の要因」と表示されます。</p>
${Object.entries(CARE_FACTORS).map(([k, f]) => `<article class="care-f" data-f="${k}"><h3>${esc(f.title)}<span class="care-badge" hidden>今日の要因</span></h3><p class="care-why">${esc(f.why)}</p><ul>${f.tips.map((x) => `<li><b>${esc(x.t)}</b><span>${esc(x.d)}</span></li>`).join('')}</ul></article>`).join('\n')}
</section>
<section class="sec"><h2 class="pg-h">時間帯別の過ごし方</h2>
<div class="care-times">${CARE_TIMES.map((x) => `<article><h3>${esc(x.t)}</h3><ul>${x.tips.map((y) => `<li>${esc(y)}</li>`).join('')}</ul></article>`).join('')}</div>
</section>
<section class="sec"><h2 class="pg-h">つらいときは</h2>
<ul class="plain">${CARE_HELP.map((x) => `<li><a href="${x.href}">${esc(x.t)}</a></li>`).join('')}</ul>
<p class="row"><a class="btn primary" href="/app/#log">いまの体調を記録する</a><a class="btn" href="/app/">気圧・記録へ</a></p>
<p class="care-bottom"><a class="btn block" href="/">← トップへ戻る</a></p>
</section>
<p class="disclaimer">ここに載せている内容は、一般的に知られているセルフケアの情報で、医師の監修は受けていません。診断や治療の代わりにはなりません。持病がある方、薬を使っている方は、医師・薬剤師にご相談ください。症状が強い・続くときや、「経験したことのない激しい頭痛」「ろれつが回らない」「手足に力が入らない」などがあるときは、すぐに医療機関を受診してください。</p>
</div>`;
  return layout({
    title: '今日の過ごし方・体調を整える対策｜気圧・気温差・湿度で崩れやすい日に',
    description: '気圧の低下、気温差、雨、湿度で体調が崩れやすい日の、セルフケアのまとめ。要因別・時間帯別の過ごし方と、つらいときの案内。',
    keywords: ['天気痛 対策', '気象病 対策', '気圧 頭痛', 'セルフケア'],
    page: 'care',
    path: '/care',
    jsonld: [{ '@type': 'BreadcrumbList', itemListElement: [['トップ', '/'], ['今日の過ごし方', '/care']].map(([name, pth], i) => ({ '@type': 'ListItem', position: i + 1, name, item: SITE_URL + pth })) }],
    body,
    wide: true,
    scripts: '<script src="/care.js" defer></script>',
  });
}

/* ---------- 用語集(/glossary) ---------- */

export function glossaryPage() {
  const body = `
<div class="page-head has-ppl"><div class="wrap"><p class="en">GLOSSARY</p><h1>用語集｜天気痛・気象病</h1><p>気圧や天気の用語、頭痛のタイプ、本サービスの指標を、やさしく説明します。</p></div><div class="pg-ppl" aria-hidden="true">${person('shopping', { k: 0.5 })}</div></div>
<div class="wrap">
<ul class="chips-l gl-index" aria-label="用語の一覧">${GLOSSARY.map(([t], i) => `<li><a href="#g${i + 1}">${esc(t.replace(/（.*$/, ''))}</a></li>`).join('')}</ul>
<dl class="gl">
${GLOSSARY.map(([t, r, d, slug], i) => `<div class="gl-i" id="g${i + 1}"><dt>${esc(t)}<small>${esc(r)}</small></dt><dd>${esc(d)}${slug && findColumn(slug) ? ` <a href="/columns/${slug}">くわしくはこちら →</a>` : ''}</dd></div>`).join('\n')}
</dl>
<p class="disclaimer">用語の説明は一般的な情報で、診断や治療を目的としたものではありません。</p>
</div>`;
  return layout({
    title: '用語集｜天気痛・気象病・気圧・片頭痛のやさしい解説',
    description: '気象病・天気痛・気圧頭痛、海面気圧、低気圧、前線、台風、内耳、自律神経、片頭痛など、気圧と体調に関する用語をやさしく解説する用語集。',
    keywords: ['天気痛', '気象病', '気圧', '頭痛', '用語集'],
    page: 'glossary',
    path: '/glossary',
    jsonld: [{ '@type': 'DefinedTermSet', name: '天気痛・気象病の用語集', inLanguage: 'ja', url: SITE_URL + '/glossary', hasDefinedTerm: GLOSSARY.map(([t, , d], i) => ({ '@type': 'DefinedTerm', name: t, description: d, url: `${SITE_URL}/glossary#g${i + 1}` })) }],
    body,
    wide: true,
  });
}

/* ---------- サービス紹介 ---------- */

const ABOUT_FEATURES = [
  ['01', '気圧の変化をやさしく予報', '気象庁のアメダスと天気予報、OpenWeatherMapをもとに、お住まいの都道府県の気圧を時間ごとに見られます。グラフには過去の実測と今後の予測が並び、いつ下がるのかが一目で分かります。'],
  ['02', '体調そらもよう(5段階)', '気圧・気温差・降水・湿度の4つを、人物イラストの5段階(気候が快調〜体調不良に注意)とスコア(0〜100)にまとめます。気圧の低下は「上昇注意」「やや注意」「注意」「警戒」の4段階(1時間あたり+1.0hPa以上 / −0.5〜−1.0 / −1.0〜−1.5 / −1.5以下)でも確認できます。暫定の目安で、医学的な基準ではありません。'],
  ['03', '痛み・症状・服薬の記録', '痛みの度合いを6つの顔(痛みなし〜耐えがたい)から選ぶだけで記録できます。頭痛・めまい・だるさ・睡眠の質などの症状、飲んだ薬、メモは「くわしく記録する」から任意で。記録にはそのときの気圧と6時間前との差が自動で添えられ、月間カレンダーでも振り返れます。'],
  ['04', '自分のパターンを見つける分析', '記録と気圧の変化を重ねて、「気圧が下がり始めて何時間後に痛みが出やすいか」などの傾向を振り返れます。通院時に見せられる履歴としても使えます。'],
  ['05', '前の晩のお知らせ(準備中)', '翌日に気圧が大きく動きそうなとき、前の晩にプッシュ通知でお知らせする機能です。受け取るレベル(注意以上 / 警戒のみ)と時刻(17〜23時)を選べる設計ですが、通知の送信は現在準備中です。'],
  ['06', '気象病を防ぐコラム', '天気痛・気象病・気圧頭痛の仕組み、前日の準備、セルフケア、頭痛ダイアリー、受診の目安までを18本の記事で紹介しています。'],
];

const ABOUT_SHOTS = [
  ['app-dash', '01', 'ホーム：明日の気圧と、今日の体調そらもよう', 'いちばん上に「明日の気圧」、その下に気圧・気温・降水・湿度から見た「今日の体調そらもよう」（5段階とスコア）と気圧グラフをまとめて表示します。', ['明日の気圧のレベルとピーク時刻', '気になる要因をチップで表示', '気圧グラフと今日の過ごし方']],
  ['app-log', '02', '記録：顔を1タップするだけ', '「痛みなし」から「耐えがたい」までの6つの顔を選ぶだけで記録できます。症状・服薬・日時・メモは、必要なときだけ「くわしく記録する」から。', ['気圧は自動で一緒に記録', 'マイ薬はワンタップで追加', '過去の日の記録もあとから追加']],
  ['app-cal', '03', 'カレンダー：月ごとに振り返る', '記録のある日には、その日いちばん強い痛みの顔が出ます。記録のない日をタップすると、その日の記録を追加できます。', ['日ごとの痛みをひと目で', 'タップでその日の記録を表示', 'CSVで書き出しも可能']],
  ['app-insight', '04', '分析：気圧と記録を重ねる', '気圧グラフに自分の記録を重ねて表示し、記録が集まると「気圧が下がったあとに不調が出やすいか」を簡単な統計で示します。', ['気圧グラフに記録を重ねて表示', '傾向が出るまでの件数を表示', '通院時の手がかりに']],
];
const ABOUT_PAGES = [
  ['weather', '/weather', '週間天気', '7日間の天気・気温・降水確率と、日ごとの気圧の見通しを一覧できます。'],
  ['columns', '/columns', 'コラム', '天気痛・気象病・気圧頭痛の仕組みやセルフケア、受診の目安を18本の記事で紹介しています。'],
];
const phoneImg = (n, alt) => `<div class="ab-phone"><img src="/about/${n}.webp" alt="${esc(alt)}" width="390" height="780" loading="lazy"></div>`;

const ABOUT_VERBS = [
  ['予測する', 'FORECAST', '気圧の変化を先回りで知る', '気象庁の実測とOpenWeatherMapの予報をもとに、気圧・気温・降水・湿度の変化から、今日の体調への影響を「体調そらもよう」の5段階で表示します。', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 19.5c3-.3 4-6 6.5-6.5s3.5 3.5 6 1.5 3-8.5 4.5-9"/><path d="M3.5 4.5v15.2h17"/></svg>'],
  ['記録する', 'RECORD', '痛みと体調を1タップで残す', '痛みの度合いを顔のアイコンで選んで、まずは1タップ。症状・服薬・メモは、あとから任意で。記録した時刻の気圧も自動で添えられます。', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20l.8-4L17.2 4.6a1.8 1.8 0 012.6 2.5L8.4 18.7z"/><path d="M14.5 7.5l2.8 2.8M4.5 21h15"/></svg>'],
  ['振り返る', 'REVIEW', '自分のパターンを見つける', '月間カレンダーと分析で、気圧が下がったときに不調が出やすいかどうかを確認。受診のときの手がかりにもなります。', '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.3"/><path d="M15.4 15.6l5 5"/></svg>'],
];
const ABOUT_STEPS = [
  ['地域を確認する', '初回は、お住まいの都道府県が自動で入ります。違うときは変更するだけ。アカウント登録もメールアドレスも不要です。'],
  ['今日の見通しを見る', '気圧のグラフと、注意が必要な時間帯を確認します。'],
  ['体調を記録する', 'まずは痛みの度合いを顔で1タップ。症状・服薬は、必要なときだけ「くわしく記録する」に。'],
  ['傾向を振り返る', '続けるほど、自分に合った備え方が見えてきます。'],
];
const ABOUT_FAQ = [
  ['利用料金は?', '無料でお使いいただけます。'],
  ['アカウント登録は必要?', '不要です。端末ごとに匿名のIDで保存されます。'],
  ['どんな個人情報を扱いますか?', '地域は都道府県単位だけで扱います。初回は、アクセス元の回線情報から都道府県だけを自動で推定します(緯度経度は使いません)。「現在地」ボタンを押したときだけ位置情報で都道府県を判定し、座標は保存しません。氏名・メールアドレスは取得しません。詳しくは利用規約・プライバシーをご覧ください。'],
  ['医療アプリですか?', 'いいえ。気圧データは海面気圧の変動傾向を示す目安で、診断や治療の代わりにはなりません。症状が強い・続くときは医療機関にご相談ください。'],
  ['スマホのホーム画面に置けますか?', 'はい。ブラウザの「ホーム画面に追加」でアプリのように使えます。'],
];

export function aboutPage() {
  const body = `
<div class="page-head has-ppl"><div class="wrap"><p class="en">ABOUT</p><h1>サービス紹介｜ウェルミーとは</h1><p>気圧と体調のノート。天気で揺れる体調を、記録と予報でやさしく支えるWebアプリです。</p></div><div class="pg-ppl" aria-hidden="true">${person('reading', { k: 0.5 })}</div></div>
<div class="wrap about">
<section><h2 class="en-h">WHAT YOU CAN DO<small>できること</small></h2>
<div class="ab-verbs">${ABOUT_VERBS.map(([v, en, t, d, ic], i) => `<article class="ab-verb"><span class="ic">${ic}</span><p class="en">${en}</p><h3>${i + 1}. ${esc(v)}</h3><b>${esc(t)}</b><p>${esc(d)}</p></article>`).join('')}</div></section>
<section><h2 class="en-h">SCREENS<small>画面で見る</small></h2>
${ABOUT_SHOTS.map(([n, no, t, d, li], i) => `<div class="ab-shot${i % 2 ? ' rev' : ''}">${phoneImg(n, t)}<div class="ab-txt"><span class="no">${no}</span><h3>${esc(t)}</h3><p>${esc(d)}</p><ul>${li.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div></div>`).join('')}</section>
<section><h2 class="en-h">FEATURES<small>主な機能</small></h2>
<div class="ab-grid">${ABOUT_FEATURES.map(([n, t, d]) => `<article class="ab-card"><span class="no">${n}</span><h3>${esc(t)}</h3><p>${esc(d)}</p></article>`).join('')}</div></section>
<section><h2 class="en-h">HOW TO USE<small>使い方</small></h2>
<ol class="ab-steps">${ABOUT_STEPS.map(([t, d]) => `<li><b>${esc(t)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
<p class="ab-cta"><a class="btn primary" href="/app/">気圧・記録へ</a> <a class="btn" href="/columns/how-to-use-app">くわしい使い方を読む</a></p></section>
<section><h2 class="en-h">FAQ<small>よくある質問</small></h2>
<div class="ab-faq">${ABOUT_FAQ.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div></section>
<p class="disclaimer">本サービスの気圧データは海面気圧の変動傾向を示す目安であり、医学的な診断を提供するものではありません。</p>
</div>`;
  return layout({
    rawTitle: `サービス紹介｜${SITE_TITLE}とは（天気痛・気象病の気圧予報と頭痛の記録アプリ）`,
    description: 'ウェルミーは、天気痛・気象病・気圧による頭痛に備える無料のWebアプリ。気圧予報、頭痛や体調の記録と分析の機能、使い方、よくある質問を紹介します。',
    keywords: COLUMN_KEYWORDS,
    page: 'about',
    path: '/about',
    jsonld: [{ '@type': 'FAQPage', mainEntity: ABOUT_FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }],
    body,
    wide: true,
  });
}

const ref = (t) => esc(t).replace(/\[\[(\/[a-z]+|[a-z-]+)\|([^\]]+)\]\]/g, (_, slug, label) => (slug.startsWith('/') ? `<a href="${slug}">${label}</a>` : findColumn(slug) ? `<a href="/columns/${slug}">${label}</a>` : label));

/* ---------- 用語集の統合(フェーズ3-3): コラム本文の用語から /glossary の該当アンカーへリンク ----------
   記事ごとに各用語の最初の1回だけリンクする。長い用語を優先して照合し（「気圧頭痛」が「気圧」として
   リンクされないように）、既存のリンクの中はさわらない。 */
const GL_TERMS = GLOSSARY
  .map(([t], i) => [t.replace(/（.*$/, ''), i + 1])
  .filter(([t]) => t.length >= 2)
  .sort((a, b) => b[0].length - a[0].length);
function linkTermsInText(text, seen) {
  for (const [term, n] of GL_TERMS) {
    if (seen.has(n)) continue;
    const at = text.indexOf(term);
    if (at < 0) continue;
    seen.add(n);
    return linkTermsInText(text.slice(0, at), seen) + `<a class="gl-ref" href="/glossary#g${n}" title="用語集で「${term}」を見る">${term}</a>` + linkTermsInText(text.slice(at + term.length), seen);
  }
  return text;
}
function linkGlossary(html, seen) {
  let inA = 0;
  return html.split(/(<[^>]*>)/).map((part) => {
    if (part.startsWith('<')) {
      if (/^<a[\s>]/i.test(part)) inA++;
      else if (/^<\/a/i.test(part)) inA = Math.max(0, inA - 1);
      return part;
    }
    return inA || !part ? part : linkTermsInText(part, seen);
  }).join('');
}
function renderBlock(b) {
  if (b.h) return `<h2>${esc(b.h)}</h2>`;
  if (b.p) return `<p>${ref(b.p)}</p>`;
  if (b.ul) return `<ul>${b.ul.map((x) => `<li>${ref(x)}</li>`).join('')}</ul>`;
  if (b.ol) return `<ol>${b.ol.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>`;
  if (b.note) return `<aside class="callout note"><b>メモ</b><p>${ref(b.note)}</p></aside>`;
  if (b.warn) return `<aside class="callout warn" role="note"><b>ご注意</b><p>${ref(b.warn)}</p></aside>`;
  return '';
}

const ARTICLE_FIG = { 'what-is-kishobyo': 'couple', 'day-before': 'hat-bag', 'when-it-hurts': 'reading', 'daily-habits': 'runner', 'how-to-use-app': 'camera', 'when-to-see-doctor': 'family', 'kiatsu-zutsu': 'umbrella', 'tenkitsu-season': 'autumn', 'headache-diary': 'phone-walk', 'how-long': 'reading', 'which-department': 'senior-couple', 'otc-medicine': 'coffee-woman', 'typhoon-headache': 'umbrella', 'sleepy-dizzy': 'phone-man', 'old-injury': 'senior-man', 'pressure-pattern': 'winter-trip', 'ear-stretch': 'yoga', 'neck-shoulder-stretch': 'businessman' };

export function columnPage(slug) {
  const c = findColumn(slug);
  if (!c) return null;
  const i = COLUMNS.indexOf(c);
  const prev = COLUMNS[i - 1];
  const next = COLUMNS[i + 1];
  const ex = COLUMN_EXTRA[c.slug];
  const kw = new Set(c.keywords || []);
  // 関連記事: 前後の記事(ページ下で案内済み)を除き、キーワードの重なりが同じなら「この記事の後ろにある記事」から順に選ぶ。
  // 同じ数本に集中せず、全記事に満遍なくリンクが張られるようにする
  const L = COLUMNS.length;
  const related = COLUMNS.map((x, n) => ({ x, n, sc: Math.min(2, (x.keywords || []).filter((k) => kw.has(k)).length), d: (n - i + L) % L }))
    .filter((o) => o.x !== c && o.x !== prev && o.x !== next)
    .sort((a, b) => b.sc - a.sc || a.d - b.d).slice(0, 3).map((o) => o.x);
  const body = `
<nav class="crumb" aria-label="パンくず"><a href="/">トップ</a> › <a href="/columns">コラム</a></nav>
<article class="article">
  ${person(ARTICLE_FIG[c.slug] || 'hat-bag', { k: 0.6, cls: 'art-fig' })}
  <p class="art-no">COLUMN ${String(i + 1).padStart(2, '0')}</p>
  <h1>${esc(c.title)}</h1>
  <p class="muted small">約${c.readMin}分 ・ 更新 ${COLUMN_UPDATED}</p>
  <p class="lead">${esc(c.summary)}</p>
  ${ex ? `<div class="keypoints" role="note"><p class="kp-h">この記事の要点</p><ul>${ex.points.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>` : ''}
  ${(() => { const seen = new Set(); return c.blocks.map((b) => (b.h ? renderBlock(b) : linkGlossary(renderBlock(b), seen))).join('\n  '); })()}
  ${ex ? `<section class="faq" aria-labelledby="faq-h"><h2 id="faq-h">よくある質問</h2>${ex.faq.map(([q, a]) => `<details class="faq-i"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</section>` : ''}
  <div class="refs"><p class="muted small"><b>執筆・編集</b>：${esc(SITE)}編集部（医師の監修を受けたものではありません）　<b>最終更新</b>：${COLUMN_UPDATED}<br><b>参考情報</b>：気象庁「天気予報・気圧等の観測データ」、日本頭痛学会「頭痛の診療ガイドライン」、各種公開資料をもとに、一般に知られている内容をまとめています。診断や治療の代わりにはなりません。症状が強い・続くときは医療機関に相談してください。</p></div>
</article>
${related.length ? `<section class="related" aria-labelledby="rel-h"><h2 id="rel-h">あわせて読みたい</h2><ul>${related.map((r) => `<li><a href="/columns/${esc(r.slug)}">${esc(r.title)}</a><span class="muted small">${esc(r.summary)}</span></li>`).join('')}</ul></section>` : ''}
<div class="cta card">
  <b>気圧の変化を先回りでチェック</b>
  <p class="muted">今週の天気と気圧、体調の記録は、こちらから。</p>
  <p class="row"><a class="btn primary" href="/weather">週間天気を見る</a><a class="btn" href="/pressure">都道府県別の気圧</a><a class="btn" href="/app/">気圧・記録へ</a></p>
  <p class="muted small">お住まいの地域：<a href="/pressure">都道府県別の気圧予報</a>・<a href="/today">全国の地図</a><br>症状から探す：${SYMPTOMS.map((y) => `<a href="/symptoms/${y.slug}">${esc(y.name)}</a>`).join('・')}　／　<a href="/guide">気象病ガイド</a></p>
</div>
${notifyCta()}
<nav class="pager" aria-label="前後のコラム">
  ${prev ? `<a href="/columns/${esc(prev.slug)}"><small class="muted">← 前の記事</small><b>${esc(prev.title)}</b></a>` : '<span></span>'}
  ${next ? `<a href="/columns/${esc(next.slug)}" class="r"><small class="muted">次の記事 →</small><b>${esc(next.title)}</b></a>` : '<span></span>'}
</nav>
`;
  return layout({
    title: c.title, description: c.summary, keywords: c.keywords || COLUMN_KEYWORDS, page: 'column', path: `/columns/${c.slug}`,
    jsonld: [
      { '@type': 'Article', headline: c.title, description: c.summary, inLanguage: 'ja', dateModified: COLUMN_UPDATED, mainEntityOfPage: `${SITE_URL}/columns/${c.slug}`, image: `${SITE_URL}${OG_IMAGE}`, keywords: (c.keywords || COLUMN_KEYWORDS).join(','), author: { '@type': 'Organization', name: `${SITE}編集部`, url: SITE_URL }, publisher: { '@type': 'Organization', name: SITE, url: SITE_URL, logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon-512.png` } }, datePublished: COLUMN_UPDATED, isAccessibleForFree: true, about: ['気象病', '天気痛', '気圧', '頭痛'], citation: ['気象庁 天気予報・気圧等の観測データ', '日本頭痛学会 頭痛の診療ガイドライン'] },
      ...(ex ? [{ '@type': 'FAQPage', mainEntity: ex.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }] : []),
      { '@type': 'BreadcrumbList', itemListElement: [['トップ', '/'], ['コラム', '/columns'], [c.title, `/columns/${c.slug}`]].map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: SITE_URL + path })) },
    ],
    body,
  });
}

export const notFoundPage = () =>
  layout({
    title: 'ページが見つかりません',
    description: '',
    page: 'none',
    body: '<h1 class="pg-h">ページが見つかりません</h1><p><a class="btn primary" href="/">トップへ戻る</a></p>',
  });


/* ---------- 気象病ガイド(柱ページ)・症状別ページ ---------- */
const colLink = (slug) => { const c = findColumn(slug); return c ? `<li><a href="/columns/${esc(c.slug)}">${esc(c.title)}</a></li>` : ''; };
const faqLd = (list) => ({ '@type': 'FAQPage', mainEntity: list.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) });
const faqHtml = (list) => `<section class="faq" aria-labelledby="faq-h"><h2 id="faq-h">よくある質問</h2>${list.map(([q, a]) => `<details class="faq-i"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</section>`;
const crumbLd = (items) => ({ '@type': 'BreadcrumbList', itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: SITE_URL + path })) });

const GUIDE_FAQ = [
  ['気象病（天気痛）とは何ですか？', '天気、特に気圧の変化に伴って、頭痛・めまい・だるさ・関節や古傷の痛みなどが出る不調の総称です。医学的に確立した診断名ではなく、研究が進められている分野です。'],
  ['なぜ気圧で体調が変わるのですか？', '内耳が気圧の変化を感じ取り、自律神経の働きに影響する、という考え方が有力です。感じ方には大きな個人差があります。'],
  ['気象病への備えで一番大切なことは？', '気圧の予報で「いつ変化するか」を知り、前日から睡眠・水分・予定の余裕を整えることです。記録をつけて自分の傾向を知ることも役立ちます。'],
  ['どんなときに受診すべきですか？', '突然の激しい頭痛、手足のしびれ、ろれつが回らないなどは急いで受診を。頻繁に起こる、生活に支障がある、薬が手放せないときも相談の目安です。'],
];

export function guidePage() {
  const body = `
<div class="page-head has-ppl"><div class="wrap"><p class="en">GUIDE</p><h1>気象病ガイド・症状別｜天気痛・気圧頭痛の原因と対策</h1><p>気象病（天気痛）の基本から、症状別の対処、備え方、受診の目安までをまとめた入口ページです。</p></div></div>
<div class="wrap article-wrap">
<nav class="crumb" aria-label="パンくず"><a href="/">トップ</a> › 気象病ガイド</nav>
<div class="keypoints" role="note"><p class="kp-h">このページの要点</p><ul>
<li>気象病（天気痛）は、気圧など天気の変化で頭痛・めまい・だるさ・関節痛などが出る不調の総称です。</li>
<li>内耳が気圧の変化を感じ取り、自律神経に影響するという考え方が有力ですが、研究途上です。</li>
<li>備えの基本は「気圧の予報を知る → 前日から整える → 記録して傾向を知る」の3つです。</li></ul></div>
<section class="sec"><h2 class="pg-h">気象病（天気痛）とは</h2>
<p>「低気圧が近づくと頭が痛くなる」「雨の前に古傷がうずく」。こうした、天気の変化に伴う不調の総称が気象病です。そのうち、痛みとして現れるものを天気痛と呼びます。同じ気圧の変化でも、平気な人と強く出る人がいて、個人差が大きいのが特徴です。</p>
<p><a href="/columns/what-is-kishobyo">気象病（天気痛）とは？ 気圧の変化で頭痛やだるさが起こる仕組み</a></p></section>
<section class="sec"><h2 class="pg-h">症状別に知る</h2>
<ul class="plain">${SYMPTOMS.map((x) => `<li><a href="/symptoms/${x.slug}"><b>${esc(x.name)}</b></a>：${esc(x.summary)}</li>`).join('')}</ul></section>
<section class="sec"><h2 class="pg-h">気圧が動くのはどんなとき</h2>
<p>気圧は、低気圧の通過、前線、台風、季節による高気圧と低気圧の入れ替わりで動きます。ウェルミーでは、1時間あたりの気圧の変化量で「上昇注意」「やや注意」「注意」「警戒」の4段階に分けて示します。</p>
<ul class="plain">${['pressure-pattern', 'tenkitsu-season', 'typhoon-headache'].map(colLink).join('')}<li><a href="/weather">今週の天気と気圧を見る</a>・<a href="/pressure">都道府県別の気圧予報</a>・<a href="/today">全国の地図</a></li></ul></section>
<section class="sec"><h2 class="pg-h">備えとセルフケア</h2>
<ul class="plain">${['day-before', 'when-it-hurts', 'daily-habits', 'ear-stretch', 'neck-shoulder-stretch'].map(colLink).join('')}<li><a href="/care">今日の過ごし方</a></li></ul></section>
<section class="sec"><h2 class="pg-h">記録して、自分の傾向を知る</h2>
<p>頭痛などの体調を気圧と合わせて記録すると、不調が出やすい条件が見えてきます。受診のときにも役立ちます。</p>
<ul class="plain">${['headache-diary', 'how-to-use-app'].map(colLink).join('')}<li><a href="/check">気象病セルフチェック（10問）</a>・<a href="/app/">気圧・記録</a>・<a href="/about">ウェルミーのサービス紹介</a></li></ul></section>
<section class="sec"><h2 class="pg-h">薬・受診について</h2>
<ul class="plain">${['otc-medicine', 'which-department', 'when-to-see-doctor', 'how-long'].map(colLink).join('')}</ul></section>
${faqHtml(GUIDE_FAQ)}
<div class="refs"><p class="muted small"><b>執筆・編集</b>：${esc(SITE)}編集部（医師の監修を受けたものではありません）　<b>最終更新</b>：${COLUMN_UPDATED}<br><b>参考情報</b>：気象庁、日本頭痛学会「頭痛の診療ガイドライン」など、公開資料をもとに一般に知られている内容をまとめています。診断・治療の代わりにはなりません。</p></div>
</div>`;
  return layout({
    title: '気象病ガイド｜天気痛・気圧頭痛の原因・症状・対策まとめ',
    description: '気象病（天気痛・気圧頭痛）の原因、症状別（頭痛・めまい・だるさ・肩こり・関節痛）の対処、気圧が下がる日の備え、受診の目安を、まとめて解説する入口ページです。',
    keywords: ['気象病', '天気痛', '気圧 頭痛', '低気圧 頭痛', '原因', '対策'], page: 'guide', path: '/guide',
    jsonld: [{ '@type': 'MedicalWebPage', name: '気象病ガイド', url: SITE_URL + '/guide', inLanguage: 'ja', about: { '@type': 'MedicalCondition', name: '気象病（天気痛）' }, dateModified: COLUMN_UPDATED, publisher: { '@type': 'Organization', name: SITE, url: SITE_URL } }, faqLd(GUIDE_FAQ), crumbLd([['トップ', '/'], ['気象病ガイド', '/guide']])],
    body,
  });
}

export function symptomPage(slug) {
  const x = symptomBySlug(slug);
  if (!x) return null;
  const list = (a) => `<ul>${a.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;
  const faq = [...x.faq, ['どんなときは受診しますか？', x.doctor.join(' ')]];
  const body = `
<div class="page-head has-ppl"><div class="wrap"><p class="en">SYMPTOM</p><h1>${esc(x.h1)}</h1><p>${esc(x.summary)}</p></div></div>
<div class="wrap article-wrap">
<nav class="crumb" aria-label="パンくず"><a href="/">トップ</a> › <a href="/guide">気象病ガイド</a> › ${esc(x.name)}</nav>
<div class="keypoints" role="note"><p class="kp-h">このページの要点</p><ul><li>${esc(x.about)}</li><li>気圧の予報で変化の時期を知り、前日から備えることが基本です。</li><li>強い症状や、いつもと違う症状は、医療機関に相談してください。</li></ul></div>
<section class="sec"><h2 class="pg-h">なぜ起こると考えられているか</h2>${list(x.causes)}<p class="muted small">研究途上の分野で、感じ方には大きな個人差があります。</p></section>
<section class="sec"><h2 class="pg-h">自分でできる対処・備え</h2>${list(x.care)}<p class="row"><a class="btn primary" href="/care">今日の過ごし方</a><a class="btn" href="/weather">今週の気圧を見る</a></p></section>
<section class="sec"><h2 class="pg-h">受診を考える目安</h2>${list(x.doctor)}<p class="muted small">迷うときは、医療機関や相談窓口にご相談ください。</p></section>
<section class="sec"><h2 class="pg-h">くわしく読む</h2><ul class="plain">${x.cols.map(colLink).join('')}</ul></section>
${faqHtml(faq)}
<section class="sec"><h2 class="pg-h">ほかの症状</h2><ul class="chips-l">${SYMPTOMS.filter((y) => y !== x).map((y) => `<li><a href="/symptoms/${y.slug}">${esc(y.name)}</a></li>`).join('')}<li><a href="/guide">気象病ガイド</a></li></ul></section>
<div class="refs"><p class="muted small"><b>執筆・編集</b>：${esc(SITE)}編集部（医師の監修を受けたものではありません）　<b>最終更新</b>：${COLUMN_UPDATED}<br>一般的な情報で、診断・治療の代わりにはなりません。</p></div>
</div>`;
  return layout({
    title: `${x.h1}｜原因・対処・受診の目安`,
    description: x.summary,
    keywords: ['気象病', '天気痛', x.name, '気圧'], page: 'symptom', path: `/symptoms/${x.slug}`,
    jsonld: [{ '@type': 'MedicalWebPage', name: x.h1, url: `${SITE_URL}/symptoms/${x.slug}`, inLanguage: 'ja', about: { '@type': 'MedicalSymptom', name: x.name }, dateModified: COLUMN_UPDATED, publisher: { '@type': 'Organization', name: SITE, url: SITE_URL } }, faqLd(faq), crumbLd([['トップ', '/'], ['気象病ガイド', '/guide'], [x.name, `/symptoms/${x.slug}`]])],
    body,
  });
}


/* ---------- 今日の気象病予報(デイリー記事・サンプル) ---------- */
const FACTOR_JA = { past: '過去24時間の気圧低下', pressure: '気圧の変化', temp: '気温差', rain: '雨', hum: '湿度' };
const TOD_JA = (h) => (h < 5 ? '未明' : h < 10 ? '朝' : h < 14 ? '昼' : h < 18 ? '夕方' : '夜');
export function dailyPage(sum) {
  const d = new Date(sum.now + 9 * 3600e3);
  const date = `${d.getUTCMonth() + 1}月${d.getUTCDate()}日（${'日月火水木金土'[d.getUTCDay()]}）`;
  const ymd = d.toISOString().slice(0, 10);
  const rows = sum.rows.filter((r) => r.mood);
  const short = (r) => r.region + (r.region === '北海道' || r.region === '沖縄' ? '' : `（${r.name.replace(/[都府県]$/, '')}）`);
  const bad = rows.filter((r) => r.mood.level <= 2).sort((a, b) => a.mood.score - b.mood.score);
  const mid = rows.filter((r) => r.mood.level === 3);
  const good = rows.filter((r) => r.mood.level >= 4);
  const avg = rows.length ? Math.round(rows.reduce((a, r) => a + r.mood.score, 0) / rows.length) : null;
  const headline = !rows.length ? '全国の体調そらもよう'
    : bad.length ? `${bad.slice(0, 3).map((r) => r.region).join('・')}は体調に注意`
    : mid.length ? `${mid.slice(0, 3).map((r) => r.region).join('・')}はやや不安定` : '全国的に穏やかな一日';
  // いちばん多い要因
  const fc = {}; rows.forEach((r) => r.mood.factors.forEach((f) => { fc[f] = (fc[f] || 0) + (6 - r.mood.level); }));
  const topF = Object.entries(fc).sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const f0 = topF[0];
  // 気圧が動く時間帯
  const byTod = {};
  rows.filter((r) => r.at && r.level !== 'none').forEach((r) => { const h = new Date(r.at + 9 * 3600e3).getUTCHours(); (byTod[TOD_JA(h)] ||= []).push(r); });
  const points = !rows.length ? ['データを準備中です。'] : [
    bad.length ? [1, 2].map((lv) => { const a = bad.filter((r) => r.mood.level === lv); if (!a.length) return ''; const lb = a[0].mood.label; return `${a.slice(0, 4).map((r) => r.region).join('・')}${a.length > 4 ? `など${a.length}地方` : ''}が「${lb}」`; }).filter(Boolean).join('、') + `。無理のない予定を（全国平均スコア ${avg}）。` : `「体調に影響しそう」以上の地方はありません（全国平均スコア ${avg}）。`,
    f0 ? `全国でいちばん効いている要因は「${FACTOR_JA[f0]}」です。` : '目立った要因はありません。',
    Object.keys(byTod).length ? `気圧が動く時間帯：${Object.entries(byTod).map(([t, a]) => `${t}（${a.map((r) => r.region).join('・')}）`).join('、')}。` : '今後24時間、大きな気圧の変化は見込まれていません。',
  ];
  const tips = f0 && CARE_FACTORS[f0] ? CARE_FACTORS[f0].tips.slice(0, 3) : CARE_GENERAL.slice(0, 3);
  // 新聞(レポート)風の本文。である調で、事実(数値)→要因→時間帯→備えの順に書く
  const no = Math.max(1, Math.round((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(2026, 10, 1)) / 864e5) + 1);
  const drops = rows.filter((r) => r.rate != null && r.level !== 'none' && r.rate < 0).sort((x, y) => x.rate - y.rate);
  const big = drops[0];
  const lv1 = rows.filter((r) => r.mood.level === 1), lv2 = rows.filter((r) => r.mood.level === 2);
  const fN = f0 ? rows.filter((r) => r.mood.factors.includes(f0)).length : 0;
  const paras = !rows.length ? ['全国の気圧データを集計中である。しばらくしてから改めて確認してほしい。'] : [
    lv1.length || lv2.length
      ? `${date}は、${lv1.length ? `${lv1.map((r) => r.region).join('、')}で体調そらもようが最も低い「体調不良に注意」となり` : ''}${lv1.length && lv2.length ? '、' : ''}${lv2.length ? `${lv2.map((r) => r.region).join('、')}も「体調に影響しそう」の段階にある` : ''}。全国9地方の平均スコアは${avg}点だった。`
      : `${date}は、全国的に気候の影響が小さい一日となりそうだ。全国9地方の平均スコアは${avg}点で、「体調に影響しそう」以上の地方はない。`,
    f0 ? `体調への影響を押し上げている最大の要因は「${FACTOR_JA[f0]}」で、9地方のうち${fN}地方で該当した。${topF[1] ? `次いで「${FACTOR_JA[topF[1]]}」が多い。` : ''}` : '目立った要因は見当たらない。',
    big ? `気圧の変化が最も大きいのは${short(big)}で、${jstDH(big.at)}ごろに1時間あたり${Math.abs(big.rate).toFixed(1)}hPaの低下が見込まれる。${Object.keys(byTod).length > 1 ? `気圧が動く時間帯は地方によって異なり、${Object.entries(byTod).map(([t, a]) => `${t}は${a.map((r) => r.region).join('・')}`).join('、')}が中心となる。` : ''}` : '今後24時間で、大きな気圧の低下は見込まれていない。',
    f0 ? `頭痛やだるさが出やすい人は、気圧が動く前に睡眠と水分を確保し、予定に余裕を持たせておきたい。` : '生活リズムを整え、いつも通りに過ごしたい。',
  ];
  const TODS = ['未明', '朝', '昼', '夕方', '夜'];
  // 判定バッジ: スコアから導出(スコアが低いほど要注意)
  const judge = (sc) => (sc <= 60 ? ['bad', '要注意'] : sc <= 69 ? ['mid', 'やや不安定'] : sc <= 84 ? ['ok', 'おおむね良好'] : ['good', '気候が快調']);
  const badge = (sc) => { const [k, l] = judge(sc); return `<span class="wp-badge wp-${k}">${l}</span>`; };
  const sorted = [...rows].sort((x, y) => x.mood.score - y.mood.score);
  const pmove = (r) => (r.ok ? `${esc(r.label)}${r.at && r.level !== 'none' ? `（${jstDH(r.at)}ごろ ${sgn(r.rate)}${Math.abs(r.rate).toFixed(1)}hPa/h）` : ''}` : '準備中');
  const ymdJa = `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日（${'日月火水木金土'[d.getUTCDay()]}）`;
  const timing = TODS.filter((t) => byTod[t]).map((t) => `${t}：${byTod[t].map((r) => r.region).join('・')}`);
  const fcount = Object.keys(FACTOR_JA).map((k) => [k, rows.filter((r) => r.mood.factors.includes(k)).length]).filter(([, n]) => n).sort((x, y) => y[1] - x[1]);
  const kanji = ['一', '二', '三'];
  // 天気図(模式図): 地図本体は静的、低・高気圧と前線は当日の代表都市の気圧から配置
  const proj = (lat, lon, code) => { const O = LAND_PROJ.ok; const o = code === '47'; const lo = o ? O.tx + (lon - O.cx) * O.k : lon, la = o ? O.ty + (lat - O.cy) * O.k : lat; return [(lo - LAND_PROJ.lon0) * LAND_PROJ.kx * LAND_PROJ.s, (LAND_PROJ.lat1 - la) * LAND_PROJ.s]; };
  const withP = rows.filter((r) => r.ok && r.pressure != null && r.code !== '47'); // 気圧配置の記号は本州・北海道・四国・九州の上に置く(沖縄は枠内で狭いため)
  const lo = withP.length ? withP.reduce((m, r) => (r.pressure < m.pressure ? r : m)) : null;
  const hi = withP.length ? withP.reduce((m, r) => (r.pressure > m.pressure ? r : m)) : null;
  const sym = (r, k) => { const A = AREA_BY_CODE.get(r.code); const [x, y] = proj(A.lat, A.lon, r.code); const c = k === 'L' ? 'var(--accent)' : 'var(--navy)';
    return `<g class="wm-${k}"><circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="42" fill="none" stroke="${c}" stroke-width="1" opacity=".55"/><circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="74" fill="none" stroke="${c}" stroke-width="1" opacity=".35"/>
<text x="${x.toFixed(0)}" y="${(y + 12).toFixed(0)}" text-anchor="middle" font-size="40" font-weight="800" fill="${c}">${k === 'L' ? '低' : '高'}</text><text x="${x.toFixed(0)}" y="${(y + 40).toFixed(0)}" text-anchor="middle" font-size="18" font-weight="700" fill="${c}">${Math.round(r.pressure)}</text></g>`; };
  const front = lo && big ? (() => { const A = AREA_BY_CODE.get(lo.code); const [x, y] = proj(A.lat, A.lon, lo.code); const p = `M${(x - 20).toFixed(0)} ${(y + 20).toFixed(0)} Q${(x - 120).toFixed(0)} ${(y + 90).toFixed(0)} ${(x - 230).toFixed(0)} ${(y + 140).toFixed(0)}`;
    const tri = [0.2, 0.45, 0.7].map((t) => { const bx = (1 - t) ** 2 * (x - 20) + 2 * (1 - t) * t * (x - 120) + t * t * (x - 230), by = (1 - t) ** 2 * (y + 20) + 2 * (1 - t) * t * (y + 90) + t * t * (y + 140); return `<path d="M${(bx - 9).toFixed(0)} ${(by - 4).toFixed(0)}L${(bx + 9).toFixed(0)} ${(by + 4).toFixed(0)}L${(bx - 4).toFixed(0)} ${(by + 14).toFixed(0)}Z" fill="var(--accent)"/>`; }).join('');
    return `<path d="${p}" fill="none" stroke="var(--accent)" stroke-width="3"/>${tri}`; })() : '';
  const map = `<svg class="wp-map" viewBox="0 0 ${LAND_W} ${LAND_H}" role="img" aria-label="予想天気図(模式図)">
<rect width="${LAND_W}" height="${LAND_H}" fill="var(--sea)"/><rect x="8" y="8" width="170" height="150" fill="none" stroke="var(--hair2)" stroke-dasharray="3 3"/><text x="14" y="24" font-size="11" fill="var(--ink-sub)">沖縄</text>
<g fill="var(--land)" stroke="var(--ink)" stroke-width=".6" stroke-linejoin="round">${LAND_PATHS.map(([, dd]) => `<path d="${dd}"/>`).join('')}</g>
${front}${lo ? sym(lo, 'L') : ''}${hi && hi !== lo ? sym(hi, 'H') : ''}</svg>`;
  const mapCap = lo && hi ? `低気圧は${lo.region}付近（${Math.round(lo.pressure)}hPa）、高気圧は${hi.region}付近（${Math.round(hi.pressure)}hPa）。${big ? `${big.region}を中心に気圧が下がる見込み。` : '大きな気圧の低下は見込まれていない。'}` : '気圧データを集計中。';
  const body = `
<div class="wp">
<div class="wp-run"><span>毎朝更新・自動生成</span><span class="wp-run-c">WEATHER-HEALTH DAILY</span><span>第${no}号</span></div>
<header class="wp-mast">
  <p class="wp-mast-l">気象病予報<br><small>朝刊・全国版</small></p>
  <div class="wp-mast-c"><p class="wp-ruby">ウェルミー</p><p class="wp-title">Welmy <em>Today's Report</em></p><p class="wp-tag">天気で揺れる体調を、紙面でひと目に。</p></div>
  <p class="wp-mast-r">${esc(ymdJa)}<br><small>朝刊</small></p>
</header>
<p class="wp-band">気圧と体調の“そらもよう”、毎朝おとどけ。</p>
<p class="wp-sample">これは「今日の気象病予報」のサンプル紙面です。内容は実際の予報データから自動で作成しています。</p>
<section class="wp-top">
  <div class="wp-head">
    <p class="wp-label">本日の大見出し</p>
    <h1>${esc(headline)}</h1>
    <p class="wp-lead">${esc(paras[0])}</p>
    ${paras[2] ? `<p class="wp-lead2">${esc(paras[2])}</p>` : ''}
  </div>
  <figure class="wp-fig"><figcaption class="wp-cap-t">予想天気図／${d.getUTCMonth() + 1}月${d.getUTCDate()}日</figcaption>${map}<figcaption class="wp-cap-b">${esc(mapCap)}<small>※ 地図上の気圧配置は代表都市の気圧から描いた模式図です。</small></figcaption></figure>
</section>
<section class="wp-stats" aria-label="主な指標">
  <div><p>全国平均スコア</p><b>${avg ?? '–'}<small>／100</small></b></div>
  <div><p>注意が必要な地域</p><b class="wp-acc">${lv1.length + lv2.length}<small>／9</small></b></div>
  <div><p>最大の気圧低下</p><b>${big ? Math.abs(big.rate).toFixed(1) : '–'}<small>hPa/h${big ? `（${esc(big.region)}）` : ''}</small></b></div>
  <div><p>気圧変化のタイミング</p><span class="wp-timing">${timing.length ? timing.map(esc).join('<br>') : '大きな変化なし'}</span></div>
</section>
<section class="wp-main">
  <div class="wp-col">
    <h2 class="wp-h">地域別 そらもよう一覧<small>点数の低い順・各地方の代表都市</small></h2>
    <table class="wp-table"><thead><tr><th scope="col">地域／代表都市</th><th scope="col">点数</th><th scope="col">判定</th><th scope="col">気圧の動き（今後24時間）</th></tr></thead>
    <tbody>${sorted.map((r) => `<tr><th scope="row">${esc(r.region)}<small>${esc(r.name)}</small></th><td class="wp-num">${r.mood.score}</td><td>${badge(r.mood.score)}</td><td>${pmove(r)}</td></tr>`).join('')}</tbody></table>
    <ul class="wp-list">${sorted.map((r) => `<li><div><b>${esc(r.region)}</b><small>${esc(r.name)}</small>${r.at && r.level !== 'none' && r.rate < 0 ? `<span class="wp-sub">気圧低下 ${jstDH(r.at)}ごろ ${Math.abs(r.rate).toFixed(1)}hPa/h</span>` : ''}</div><div class="wp-li-r">${badge(r.mood.score)}<span class="wp-num">${r.mood.score}</span></div></li>`).join('')}</ul>
  </div>
  <aside class="wp-side">
    <section class="wp-box"><h2>要因分析</h2><p>${esc(paras[1])}</p>
      <ul class="wp-fac">${fcount.map(([k, n]) => `<li><span>${esc(FACTOR_JA[k])}</span><i style="--w:${Math.round((n / 9) * 100)}%"></i><b>${n}地域</b></li>`).join('') || '<li><span>目立った要因なし</span></li>'}</ul></section>
    <section class="wp-box"><h2>本日のセルフケア 三か条</h2><ol class="wp-care">${tips.map((x, i) => `<li><span class="wp-maru">${kanji[i]}</span><div><b>${esc(x.t)}</b><p>${esc(x.d)}</p></div></li>`).join('')}</ol>
      <p class="wp-links"><a href="/care">今日の過ごし方をくわしく</a>・<a href="/app/#log" data-quicklog>体調を記録する</a></p></section>
  </aside>
</section>
<section class="wp-legend" aria-label="判定の凡例"><span class="wp-badge wp-bad">要注意</span>60点以下<span class="wp-badge wp-mid">やや不安定</span>61〜69点<span class="wp-badge wp-ok">おおむね良好</span>70〜84点<span class="wp-badge wp-good">気候が快調</span>85点以上</section>
<footer class="wp-foot"><p>【出典】気象庁、OpenWeatherMap。“体調そらもよう”指数は、気圧・気温差・降水・湿度から算出したウェルミー独自の目安で、医学的な診断ではありません。天気図は模式図です。</p><p>関連：<a href="/today">全国の地図</a>・<a href="/weather">週間天気</a>・<a href="/guide">気象病ガイド・症状別</a>・<a href="/columns/day-before">気圧が下がる前日の準備</a></p><p class="wp-pub">発行＝Welmy 編集部</p></footer>
</div>`;
  return layout({
    title: `${date}の気象病予報｜${headline}`,
    description: points.join(' '),
    keywords: ['気象病 予報', '今日 気圧 頭痛', '天気痛', ymd],
    page: 'today', path: '/daily', noindex: true,
    extraHead: '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,800;1,700&family=Shippori+Mincho:wght@500;700;800&family=Noto+Serif+JP:wght@400;600;700&display=swap" rel="stylesheet">\n<link rel="stylesheet" href="/daily.css">',
    jsonld: [{ '@type': 'NewsArticle', headline: `${date}の気象病予報｜${headline}`, datePublished: new Date(sum.now).toISOString(), dateModified: new Date(sum.now).toISOString(), inLanguage: 'ja', author: { '@type': 'Organization', name: `${SITE}編集部` }, publisher: { '@type': 'Organization', name: SITE, url: SITE_URL } }],
    body, wide: true, bodyClass: 'wp-page',
  });
}
