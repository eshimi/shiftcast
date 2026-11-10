// サーバー側で描画するページ（トップ / 週間天気 / コラム）。共通のヘッダー・フッターをここで持つ。
import { COLUMNS, COLUMN_UPDATED, findColumn } from './columns.js';
import { PEOPLE, PERSON } from './people.js';

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const SITE = 'Rio²（リオリオ）';
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
  // 画面の幅に収まる人数だけ、重複なしでランダムに選ぶ（はみ出さない・重ならない）
  var room = Math.min(window.innerWidth, 1100) - 40, used = 0, picked = [], tries = 0;
  while (tries++ < 80 && picked.length < 8) {
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

const LOGO = '<span class="ln"><b>Rio<sup>2</sup></b><small>リオリオ</small></span>';

const NAV = [
  ['/', 'トップ', 'top'],
  ['/weather', '週間天気', 'weather'],
  ['/columns', 'コラム', 'columns'],
  ['/about', 'サービス紹介', 'about'],
];

// フォント: 全ページ明朝体(Shippori Mincho B1)。デザインシステム側のゴシック体指定は design/overrides.json で上書き
const TOP_FONTS = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Shippori+Mincho+B1:wght@400;500;600;700&display=swap">';
const DS_FONTS = TOP_FONTS; // トップ以外も明朝体にそろえる(design/overrides.json)

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
${chrome ? DS_FONTS : TOP_FONTS}
<link rel="icon" href="/icon.svg">
<link rel="apple-touch-icon" href="/icon.svg">
<link rel="manifest" href="/manifest.json">
${chrome ? '<link rel="stylesheet" href="/ds.css">\n<link rel="stylesheet" href="/header.css">\n' : ''}<link rel="stylesheet" href="/site.css">
${chrome ? '<link rel="stylesheet" href="/ds-pages.css">\n' : ''}${extraHead}
</head>
<body data-page="${page}" class="${[chrome ? 'ds' : '', bodyClass].filter(Boolean).join(' ')}">
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
  <div class="street" data-street aria-hidden="true"></div>
  <div class="wrap">
    <p class="f-logo">Rio<sup>2</sup>（リオリオ）</p>
    <p>本サービスの気圧データは海面気圧の変動傾向を示す目安であり、絶対値の保証や医学的な診断を提供するものではありません。</p>
    <p><a href="/terms.html">利用規約・プライバシー</a> ・ <a href="/about">サービス紹介</a> ・ <a href="/columns">コラム</a> ・ <a href="/weather">週間天気</a> ・ <a href="/app/">アプリ</a></p>
    <p class="muted">天気: 気象庁 / OpenWeatherMap　© ${SITE}</p>
  </div>
</footer>` : ''}
${chrome ? STREET_SCRIPT : ''}
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
  const nav = `<a href="/">トップ</a><a href="/weather">週間天気</a><a href="/about">サービス紹介</a><a href="/columns">コラム</a><a href="/app/">気圧・記録</a>`;
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
    <ol class="side-index" aria-label="このページの内容">
      <li><a href="#today" data-sec="today">Today<small>今日の気圧</small></a></li>
      <li><a href="#exp" data-sec="exp">Experience<small>体験</small></a></li>
      <li><a href="#features" data-sec="features">Three Features<small>三つの機能</small></a></li>
      <li><a href="#weekly" data-sec="weekly">Weekly<small>今週の天気</small></a></li>
      <li><a href="#column" data-sec="column">Column<small>コラム</small></a></li>
      <li><a href="#info" data-sec="info">Information<small>サービス情報</small></a></li>
      <li><a href="#start" data-sec="start">Start<small>はじめる</small></a></li>
    </ol>
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
        <img id="todayFig" class="ppl fig-tr fig-live" alt="" aria-hidden="true" hidden>
        ${secHead2('Today', '今日の気圧', 't-today')}
        ${areaBar}
        <div id="todayNews" class="news" aria-live="polite"><p class="muted">読み込み中…</p></div>
        <p class="sx-btn"><a class="btn dark block" href="/app/">気圧グラフを見る</a></p>
      </div>
    </section>

    <section class="sx blush" id="exp" aria-labelledby="t-exp">
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
        <div class="ppl-row r" aria-hidden="true">${person('yoga', { k: 0.55 })}${person('reading', { k: 0.55 })}</div>
        <div id="hero-root" class="exp-phones"></div>
      </div>
    </section>

    <section class="sx teal" id="features" aria-labelledby="t-three">
      <div class="sx-in">
        ${secHead2('Three Features', '三つの機能', 't-three')}
        <p class="center-copy">Rio²は、週間天気、気圧・記録、コラムの<br>三つで、気圧との付き合いを支えます。</p>
        <a class="feat" href="/weather" style="--img: url('/hero/bg/mist.webp'); --pos: 30% 50%"><span class="en">WEEKLY FORECAST</span><b>週間天気</b><span class="d">1週間の天気と、気圧が下がる日の目安</span></a>
        <a class="feat" href="/app/" style="--img: url('/hero/bg/dusk.webp'); --pos: 41% 40%"><span class="en">PRESSURE &amp; LOG</span><b>気圧・記録</b><span class="d">気圧グラフに、体調の記録を重ねて見る</span></a>
        <a class="feat" href="/columns" style="--img: url('/hero/bg/sea.webp'); --pos: 58% 58%"><span class="en">COLUMN</span><b>コラム</b><span class="d">気象病を防ぐ、暮らしのヒント</span></a>
      </div>
    </section>

    <section class="sx cream" id="weekly" aria-labelledby="t-week">
      <div class="sx-in">
        ${person('runner', { k: 0.5, cls: 'fig-tl' })}
        ${secHead2('Weekly', '今週の天気と気圧', 't-week')}
        <div id="weekStrip" class="strip" aria-live="polite"><p class="muted">読み込み中…</p></div>
        ${LEVELS}
        <p class="sx-btn"><a class="btn dark block" href="/weather">Weekly All</a></p>
      </div>
    </section>

    <section class="sx blush" id="column" aria-labelledby="t-col">
      <div class="sx-in">
        ${person('hiker', { k: 0.5, cls: 'fig-tr' })}
        ${secHead2('Column', '気象病を防ぐコラム', 't-col')}
        <ul class="menu">${COLUMNS.map((c, i) => `<li><a href="/columns/${esc(c.slug)}"><span class="no">${String(i + 1).padStart(2, '0')}</span><span class="t">${esc(c.title)}</span><span class="m">${c.readMin}分</span></a></li>`).join('')}</ul>
        <p class="sx-btn"><a class="btn dark block" href="/columns">Column All</a></p>
      </div>
    </section>

    <section class="sx cream room" id="info" aria-labelledby="t-info">
      <div class="sx-in">
        ${person('suitcase', { k: 0.5, cls: 'fig-tr' })}
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

    <section class="sx teal start" id="start" aria-labelledby="t-start">
      <span class="walker" aria-hidden="true">${person('family', { k: 0.62 })}</span>
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
    extraHead: `<link rel="stylesheet" href="/hero/hero.css">\n${HERO_PICKER}`,
    scripts: '<script src="/wx.js"></script>\n<script src="/site.js" defer></script>\n<script src="/hero/hero.js" defer></script>',
  });
}

/* ---------- 週間天気 ---------- */

export function weatherPage() {
  const body = `
<div class="page-head has-ppl"><div class="wrap"><p class="en">WEEKLY FORECAST</p><h1>週間天気</h1><p>気象庁の週間予報に、気圧の変化（4段階）を重ねて表示します。崩れそうな日の前に準備しましょう。</p></div><div class="pg-ppl" aria-hidden="true">${person('hat-bag', { k: 0.5 })}${person('runner', { k: 0.5 })}${person('umbrella', { k: 0.5 })}</div></div>
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
    scripts: '<script src="/wx.js"></script>\n<script src="/faces.js"></script>\n<script src="/site.js" defer></script>',
  });
}

