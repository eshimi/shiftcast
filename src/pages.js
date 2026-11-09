// サーバー側で描画するページ（トップ / 週間天気 / コラム）。共通のヘッダー・フッターをここで持つ。
import { COLUMNS, COLUMN_UPDATED, findColumn } from './columns.js';

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const SITE = '気圧ノート';

const NAV = [
  ['/', 'トップ', 'top'],
  ['/weather', '週間天気', 'weather'],
  ['/columns', 'コラム', 'columns'],
];

function layout({ title, description, page, body, extraHead = '', scripts = '', wide = false }) {
  const full = title === SITE ? SITE : `${title} | ${SITE}`;
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#fff9f6">
<title>${esc(full)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:title" content="${esc(full)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Shippori+Mincho+B1:wght@400;500;600;700&display=swap">
<link rel="icon" href="/icon.svg">
<link rel="apple-touch-icon" href="/icon.svg">
<link rel="manifest" href="/manifest.json">
<link rel="stylesheet" href="/header.css">
<link rel="stylesheet" href="/site.css">
${extraHead}
</head>
<body data-page="${page}">
<header class="site-h">
  <div class="wrap h-in">
    <a class="logo" href="/"><img src="/icon.svg" alt="" width="26" height="26"><span>${SITE}</span></a>
    <a class="btn sm primary h-app" href="/app/">アプリを開く</a>
  </div>
  <nav class="wrap nav" aria-label="メインメニュー">
    ${NAV.map(([href, label, id]) => `<a href="${href}"${id === page || (id === 'columns' && page === 'column') ? ' aria-current="page"' : ''}>${label}</a>`).join('')}
    <a href="/app/">気圧・記録</a>
  </nav>
</header>
<main${wide ? '' : ' class="wrap"'}>
${body}
</main>
<footer class="site-f">
  <div class="wrap">
    <p class="f-logo">気圧ノート</p>
    <p>本サービスの気圧データは海面気圧の変動傾向を示す目安であり、絶対値の保証や医学的な診断を提供するものではありません。</p>
    <p><a href="/terms.html">利用規約・プライバシー</a> ・ <a href="/columns">コラム</a> ・ <a href="/weather">週間天気</a> ・ <a href="/app/">アプリ</a></p>
    <p class="muted">天気: 気象庁 / OpenWeatherMap　© ${SITE}</p>
  </div>
</footer>
${scripts}
</body>
</html>`;
}

/* ---------- 共通パーツ ---------- */

const areaBar = `<div class="area-bar">
  <label for="areaSel" class="sr">地域</label>
  <select id="areaSel" aria-label="地域を選ぶ"></select>
  <button type="button" id="locate" class="btn sm" aria-label="現在地の都道府県を選ぶ">📍 現在地</button>
</div>`;

const LEVELS = `<div class="legend" aria-label="気圧変化の凡例">
  <span><i class="dot lv-rise"></i>上昇注意</span><span><i class="dot lv-slight"></i>やや注意</span><span><i class="dot lv-caution"></i>注意</span><span><i class="dot lv-warning"></i>警戒</span>
</div>`;

const secHead = (en, ja, id) => `<div class="sec-h"><p class="en">${en}</p><h2 id="${id}">${ja}</h2></div>`;

const columnCard = (c, i) => `<a class="col-card" href="/columns/${esc(c.slug)}">
  <span class="col-no" aria-hidden="true">${String(COLUMNS.indexOf(c) + 1).padStart(2, '0')}</span>
  <span class="col-body"><b>${esc(c.title)}</b><span class="muted">${esc(c.summary)}</span><small class="muted">約${c.readMin}分で読めます</small></span>
</a>`;

/* ---------- トップ ---------- */

export function topPage() {
  const body = `
<section class="hero" aria-labelledby="hero-title">
  <i class="bub b1" aria-hidden="true"></i><i class="bub b2" aria-hidden="true"></i><i class="bub b3" aria-hidden="true"></i><i class="bub b4" aria-hidden="true"></i><i class="bub b5" aria-hidden="true"></i>
  <div class="wrap">
    <div class="hero-in">
      <div class="hero-copy">
        <p class="hero-brand"><img src="/icon.svg" alt="" width="34" height="34">気圧ノート</p>
        <p class="eyebrow">WEATHER &amp; WELLNESS</p>
        <p class="hero-sub">気圧の低下を前の晩に通知。<br>体調を記録するほど、あなたの「不調になりやすい条件」が見えてきます。</p>
        <p class="hero-btns"><a class="btn dark" href="/app/#log">体調を記録する</a><a class="btn ghost" href="/weather">週間天気を見る</a></p>
      </div>
      <h1 id="hero-title" class="hero-title">気圧の変化を、<br>先回りで知る。</h1>
    </div>
    <div id="hero-root" class="hero-phone"></div>
  </div>
</section>

<section class="band" aria-labelledby="t-today">
  <div class="wrap">
    ${secHead('Today', '今日の気圧', 't-today')}
    ${areaBar}
    <div id="today" class="card today" aria-live="polite"><p class="muted">読み込み中…</p></div>
  </div>
</section>

<section class="band blush" aria-labelledby="t-week">
  <div class="wrap">
    ${secHead('Weekly', '今週の天気と気圧', 't-week')}
    <div id="weekStrip" class="strip" aria-live="polite"><p class="muted">読み込み中…</p></div>
    ${LEVELS}
    <p class="sec-more"><a class="btn dark block" href="/weather">週間天気をひらく</a></p>
  </div>
</section>

<section class="band" aria-labelledby="t-col">
  <div class="wrap">
    ${secHead('Column', '気象病を防ぐコラム', 't-col')}
    <div class="col-list">${COLUMNS.slice(0, 3).map((c) => columnCard(c)).join('')}</div>
    <p class="sec-more"><a class="btn dark block" href="/columns">コラムをすべて見る</a></p>
  </div>
</section>

<section class="band teal" aria-labelledby="t-how">
  <div class="wrap">
    ${secHead('How to', 'はじめかた', 't-how')}
    <ol class="steps">
      <li><b>地域を選ぶ</b><span class="muted">現在地や、よく過ごす地域の気圧の予報を確認します。</span></li>
      <li><b>体調を記録する</b><span class="muted">痛みの度合い・症状・服薬を、ワンタップで残します。</span></li>
      <li><b>傾向を知る</b><span class="muted">記録がたまると「自分が不調になりやすい条件」が見えてきます。</span></li>
      <li><b>前の晩に通知</b><span class="muted">翌日に気圧が大きく下がる見込みのときだけ、お知らせします。</span></li>
    </ol>
    <p><a class="btn block" href="/app/">アプリで気圧・記録を見る</a></p>
  </div>
</section>`;
  return layout({
    title: SITE,
    description: '気圧の変化を先回りで知り、体調を記録して自分の傾向を見つける、気象病セルフケアのサービス。週間天気・コラムも。',
    page: 'top',
    body,
    wide: true,
    extraHead: '<link rel="stylesheet" href="/hero/hero.css">',
    scripts: '<script src="/site.js" defer></script>\n<script src="/hero/hero.js" defer></script>',
  });
}

/* ---------- 週間天気 ---------- */

export function weatherPage() {
  const body = `
<div class="page-head"><div class="wrap"><p class="en">WEEKLY FORECAST</p><h1>週間天気</h1><p>気象庁の週間予報に、気圧の変化（4段階）を重ねて表示します。崩れそうな日の前に準備しましょう。</p></div></div>
<div class="wrap">
${areaBar}

<div id="today" class="card today" aria-live="polite"><p class="muted">読み込み中…</p></div>

<section class="sec" aria-labelledby="w-days">
  ${secHead('7 Days', '7日間の予報', 'w-days')}
  <div id="days" class="days" aria-live="polite"><p class="muted">読み込み中…</p></div>
  ${LEVELS}
  <p class="muted small">気圧の欄は、その日の予測される最低・最高気圧（海面気圧）と、1時間あたりの最大の低下の段階です。気圧の予報は約5日先までのため、それより先の日は表示されません。</p>
</section>

<section class="sec" aria-labelledby="w-hour">
  ${secHead('Hourly', 'これからの3時間ごと', 'w-hour')}
  <div id="hourly" class="strip hourly" aria-live="polite"><p class="muted">読み込み中…</p></div>
</section>

<p><a class="btn primary block" href="/app/">気圧グラフと体調の記録を見る</a></p>
<p class="disclaimer">天気予報は気象庁、気圧予報は OpenWeatherMap のデータです。海面気圧の変動傾向を示す目安であり、医学的な診断を提供するものではありません。</p>
</div>`;
  return layout({
    title: '週間天気と気圧',
    description: '1週間の天気・気温・降水確率と、気圧が下がる日の目安を都道府県別に確認できます。',
    page: 'weather',
    body,
    wide: true,
    scripts: '<script src="/site.js" defer></script>',
  });
}

/* ---------- コラム ---------- */

export function columnsPage() {
  const body = `
<div class="page-head"><div class="wrap"><p class="en">COLUMN</p><h1>気象病を防ぐコラム</h1><p>気圧の変化で崩れる体調との付き合い方を、やさしくまとめました。</p></div></div>
<div class="wrap">
<div class="col-list">${COLUMNS.map((c) => columnCard(c)).join('')}</div>
<p class="disclaimer">コラムは一般的な情報で、診断や治療の代わりにはなりません。症状が強い・続くときは医療機関に相談してください。</p>
</div>`;
  return layout({
    title: 'コラム｜気象病を防ぐ方法',
    description: '気象病（天気痛）の仕組み、前日の準備、不調を感じたときのセルフケア、受診の目安までをまとめたコラム。',
    page: 'columns',
    body,
    wide: true,
  });
}

function renderBlock(b) {
  if (b.h) return `<h2>${esc(b.h)}</h2>`;
  if (b.p) return `<p>${esc(b.p)}</p>`;
  if (b.ul) return `<ul>${b.ul.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
  if (b.ol) return `<ol>${b.ol.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>`;
  if (b.note) return `<aside class="callout note"><b>メモ</b><p>${esc(b.note)}</p></aside>`;
  if (b.warn) return `<aside class="callout warn" role="note"><b>ご注意</b><p>${esc(b.warn)}</p></aside>`;
  return '';
}

export function columnPage(slug) {
  const c = findColumn(slug);
  if (!c) return null;
  const i = COLUMNS.indexOf(c);
  const prev = COLUMNS[i - 1];
  const next = COLUMNS[i + 1];
  const body = `
<nav class="crumb" aria-label="パンくず"><a href="/">トップ</a> › <a href="/columns">コラム</a></nav>
<article class="article">
  <p class="art-no">COLUMN ${String(i + 1).padStart(2, '0')}</p>
  <h1>${esc(c.title)}</h1>
  <p class="muted small">約${c.readMin}分 ・ 更新 ${COLUMN_UPDATED}</p>
  <p class="lead">${esc(c.summary)}</p>
  ${c.blocks.map(renderBlock).join('\n  ')}
</article>
<div class="cta card">
  <b>気圧の変化を先回りでチェック</b>
  <p class="muted">今週の天気と気圧、体調の記録は、こちらから。</p>
  <p class="row"><a class="btn primary" href="/weather">週間天気を見る</a><a class="btn" href="/app/">アプリを開く</a></p>
</div>
<nav class="pager" aria-label="前後のコラム">
  ${prev ? `<a href="/columns/${esc(prev.slug)}"><small class="muted">← 前の記事</small><b>${esc(prev.title)}</b></a>` : '<span></span>'}
  ${next ? `<a href="/columns/${esc(next.slug)}" class="r"><small class="muted">次の記事 →</small><b>${esc(next.title)}</b></a>` : '<span></span>'}
</nav>
<p class="disclaimer">このコラムは一般的な情報で、診断や治療の代わりにはなりません。症状が強い・続くときは医療機関に相談してください。</p>`;
  return layout({ title: c.title, description: c.summary, page: 'column', body });
}

export const notFoundPage = () =>
  layout({
    title: 'ページが見つかりません',
    description: '',
    page: 'none',
    body: '<h1 class="pg-h">ページが見つかりません</h1><p><a class="btn primary" href="/">トップへ戻る</a></p>',
  });
