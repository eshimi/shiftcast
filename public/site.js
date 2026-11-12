// トップ / 週間天気ページのクライアント処理。データは /api/week（サーバー側でキャッシュ済み）だけを使う。
const $ = (s, r = document) => r.querySelector(s);
const LABEL = { none: '安定', rise: '上昇注意', slight: 'やや注意', caution: '注意', warning: '警戒' };
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};
function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k)));
  return e;
}
const pad = (n) => String(n).padStart(2, '0');
const jstParts = (ts) => { const d = new Date(ts + 9 * 3600e3); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes() }; };
const fmtTime = (ts) => { const p = jstParts(ts); return `${p.m}/${p.d} ${p.h}時`; };
const sign = (n) => (n > 0 ? '+' : n < 0 ? '−' : '±');
// 気温の変化(表示専用の暫定の目安): 現在の気温・前日の同時刻との差・今後24時間の最高/最低
function tempLine(t) {
  if (!t) return null;
  const d = t.d24 != null ? `（前日同時刻比 ${sign(t.d24)}${Math.abs(t.d24).toFixed(1)}℃）` : '';
  return [`気温 ${Math.round(t.now)}℃${d}　今後24時間 ${Math.round(t.min)}〜${Math.round(t.max)}℃ `, h('span', { class: `pill tp-${t.level}` }, t.label)];
}
const temp = (t) => (t == null ? '–' : `${t}°`);