/* ---------- コラム ---------- */

export function columnsPage() {
  const body = `
<div class="page-head has-ppl"><div class="wrap"><p class="en">COLUMN</p><h1>気象病を防ぐコラム</h1><p>気圧の変化で崩れる体調との付き合い方を、やさしくまとめました。</p></div><div class="pg-ppl" aria-hidden="true">${person('reading', { k: 0.5 })}${person('yoga', { k: 0.5 })}${person('hiker', { k: 0.5 })}</div></div>
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

/* ---------- サービス紹介 ---------- */

const ABOUT_FEATURES = [
  ['01', '気圧の変化をやさしく予報', '気象庁のアメダスと天気予報、OpenWeatherMapをもとに、お住まいの都道府県の気圧を時間ごとに見られます。グラフには過去の実測と今後の予測が並び、いつ下がるのかが一目で分かります。'],
  ['02', '4段階の「見通し」アイコン', '1時間あたりの気圧変化を「上昇注意（+1.0hPa/h以上）」「やや注意（-0.5〜-1.0）」「注意（-1.0〜-1.5）」「警戒（-1.5以下）」で表示。安定しているときは「安定」と表示します。'],
  ['03', '痛み・症状・服薬の記録', '痛みの度合いを5つの顔アイコンから選び、頭痛・めまい・だるさなどの症状やメモ、飲んだ薬もまとめて記録できます。記録にはそのときの気圧と6時間前との差が自動で添えられ、月間カレンダーでも振り返れます。数秒で書けるので続けやすい作りです。'],
  ['04', '自分のパターンを見つける分析', '記録と気圧の変化を重ねて、「気圧が下がり始めて何時間後に痛みが出やすいか」などの傾向を振り返れます。通院時に見せられる履歴としても使えます。'],
  ['05', '前日20:00のお知らせ', '翌日に気圧が大きく動きそうなとき、前日の夜20:00(日本時間)にプッシュ通知でお知らせします。通知はオン・オフを選べます。'],
  ['06', '週間天気と気圧', '気象庁の週間予報をもとに、7日間の天気・気温・降水確率と気圧の見通しをまとめて確認できます。予定を立てるときの目安にどうぞ。'],
  ['07', '気象病を防ぐコラム', '仕組み、前日の準備、不調を感じたときのセルフケア、受診の目安までを6本の記事で紹介しています。'],
  ['08', '地域ごとのみんなの傾向', '都道府県単位で匿名に集計した「今日つらい人の割合」を見られます。個人が特定される情報は出しません。'],
];

const ABOUT_SHOTS = [
  ['app-dash', '01', 'ホーム：気圧の推移と今日の見通し', '今後24時間でいちばん大きな気圧変化を、5段階のアイコンと文章でひと目で表示します。下のグラフでは過去の実測(点線)と予報、天気マークを時間ごとに確認できます。', ['4段階のアラート色', '過去と予報を連続表示', '地域の切り替え']],
  ['app-log', '02', '記録：数タップで体調を残す', '痛みの度合いを5つの顔から選び、症状のタグと服薬を選ぶだけ。日時は自動で入るので、あとから過去の分を追加することもできます。', ['顔アイコンで痛みを選ぶ', '記録時の気圧と6時間前との差を自動表示', '月間カレンダーで痛みを振り返り', '薬の検索とマイ薬リスト']],
  ['app-loglist', '03', '記録リスト：そのときの気圧も一緒に', '記録には、記録した時刻の気圧と6時間前との差が自動で添えられます。気圧が大きく下がっていたときは赤く表示され、「あの痛みはやっぱり気圧だった」が見返しやすくなります。', ['記録時の気圧を自動表示', '6時間前との差(−1.5hPa以下は赤)', '編集・削除もここから']],
  ['app-cal', '04', 'カレンダー：痛みを月ごとに振り返る', 'リストとカレンダーを切り替えられます。記録のある日にはその日いちばん強い痛みの顔が出て、日付をタップするとその日の記録を確認できます。', ['月ごとに一覧', '痛みの強い日がひと目で分かる', '前の月にさかのぼれる']],
  ['app-insight', '05', '分析：自分のパターンを知る', '記録と気圧の変化を照らし合わせ、「気圧が下がったあとに不調が出やすいか」を簡単な統計で示します。記録が5件以上たまると表示されます。', ['気圧低下との関連を文章で', '記録件数と該当件数', '通院時の参考に']],
  ['app-settings', '06', '設定：地域と通知', '主な地域を最大3つまで登録でき、気圧低下アラートの通知をオン・オフできます。データはいつでもご自身で全削除できます。', ['地域は都道府県単位のみ', 'プッシュ通知の切り替え', 'データの全削除']],
];
const ABOUT_PAGES = [
  ['weather', '/weather', '週間天気', '7日間の天気・気温・降水確率と、日ごとの気圧の見通しを一覧できます。'],
  ['columns', '/columns', 'コラム', '気象病の仕組みやセルフケア、受診の目安を6本の記事で紹介しています。'],
];
const phoneImg = (n, alt) => `<div class="ab-phone"><img src="/about/${n}.webp" alt="${esc(alt)}" width="390" height="780" loading="lazy"></div>`;
const ABOUT_STEPS = [
  ['地域を選ぶ', '都道府県を選ぶだけ。アカウント登録もメールアドレスも不要です。'],
  ['今日の見通しを見る', '気圧のグラフと、注意が必要な時間帯を確認します。'],
  ['体調を記録する', '痛みの度合い・症状・服薬をその日のうちに残します。'],
  ['傾向を振り返る', '続けるほど、自分に合った備え方が見えてきます。'],
];
const ABOUT_FAQ = [
  ['利用料金は?', '無料でお使いいただけます。'],
  ['アカウント登録は必要?', '不要です。端末ごとに匿名のIDで保存されます。'],
  ['どんな個人情報を扱いますか?', '位置情報は使わず、選んだ都道府県のみを利用します。氏名・メールアドレスは取得しません。詳しくは利用規約・プライバシーをご覧ください。'],
  ['医療アプリですか?', 'いいえ。気圧データは海面気圧の変動傾向を示す目安で、診断や治療の代わりにはなりません。症状が強い・続くときは医療機関にご相談ください。'],
  ['スマホのホーム画面に置けますか?', 'はい。ブラウザの「ホーム画面に追加」でアプリのように使えます。'],
];

export function aboutPage() {
  const body = `
<div class="page-head has-ppl"><div class="wrap"><p class="en">ABOUT</p><h1>Rio²（リオリオ）とは</h1><p>気圧と体調のノート。天気で揺れる体調を、記録と予報でやさしく支えるWebアプリです。</p></div><div class="pg-ppl" aria-hidden="true">${person('camera', { k: 0.5 })}${person('reading', { k: 0.5 })}${person('yoga', { k: 0.5 })}</div></div>
<div class="wrap about">
<section><h2 class="en-h">SCREENS<small>画面で見る</small></h2>
${ABOUT_SHOTS.map(([n, no, t, d, li], i) => `<div class="ab-shot${i % 2 ? ' rev' : ''}">${phoneImg(n, t)}<div class="ab-txt"><span class="no">${no}</span><h3>${esc(t)}</h3><p>${esc(d)}</p><ul>${li.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div></div>`).join('')}
<div class="ab-pages">${ABOUT_PAGES.map(([n, h, t, d]) => `<a href="${h}">${phoneImg(n, t + 'のページ')}<b>${esc(t)} →</b><span>${esc(d)}</span></a>`).join('')}</div></section>
<section><h2 class="en-h">FEATURES<small>主な機能</small></h2>
<div class="ab-grid">${ABOUT_FEATURES.map(([n, t, d]) => `<article class="ab-card"><span class="no">${n}</span><h3>${esc(t)}</h3><p>${esc(d)}</p></article>`).join('')}</div></section>
<section><h2 class="en-h">HOW TO USE<small>使い方</small></h2>
<ol class="ab-steps">${ABOUT_STEPS.map(([t, d]) => `<li><b>${esc(t)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
<p class="ab-cta"><a class="btn primary" href="/app/">アプリを開く</a> <a class="btn" href="/columns/how-to-use-app">くわしい使い方を読む</a></p></section>
<section><h2 class="en-h">FAQ<small>よくある質問</small></h2>
<div class="ab-faq">${ABOUT_FAQ.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div></section>
<p class="disclaimer">本サービスの気圧データは海面気圧の変動傾向を示す目安であり、医学的な診断を提供するものではありません。</p>
</div>`;
  return layout({
    title: 'サービス紹介｜Rio²（リオリオ）の機能と使い方',
    description: 'Rio²（リオリオ）は気圧の予報と体調の記録で気象病に備えるWebアプリ。機能、使い方、よくある質問を紹介します。',
    page: 'about',
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

const ARTICLE_FIG = { 'what-is-kishobyo': 'couple', 'day-before': 'hat-bag', 'when-it-hurts': 'reading', 'daily-habits': 'runner', 'how-to-use-app': 'camera', 'when-to-see-doctor': 'family' };

export function columnPage(slug) {
  const c = findColumn(slug);
  if (!c) return null;
  const i = COLUMNS.indexOf(c);
  const prev = COLUMNS[i - 1];
  const next = COLUMNS[i + 1];
  const body = `
<nav class="crumb" aria-label="パンくず"><a href="/">トップ</a> › <a href="/columns">コラム</a></nav>
<article class="article">
  ${person(ARTICLE_FIG[c.slug] || 'hat-bag', { k: 0.6, cls: 'art-fig' })}
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
