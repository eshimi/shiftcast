// サーバー側で描画するページ（トップ / 週間天気 / コラム）。共通のヘッダー・フッターをここで持つ。
import { COLUMNS, COLUMN_UPDATED, findColumn } from './columns.js';

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const SITE = 'Rio²（リオリオ）';
const TAGLINE = '気圧と体調のノート';
const LOGO = '<span class="ln"><b>Rio<sup>2</sup></b><small>リオリオ</small></span>';

const NAV = [
  ['/', 'トップ', 'top'],
  ['/weather', '週間天気', 'weather'],
  ['/columns', 'コラム', 'columns'],
];

function layout({ title, description, page, body, extraHead = '', scripts = '', wide = false, chrome = true, bodyClass = '' }) {
  const full = title === SITE ? `${SITE}｜${TAGLINE}` : `${title} | ${SITE}`;
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
<body data-page="${page}"${bodyClass ? ` class="${bodyClass}"` : ''}>
${chrome ? `<header class="site-h">
  <div class="wrap h-in">
    <a class="logo" href="/" aria-label="Rio²（リオリオ） トップへ"><img src="/icon.svg" alt="" width="36" height="36">${LOGO}</a>
    <a class="btn sm primary h-app" href="/app/">アプリを開く</a>
  </div>
  <nav class="wrap nav" aria-label="メインメニュー">
    ${NAV.map(([href, label, id]) => `<a href="${href}"${id === page || (id === 'columns' && page === 'column') ? ' aria-current="page"' : ''}>${label}</a>`).join('')}
    <a href="/app/">気圧・記録</a>
  </nav>
</header>` : ''}
${chrome ? `<main${wide ? '' : ' class="wrap"'}>
${body}
</main>` : body}
${chrome ? `<footer class="site-f">
  <div class="wrap">
    <p class="f-logo">Rio<sup>2</sup>（リオリオ）</p>
    <p>本サービスの気圧データは海面気圧の変動傾向を示す目安であり、絶対値の保証や医学的な診断を提供するものではありません。</p>
    <p><a href="/terms.html">利用規約・プライバシー</a> ・ <a href="/columns">コラム</a> ・ <a href="/weather">週間天気</a> ・ <a href="/app/">アプリ</a></p>
    <p class="muted">天気: 気象庁 / OpenWeatherMap　© ${SITE}</p>
  </div>
</footer>` : ''}
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

const secHead2 = (en, ja, id) => `<div class="sx-h"><h2 id="${id}">${en}</h2><p class="ja">${ja}</p></div>`;
const secHead = (en, ja, id) => `<div class="sec-h"><p class="en">${en}</p><h2 id="${id}">${ja}</h2></div>`;

const columnCard = (c, i) => `<a class="col-card" href="/columns/${esc(c.slug)}">
  <span class="col-no" aria-hidden="true">${String(COLUMNS.indexOf(c) + 1).padStart(2, '0')}</span>
  <span class="col-body"><b>${esc(c.title)}</b><span class="muted">${esc(c.summary)}</span><small class="muted">約${c.readMin}分で読めます</small></span>
</a>`;

/* ---------- トップ ---------- */

export function topPage() {
  const nav = `<a href="/">トップ</a><a href="/weather">週間天気</a><a href="/columns">コラム</a><a href="/app/">気圧・記録</a>`;
  const body = `
<div class="stage">
  <aside class="side" aria-label="サイト紹介">
    <div class="side-top">
      <a class="side-logo" href="/" aria-label="Rio²（リオリオ） トップへ"><img src="/icon.svg" alt="" width="84" height="84"><span class="brand-ln"><b>Rio<sup>2</sup></b><small>リオリオ</small></span></a>
      <p class="side-title" aria-hidden="true">気圧の変化を、<br>先回りで知る。</p>
    </div>
    <div class="side-copy">
      <p>気圧の低下を前の晩に通知。</p>
      <p>体調を記録するほど、あなたの<br>「不調になりやすい条件」が見えてきます。</p>
    </div>
    <nav class="side-nav" aria-label="メインメニュー">${nav}<a class="btn dark sm" href="/app/">アプリを開く ↗</a></nav>
  </aside>

  <div class="phone" id="phone">
    <section class="m-hero" aria-labelledby="hero-title">
      <nav class="m-nav" aria-label="メインメニュー"><a href="/weather">週間天気</a><a href="/columns">コラム</a><a class="m-app" href="/app/">アプリを開く</a></nav>
      <h1 id="hero-title" class="m-title">気圧の変化を、<br>先回りで知る。</h1>
      <div class="m-brand">
        <img src="/icon.svg" alt="" width="56" height="56">
        <span class="m-word">Rio<sup>2</sup></span>
        <span class="m-read">リオリオ</span>
        <span class="m-tag">気圧と体調のノート</span>
      </div>
      <a class="m-scroll" href="#today" aria-label="下へスクロール">SCROLL</a>
    </section>

    <section class="sx cream" id="today" aria-labelledby="t-today">
      <div class="sx-in">
        ${secHead2('Today', '今日の気圧', 't-today')}
        ${areaBar}
        <div id="todayNews" class="news" aria-live="polite"><p class="muted">読み込み中…</p></div>
        <p class="sx-btn"><a class="btn dark block" href="/app/">気圧グラフを見る</a></p>
      </div>
    </section>

    <section class="sx blush" aria-labelledby="t-exp">
      <div class="sx-in">
        ${secHead2('Experience', '体験', 't-exp')}
        <svg class="arc" viewBox="0 0 340 96" role="img" aria-label="Calm in Every Change">
          <defs><path id="arc1" d="M8 78 Q170 -16 332 78"/></defs>
          <text><textPath href="#arc1" startOffset="50%" text-anchor="middle">Calm in Every Change</textPath></text>
        </svg>
        <div class="poem">
          <p>「気圧」「天気」「体調」の三つが、<br>ひとつのノートに重なります。</p>
          <p>低気圧が近づく前の晩に、<br>そっと知らせてくれる。</p>
          <p>痛みやだるさは、ワンタップで記録。<br>重ねるほど、あなたの<br>「なりやすい条件」が見えてくる。</p>
          <p>“ああ”と空を見上げるその前に、<br>備えられる毎日を。</p>
        </div>
        <div id="hero-root" class="exp-phones"></div>
      </div>
    </section>

    <section class="sx teal" aria-labelledby="t-three">
      <div class="sx-in">
        ${secHead2('Three Features', '三つの機能', 't-three')}
        <p class="center-copy">Rio²は、週間天気、気圧・記録、コラムの<br>三つで、気圧との付き合いを支えます。</p>
        <a class="feat" href="/weather" style="--pos: 8% 78%; --zoom: 300%"><span class="en">WEEKLY FORECAST</span><b>週間天気</b><span class="d">1週間の天気と、気圧が下がる日の目安</span></a>
        <a class="feat" href="/app/" style="--pos: 86% 18%; --zoom: 280%"><span class="en">PRESSURE &amp; LOG</span><b>気圧・記録</b><span class="d">気圧グラフに、体調の記録を重ねて見る</span></a>
        <a class="feat" href="/columns" style="--pos: 48% 52%; --zoom: 320%"><span class="en">COLUMN</span><b>コラム</b><span class="d">気象病を防ぐ、暮らしのヒント</span></a>
      </div>
    </section>

    <section class="sx cream" aria-labelledby="t-week">
      <div class="sx-in">
        ${secHead2('Weekly', '今週の天気と気圧', 't-week')}
        <div id="weekStrip" class="strip" aria-live="polite"><p class="muted">読み込み中…</p></div>
        ${LEVELS}
        <p class="sx-btn"><a class="btn dark block" href="/weather">Weekly All</a></p>
      </div>
    </section>

    <section class="sx blush" aria-labelledby="t-col">
      <div class="sx-in">
        ${secHead2('Column', '気象病を防ぐコラム', 't-col')}
        <ul class="menu">${COLUMNS.map((c, i) => `<li><a href="/columns/${esc(c.slug)}"><span class="no">${String(i + 1).padStart(2, '0')}</span><span class="t">${esc(c.title)}</span><span class="m">${c.readMin}分</span></a></li>`).join('')}</ul>
        <p class="sx-btn"><a class="btn dark block" href="/columns">Column All</a></p>
      </div>
    </section>

    <section class="sx cream" aria-labelledby="t-info">
      <div class="sx-in">
        ${secHead2('Information', 'サービス情報', 't-info')}
        <dl class="info">
          <div><dt>サービス名</dt><dd>Rio²（リオリオ）</dd></div>
          <div><dt>できること</dt><dd>気圧の予報、週間天気、体調の記録、傾向の分析、前夜の通知</dd></div>
          <div><dt>データ</dt><dd>天気：気象庁、気圧予報：OpenWeatherMap</dd></div>
          <div><dt>対応地域</dt><dd>全国47都道府県</dd></div>
          <div><dt>通知</dt><dd>毎晩20時（日本時間）。翌日に「注意」以上の気圧低下が見込まれるとき</dd></div>
          <div><dt>料金</dt><dd>現在は無料</dd></div>
          <div><dt>プライバシー</dt><dd>氏名・メールは不要。位置情報は都道府県単位でのみ使用</dd></div>
        </dl>
        <p class="note-s">気圧は海面気圧の変動傾向を示す目安であり、医学的な診断を提供するものではありません。</p>
      </div>
    </section>

    <section class="sx teal start" aria-labelledby="t-start">
      <div class="sx-in">
        ${secHead2('Start', 'はじめる', 't-start')}
        <p class="center-copy">地域を選んで、今日の気圧を確認。<br>体調を記録して、自分の傾向を見つけましょう。</p>
        <p class="sx-btn"><a class="btn cream block" href="/app/">アプリを開く</a></p>
        <p class="sx-btn"><a class="btn ghost block" href="/app/#log">体調を記録する</a></p>
      </div>
    </section>

    <footer class="lp-f">
      <p class="f-logo">Rio<sup>2</sup>（リオリオ）</p>
      <nav class="lp-f-nav">${nav}</nav>
      <p>本サービスの気圧データは海面気圧の変動傾向を示す目安であり、絶対値の保証や医学的な診断を提供するものではありません。</p>
      <p><a href="/terms.html">利用規約・プライバシー</a></p>
      <p class="muted">天気: 気象庁 / OpenWeatherMap　© Rio²（リオリオ）</p>
    </footer>
  </div>
</div>`;
  return layout({
    title: SITE,
    description: '気圧の変化を先回りで知り、体調を記録して自分の傾向を見つける、気象病セルフケアのサービス。週間天気・コラムも。',
    page: 'top',
    body,
    chrome: false,
    bodyClass: 'lp',
    extraHead: '<link rel="stylesheet" href="/hero/hero.css">\n<link rel="preload" as="image" href="/hero/hero-sky.webp">',
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