async function getJson(url, opt) {
  const r = await fetch(url, opt);
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

/* ---------- 地域（アプリと同じ localStorage を共有） ---------- */
let areaCode = '13';
async function initArea(onChange) {
  const sel = $('#areaSel');
  const areas = await getJson('/api/areas');
  sel.replaceChildren(...areas.map((a) => h('option', { value: a.code }, a.name)));
  let code = new URLSearchParams(location.search).get('area') || store.get('area');
  if (!code) {
    const uid = store.get('uid');
    if (uid) { try { code = (await getJson('/api/me', { headers: { 'x-user-id': uid } })).areas?.[0]; } catch { /* 未ログイン */ } }
  }
  areaCode = areas.some((a) => a.code === code) ? code : '13';
  sel.value = areaCode;
  const set = (c) => { areaCode = c; sel.value = c; store.set('area', c); onChange(); };
  sel.addEventListener('change', () => set(sel.value));
  const loc = $('#locate');
  loc?.addEventListener('click', () => {
    if (!navigator.geolocation) return alert('この端末では現在地を取得できません。地域は一覧から選べます');
    const label = loc.textContent; loc.disabled = true; loc.textContent = '取得中…';
    const done = () => { loc.disabled = false; loc.textContent = label; };
    navigator.geolocation.getCurrentPosition(
      async (p) => { try { set((await getJson(`/api/nearest?lat=${p.coords.latitude}&lon=${p.coords.longitude}`)).code); } catch { alert('現在地から地域を判定できませんでした'); } done(); },
      (err) => { done(); alert(err && err.code === 1 ? '位置情報の利用が許可されていません。ブラウザ・端末の設定で許可するか、地域を一覧から選んでください' : '現在地を取得できませんでした。電波の良い場所でもう一度お試しください'); },
      { timeout: 20000, maximumAge: 600000 }, // 座標は都道府県の判定にだけ使い、保存しない
    );
  });
  onChange();
}

/* ---------- 描画 ---------- */
function renderToday(w) {
  const el = $('#today');
  const n = w.next24;
  el.className = `card today lv-${n.level}`;
  const cur = w.current;
  const d3 = cur?.d3;
  el.replaceChildren(
    h('div', { class: 'ico', 'aria-hidden': 'true' }, window.FACE ? window.FACE.level(n.level, 46) : { warning: '🚨', caution: '⚠️', slight: '🟡', rise: '🔼', none: '✅' }[n.level]),
    h('div', { class: 't-body' },
      h('div', { class: 'muted small' }, `${w.area.name}・現在の海面気圧 `, w.demo ? h('span', { class: 'badge' }, 'デモデータ') : null),
      h('div', { class: 'big' }, cur ? `${Math.round(cur.pressure)}` : '–', h('small', {}, ' hPa'),
        d3 != null ? h('small', {}, `　直近3時間 ${sign(d3)}${Math.abs(d3).toFixed(1)}`) : null),
      h('div', {}, '今後24時間：', h('span', { class: `pill lv-${n.level}` }, n.label),
        n.rate != null && n.level !== 'none' ? h('span', { class: 'muted small' }, `　${fmtTime(n.at)}ごろ ${sign(n.rate)}${Math.abs(n.rate).toFixed(1)}hPa/h`) : null),
      n.severe ? h('div', { class: 'small' }, '気圧が大きく下がる見込みです。早めの休息と、いつもの薬の確認を。') : null,
      document.body.dataset.page === 'top' ? h('a', { class: 't-link', href: '/weather' }, '1週間の見通しを見る →') : null),
  );
  // 気圧・気温・降水・湿度のタイル(サーバーで描画したHTML)
  if (w.tilesHtml) {
    el.classList.add('has-fx');
    const fx = h('div', { class: 'fx-wrap' });
    fx.innerHTML = w.tilesHtml;
    el.append(fx);
  }
}

// トップの Today: 参考サイトの News のような「日付・カテゴリ・見出し」の1行
// 今日の見通し(24時間の気圧の変化)に合わせて、飾りの人物を変える（none=外で活動 / 注意以上=家でゆっくり）
const MOOD_FIG = { none: '10-runner', rise: '01-hat-bag', slight: '23-bike-walk', caution: '15-reading', warning: '16-tent' };
function setMoodFigure(level) {
  const img = $('#todayFig');
  if (!img) return;
  const f = MOOD_FIG[level] || MOOD_FIG.none;
  img.onload = () => { img.hidden = false; };
  img.src = `/img/people/${f}.webp`;
}

function renderNews(w) {
  const el = $('#todayNews');
  const n = w.next24;
  setMoodFigure(n.level);
  const t = jstParts(w.now);
  const cur = w.current;
  const d3 = cur?.d3;
  el.replaceChildren(
    h('div', { class: 'news-row' },
      h('p', { class: 'news-meta' }, h('span', {}, `${t.y}/${pad(t.m)}/${pad(t.d)}`), h('span', { class: 'news-cat' }, 'Pressure'), w.demo ? h('span', { class: 'badge' }, 'デモデータ') : null),
      h('p', { class: 'news-title' }, `${w.area.name}　今後24時間：${n.label}`),
      h('p', { class: 'news-sub' },
        cur ? ['現在の海面気圧 ', h('b', {}, `${Math.round(cur.pressure)} hPa`), d3 != null ? `（直近3時間 ${sign(d3)}${Math.abs(d3).toFixed(1)}）` : ''] : '現在の気圧を取得中です',
        n.level !== 'none' && n.rate != null ? h('br') : null,
        n.level !== 'none' && n.rate != null ? `${fmtTime(n.at)}ごろ ${sign(n.rate)}${Math.abs(n.rate).toFixed(1)}hPa/h で変化する見込みです。` : null,
        n.severe ? h('br') : null,
        n.severe ? '早めの休息と、いつもの薬の確認を。' : null,
        w.temp ? h('br') : null,
        w.temp ? tempLine(w.temp) : null,
        w.factors && w.factors.count > 0 ? h('br') : null,
        w.factors && w.factors.count > 0 ? w.factors.text : null)),
  );
}

// 天気マーク: public/wx.js の線画アイコン。読み込めない場合は絵文字で代用する
const wxIcon = (key, emoji, size) => (window.WX && key && window.WX.ICONS[key] ? window.WX.el(key, size) : h('span', { 'aria-hidden': 'true' }, emoji || ''));

function cellFor(d) {
  const lv = d.pressure?.level ?? 'none';
  return h('div', { class: `cell lv-${lv}`, title: d.text || '' },
    h('b', {}, d.label), h('div', { class: 'muted small' }, `(${d.dow})`),
    h('div', { class: 'ic' }, wxIcon(d.key, d.icon, 34)),
    h('div', { class: 'tt' }, h('span', { class: 'hi' }, temp(d.tmax)), ' / ', h('span', { class: 'lo' }, temp(d.tmin))),
    h('div', { class: 'pp' }, d.pop != null ? `☂${d.pop}%` : ' '),
    h('div', { class: 'pp' }, d.pressure ? LABEL[lv] : ' '));
}

function dayRow(d) {
  const p = d.pressure;
  const lv = p?.level ?? 'none';
  return h('div', { class: `day lv-${lv}` },
    h('div', { class: 'd' }, h('b', {}, d.label), h('small', {}, `(${d.dow})`)),
    h('div', { class: 'w' }, h('span', { class: 'ic' }, wxIcon(d.key, d.icon, 36)), h('span', {}, d.text || '予報なし')),
    h('div', { class: 't' }, h('span', { class: 'hi' }, temp(d.tmax)), ' / ', h('span', { class: 'lo' }, temp(d.tmin)),
      d.pop != null ? h('small', {}, `降水確率 ${d.pop}%`) : null,
      d.dtmax != null ? h('small', {}, `最高 前日比 ${sign(d.dtmax)}${Math.abs(d.dtmax)}℃`) : null),
    h('div', { class: 'p' },
      p ? [h('span', { class: `pill lv-${lv}` }, `気圧 ${p.label}`),
        h('span', {}, `${Math.round(p.min)}〜${Math.round(p.max)} hPa`),
        lv !== 'none' && p.rate != null ? h('span', {}, `${fmtTime(p.at)}ごろ ${sign(p.rate)}${Math.abs(p.rate).toFixed(1)}hPa/h`) : null,
        p.partial ? h('span', {}, '（一部の時間帯のみ）') : null]
        : h('span', {}, '気圧の予報は約5日先までです'),
      d.reliability ? h('span', { title: '気象庁の予報の信頼度（A:高い〜C:低い）' }, `信頼度 ${d.reliability}`) : null));
}

function hourCell(p) {
  const t = jstParts(p.ts);
  return h('div', { class: `cell lv-${p.level}` },
    h('b', {}, `${t.h}時`), h('div', { class: 'ic' }, wxIcon(p.key, p.icon, 30)),
    h('div', { class: 'tt' }, p.temp != null ? `${Math.round(p.temp)}°` : '–'),
    h('div', { class: 'pp' }, `${Math.round(p.pressure)}`),
    h('div', { class: 'pp' }, p.rate != null && p.level !== 'none' ? LABEL[p.level] : ' '));
}

let seq = 0;
async function load() {
  const mine = ++seq;
  const page = document.body.dataset.page;
  try {
    const w = await getJson('/api/week?area=' + areaCode);
    if (mine !== seq) return; // 地域切替の競合
    if (page === 'top') renderNews(w);
    else renderToday(w);
    if (page === 'top') {
      $('#weekStrip').replaceChildren(...w.days.map(cellFor));
    } else {
      $('#days').replaceChildren(...w.days.map(dayRow));
      const hrs = w.hourly.filter((p) => p.ts >= w.now - 1.5 * 3600e3).slice(0, 10);
      $('#hourly').replaceChildren(...(hrs.length ? hrs.map(hourCell) : [h('p', { class: 'muted' }, 'データ取得中です')]));
    }
  } catch {
    if (mine !== seq) return;
    ($('#todayNews') || $('#today')).replaceChildren(h('p', { class: 'muted' }, 'データを取得できませんでした。しばらくしてからもう一度お試しください。'));
  }
}

const page = document.body.dataset.page;
if (page === 'top' || page === 'weather') initArea(load).catch(() => ($('#todayNews') || $('#today'))?.replaceChildren(h('p', { class: 'muted' }, '地域の一覧を取得できませんでした。')));

/* ---------- トップ: スマホ枠の操作性（PC幅） ----------
   枠(#phone)の中が縦にスクロールする。「続きがある」ことが伝わり、枠の外でも操作できるようにする。 */
function initTop() {
  const phone = $('#phone');
  if (!phone) return;
  const desk = () => window.matchMedia('(min-width: 900px)').matches;
  const cue = $('.m-scroll');
  const links = [...document.querySelectorAll('.side-index a')];
  const secs = links.map((a) => document.getElementById(a.dataset.sec));

  const update = () => {
    const y = desk() ? phone.scrollTop : window.scrollY;
    cue?.classList.toggle('gone', y > 40); // 少しスクロールしたら「SCROLL」を消す
    const base = desk() ? phone.getBoundingClientRect().top : 0;
    const h = desk() ? phone.clientHeight : window.innerHeight;
    let cur = -1;
    secs.forEach((el, i) => { if (el && el.getBoundingClientRect().top - base <= h * 0.35) cur = i; });
    links.forEach((a, i) => a.setAttribute('aria-current', i === cur ? 'true' : 'false'));
  };
  phone.addEventListener('scroll', update, { passive: true });
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();

  // 目次をクリックすると、枠の中を該当セクションまでスクロール
  links.forEach((a, i) => a.addEventListener('click', (e) => {
    if (!desk() || !secs[i]) return;
    e.preventDefault();
    const delta = secs[i].getBoundingClientRect().top - phone.getBoundingClientRect().top - phone.clientTop;
    phone.scrollTo({ top: phone.scrollTop + delta, behavior: 'smooth' });
  }));

  // 枠の外(左の紹介や背景)でホイールを回しても、枠の中が動く
  $('.stage')?.addEventListener('wheel', (e) => {
    if (!desk() || phone.contains(e.target)) return;
    phone.scrollBy({ top: e.deltaY, behavior: 'instant' });
  }, { passive: true });

  // キー操作(スペース/PageDown/矢印/Home/End)でも枠の中が動く
  document.addEventListener('keydown', (e) => {
    if (!desk() || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const tag = document.activeElement?.tagName || '';
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(tag)) return; // 入力中は何もしない
    if (/^(BUTTON|A)$/.test(tag) && e.key === ' ') return; // リンク/ボタンのスペースは、そちらの操作を優先
    const page = phone.clientHeight * 0.85;
    const map = { PageDown: page, ' ': e.shiftKey ? -page : page, PageUp: -page, ArrowDown: 80, ArrowUp: -80 };
    if (e.key in map) { e.preventDefault(); phone.scrollBy({ top: map[e.key], behavior: 'smooth' }); }
    else if (e.key === 'Home') { e.preventDefault(); phone.scrollTo({ top: 0, behavior: 'smooth' }); }
    else if (e.key === 'End') { e.preventDefault(); phone.scrollTo({ top: phone.scrollHeight, behavior: 'smooth' }); }
  });
}
if (page === 'top') initTop();
