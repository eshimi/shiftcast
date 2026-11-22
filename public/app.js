/* global Chart */
const $ = (s) => document.querySelector(s);
const LABEL = { none: '安定', rise: '上昇注意', slight: 'やや注意', caution: '注意', warning: '警戒' };
const COLOR = new Proxy({}, { get: (_, k) => (getComputedStyle(document.documentElement).getPropertyValue(`--lv-${k}`).trim() || '#999') });
const FACES = ['😊', '🙂', '😕', '😣', '😖', '😫']; // 0=痛みなし // faces.js(手描き風の顔)が読み込めない場合の代用
const faceEl = (level, size) => (window.FACE ? window.FACE.el(level, size) : document.createTextNode(FACES[level]));
const FACE_LABEL = ['痛みなし', '軽い', 'やや痛い', '痛い', 'かなり痛い', '耐えがたい'];
const DEFAULT_TAGS = ['頭痛', 'だるさ', 'めまい', '肩こり', '吐き気', '関節痛', '眠気', '睡眠の質が悪い'];
const HOUR = 3600e3;
const FONT = getComputedStyle(document.body).fontFamily; // グラフ内の文字も、ページと同じフォントにそろえる
const tok = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

const S = {
  uid: null, me: null, areas: [], areaName: {}, cur: null /* 現在地の都道府県 */, view: 'dash',
  sel: null, pain: null, tags: new Set(), meds: new Set(), editId: null, chart: null, fc: null, logs: [],
};

// ---------- util ----------
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  del: (k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};
function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null) e.append(k.nodeType ? k : document.createTextNode(k));
  return e;
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 4200);
}
async function api(path, opt = {}) {
  const res = await fetch('/api' + path, {
    method: opt.method || 'GET',
    headers: { 'content-type': 'application/json', ...(S.uid ? { 'x-user-id': S.uid } : {}) },
    body: opt.body ? JSON.stringify(opt.body) : undefined,
  });
  if (res.status === 401 && S.uid && !opt.retried) { // サーバー側でデータ削除済み等 → 再登録
    store.del('uid'); await boot(true); return api(path, { ...opt, retried: true });
  }
  if (!res.ok) { const e = new Error((await res.json().catch(() => ({}))).error || res.status); e.status = res.status; throw e; }
  return res.status === 204 ? null : res.json();
}
const pad = (n) => String(n).padStart(2, '0');
const fmtDT = (ts) => { const d = new Date(ts); return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const toLocalInput = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const wxIcon = (c) => ({ '01': '☀️', '02': '⛅', '03': '☁️', '04': '☁️', '09': '🌧️', '10': '🌦️', '11': '⛈️', '13': '❄️', '50': '🌫️' }[(c || '').slice(0, 2)] || '·');

// ---------- boot ----------
async function boot(force) {
  S.cfg = await fetch('/api/config').then((r) => r.json());
  $('#demoBadge').hidden = !S.cfg.demo;
  S.areas = await fetch('/api/areas').then((r) => r.json());
  S.areaName = Object.fromEntries(S.areas.map((a) => [a.code, a.name]));
  S.uid = force ? null : store.get('uid');
  if (!S.uid) {
    S.uid = (await api('/users', { method: 'POST', body: {} })).id;
    store.set('uid', S.uid);
  }
  S.me = await api('/me');
  S.sel = S.me.areas[0];
  const hv = location.hash.slice(1); // トップページ等からの直リンク（例: /app/#log）
  if (VIEWS.includes(hv)) S.view = hv;
  renderAll();
}

function renderAll() {
  renderChips(); renderPain(); renderTags(); renderMyMeds(); renderSelMeds(); renderSettings();
  $('#when').value = toLocalInput(Date.now());
  show(S.view, { push: false });
}

// ---------- タブ ----------
// 画面はURLの # と連動する（/app/#log など）。ブラウザの戻る/進む、トップページや通知からの直リンクも同じ経路で切り替わる。
const mountChart = (host) => { const cc = document.querySelector('.chart-card'); if (cc && host && cc.parentNode !== host) host.append(cc); };
const VIEWS = ['dash', 'log', 'insight', 'settings'];
function show(v, { push = true } = {}) {
  if (!VIEWS.includes(v)) v = 'dash';
  S.view = v;
  document.body.dataset.view = v;
  document.querySelectorAll('.view').forEach((e) => (e.hidden = e.id !== 'view-' + v));
  document.querySelectorAll('.tabs button').forEach((b) => { b.classList.toggle('on', b.dataset.v === v); if (b.dataset.v === v) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  if (push && location.hash !== '#' + v) { try { history.pushState(null, '', '#' + v); } catch { /* 無視 */ } }
  mountChart(v === 'insight' ? $('#insightChartHost') : $('#chartSlot'));
  if (v === 'dash') loadDash();
  if (v === 'log') loadLogs();
  if (v === 'insight') loadInsight();
  window.scrollTo(0, 0);
}
document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => show(b.dataset.v)));
// 戻る/進む・同じページ内の #リンク（ブラウザが hashchange / popstate を発火）
const fromHash = () => { if (S.me) show(location.hash.slice(1), { push: false }); };
window.addEventListener('hashchange', fromHash);
window.addEventListener('popstate', fromHash);

// ---------- ダッシュボード ----------
function renderChips() {
  const box = $('#areaChips'); box.replaceChildren();
  const mk = (code, label) => h('button', { class: 'chip' + (S.sel === code ? ' on' : ''), type: 'button', role: 'tab', 'aria-selected': S.sel === code ? 'true' : 'false', 'aria-current': S.sel === code ? 'true' : null, onclick: () => { S.sel = code; renderChips(); loadDash(); } }, label);
  box.append(h('button', { class: 'chip', type: 'button', onclick: locate }, '現在地' + (S.cur ? `（${S.areaName[S.cur]}）` : '')));
  const codes = [...new Set([...(S.cur ? [S.cur] : []), ...S.me.areas])];
  codes.forEach((c) => box.append(mk(c, S.areaName[c])));
}

let locating = false;
function locate() {
  if (locating) return;
  if (!navigator.geolocation) return toast('この端末では現在地を取得できません。設定からエリアを登録してください');
  locating = true; toast('現在地を取得しています…');
  const done = () => { locating = false; };
  navigator.geolocation.getCurrentPosition(
    async (p) => {
      // 座標は都道府県の判定にだけ使い、サーバーにも保存されない
      try {
        const a = await api(`/nearest?lat=${p.coords.latitude}&lon=${p.coords.longitude}`);
        S.cur = a.code; S.sel = a.code; renderChips(); loadDash(); toast(`現在地: ${a.name}`);
      } catch { toast('現在地から地域を判定できませんでした'); }
      done();
    },
    (err) => {
      done();
      toast(err && err.code === 1
        ? '位置情報の利用が許可されていません。ブラウザ・端末の設定で許可するか、設定からエリアを登録してください'
        : '現在地を取得できませんでした。電波の良い場所でもう一度お試しください');
    },
    { timeout: 20000, maximumAge: 600000 },
  );
}

async function loadDash() {
  if (!S.sel) return;
  const code = S.sel;
  try {
    const [fc, logs, st, wk] = await Promise.all([
      api('/forecast?area=' + code),
      api(`/logs?from=${Date.now() - 72 * HOUR}`),
      api('/area-stats?area=' + code),
      api('/week?area=' + code).catch(() => null), // 体調そらもよう(表示のみ)
    ]);
    if (code !== S.sel) return; // 切替競合
    // 上から: 明日カード → (通知カード) → 今日ブロック(そらもよう+過ごし方) → 今日の記録 → 気圧グラフ → いまの天気 → 気象庁予報
    S.fc = fc; S.stats = st;
    renderSummary(fc); renderNotifyCard(); renderMoodHero(wk?.mood, st); renderTodayLog(logs);
    const fx = $('#fxCard');
    if (wk?.tilesHtml) { fx.innerHTML = wk.tilesHtml; fx.hidden = false; } else fx.hidden = true;
    drawChart(fc, logs); renderJma(fc.jma);
    $('#fetched').textContent = fc.fetchedAt ? `${fmtDT(fc.fetchedAt)} 更新` : '';
    $('#demoBadge').hidden = !fc.demo && !S.cfg.demo;
  } catch (e) { toast('気象データを取得できませんでした'); }
}

// 今日ブロック(主役カード): スコア → 要因(チップ。タップで「いまの天気」の該当カードへ) → 対策(今日の過ごし方) → 地域の体調(一行)
const FACTOR_NAME = { past: '過去の低下', pressure: '気圧', temp: '気温差', rain: '降水', hum: '湿度' };
const FACTOR_TILE = { past: 'pressure', pressure: 'pressure', temp: 'temp', rain: 'rain', hum: 'hum' };
const MIN_PAINED = 3; // 地域の体調は、不調を記録した人がこの人数以上のときだけ出す
function renderMoodHero(m, st) {
  const el = $('#moodHero');
  const cc = document.querySelector('.chart-card'); // 気圧の推移・予報は、そらもようの枠の中(要因の下)に入れる
  if (!m) { el.hidden = true; if (cc && cc.parentNode === el) $('#chartSlot').append(cc); return; }
  el.hidden = false;
  el.className = `mhero lv-${m.level}`;
  const chips = m.factors && m.factors.length
    ? h('div', { class: 'mhero-why' }, h('span', { class: 'mhero-why-l' }, '重なっている要因（タップで詳細）'),
      h('div', { class: 'fchips' }, m.factors.map((k) => h('button', { class: 'fchip', type: 'button', onclick: () => jumpToTile(FACTOR_TILE[k]) }, FACTOR_NAME[k] || k))))
    : null;
  const region = st && !st.hidden && st.pained >= MIN_PAINED
    ? h('p', { class: 'mhero-region' }, `地域の体調：${S.areaName[S.sel]}で、直近${st.windowH}時間に ${st.percent}% の人が不調を記録しています`) : null;
  el.replaceChildren(...[
    h('p', { class: 'mhero-en' }, '今日の体調そらもよう'),
    h('div', { class: 'mhero-main' },
      h('div', { class: 'mhero-score', role: 'img', 'aria-label': `スコア ${m.score} / 100` }, h('b', {}, String(m.score)), h('small', {}, '/ 100')),
      h('div', { class: 'mhero-txt' },
        h('span', { class: 'mhero-badge' }, `5段階中 ${m.level}`),
        h('p', { class: 'mhero-label' }, m.label))),
    h('p', { class: 'mhero-cmt' }, m.desc),
    chips,
    cc,
    m.care ? (() => { const d = h('div', { class: 'care-box' }); d.innerHTML = `<p class="care-h"><b>今日の過ごし方</b><small>体調が崩れやすい日の備え</small></p><ol class="care-list">${m.care.tips.map((x) => `<li><b>${esc(x.t)}</b></li>`).join('')}</ol><p class="care-more"><a class="btn sm primary" href="/care">今日の対策をくわしく見る</a></p><p class="care-note">一般的なセルフケアの情報で、診断や治療の代わりではありません。</p>`; return d; })() : null,
    region].filter(Boolean));
}
function jumpToTile(icon) {
  const t = document.querySelector(`#fxCard .fx-${icon}`);
  if (!t) return;
  t.scrollIntoView({ behavior: 'smooth', block: 'center' });
  t.classList.add('fx-flash'); setTimeout(() => t.classList.remove('fx-flash'), 1800);
}

// 明日カード: 明日(あす0時〜24時)の気圧のレベル・ピーク時刻・最大低下率・現在の気圧
const TOD = (hr) => (hr < 5 ? '未明' : hr < 10 ? '朝' : hr < 14 ? '昼ごろ' : hr < 18 ? '午後' : '夜');
const TMRW_CMT = {
  warning: (t) => `${t}から気圧が大きく下がります。早めに備えましょう`,
  caution: (t) => `${t}にかけて気圧が下がります。無理のない予定で`,
  slight: (t) => `${t}に気圧がやや下がります。念のため注意を`,
  rise: (t) => `${t}に気圧が上がります。変化に注意`,
  none: () => '気圧の大きな変動はなさそうです',
};
function renderSummary(fc) {
  const now = fc.now;
  const d0 = new Date(now); d0.setHours(24, 0, 0, 0); const t0 = d0.getTime(), t1 = t0 + 24 * HOUR;
  const day = fc.points.filter((p) => p.ts >= t0 && p.ts < t1 && p.level !== 'none');
  const sev = { warning: 4, caution: 3, slight: 2, rise: 1 };
  const worst = day.sort((a, b) => sev[b.level] - sev[a.level] || a.rate - b.rate)[0];
  const lv = worst?.level || 'none';
  const el = $('#summary'); el.className = `card summary astrip lv-${lv}`;
  const last = [...fc.points].reverse().find((p) => p.ts <= now) || fc.points[0];
  const ico = h('span', { class: 'astrip-ico', 'aria-hidden': 'true' }); ico.append(window.FACE ? window.FACE.level(lv, 30) : '');
  const md = `${new Date(t0).getMonth() + 1}/${new Date(t0).getDate()}`;
  el.replaceChildren(
    ico,
    h('div', { class: 'astrip-txt' },
      h('div', { class: 'astrip-h' }, h('span', { class: 'astrip-s' }, `明日 ${md}`), h('b', {}, worst ? `気圧は${LABEL[worst.level]}` : '気圧は安定')),
      h('div', { class: 'astrip-c' }, TMRW_CMT[lv](worst ? TOD(new Date(worst.ts).getHours()) : '')),
      h('div', { class: 'astrip-d' },
        worst ? [`ピーク ${fmtDT(worst.ts)}ごろ`, ' ・ 最大低下 ', h('b', { class: 'astrip-r' }, `${worst.rate > 0 ? '+' : ''}${worst.rate.toFixed(1)} hPa/h`)] : '',
        last?.pressure != null ? `${worst ? ' ・ ' : ''}現在 約${Math.round(last.pressure)} hPa` : '')),
  );
}

// 通知カード(未設定の端末だけ。明日カードの直下)。許可ダイアログの前に、届く内容を1画面で説明する
function renderNotifyCard() {
  const el = $('#notifyCard');
  const on = S.me.notify && S.me.hasPush;
  if (on || !S.cfg.firebase || !S.cfg.vapidKey) { el.hidden = true; return; } // 設定済み、またはサーバー側の通知設定が未完了のときは出さない
  el.hidden = false;
  el.replaceChildren(
    h('p', { class: 'ncard-h' }, '明日が注意以上の日は、前の晩20時にお知らせします'),
    h('div', { class: 'ncard-sample', 'aria-hidden': 'true' }, h('b', {}, 'ウェルミー'), h('span', {}, '明日は気圧が大きく下がる見込みです（警戒）。早めの備えを'), h('small', {}, '20:00')),
    h('div', { class: 'ncard-act' },
      h('button', { class: 'btn primary', type: 'button', onclick: () => showPushIntro(el) }, '受け取る'),
      h('a', { class: 'link', href: '#settings' }, '通知の設定')));
}
function showPushIntro(el) {
  el.replaceChildren(
    h('p', { class: 'ncard-h' }, '通知の許可について'),
    h('ul', { class: 'ncard-ul' }, h('li', {}, '次に表示されるブラウザの画面で「許可」を選ぶと、通知が届くようになります。'),
      h('li', {}, '届くのは「明日が注意以上の日」の前の晩だけ。毎日は鳴りません。'), h('li', {}, '時刻やレベルは、設定タブでいつでも変えられます。')),
    h('div', { class: 'ncard-act' },
      h('button', { class: 'btn primary', type: 'button', onclick: async () => { try { await enablePush(); toast('通知をオンにしました'); } catch (err) { toast(err.message); } renderSettings(); renderNotifyCard(); } }, '許可画面へ進む'),
      h('button', { class: 'link', type: 'button', onclick: renderNotifyCard }, 'やめる')));
}

// 今日の記録ミニ: 未記録→顔をタップして、その場で記録 / 記録済み→サマリーと編集リンク
const isToday = (ts) => new Date(ts).toDateString() === new Date().toDateString();
function renderTodayLog(logs) {
  const el = $('#todayLog'); const today = (logs || []).filter((l) => isToday(l.ts));
  if (!today.length) {
    el.replaceChildren(
      h('div', { class: 'card-h' }, h('b', {}, '今日の体調を記録'), h('a', { class: 'link', href: '#log' }, 'くわしく記録 ›')),
      h('p', { class: 'muted' }, 'いまの体調に近い顔をタップするだけで記録できます'),
      painButtons((i) => quickLog(i)));
    return;
  }
  const worst = today.reduce((a, l) => (l.pain > a.pain ? l : a), today[0]);
  const tags = [...new Set(today.flatMap((l) => l.tags))];
  el.replaceChildren(
    h('div', { class: 'card-h' }, h('b', {}, '今日の記録'), h('a', { class: 'link', href: '#log' }, '記録を追加・編集 ›')),
    h('div', { class: 'tlog-sum' }, faceEl(worst.pain, 40),
      h('div', {}, h('b', {}, `${FACE_LABEL[worst.pain]}（${today.length}件）`),
        h('div', { class: 'muted' }, `${fmtDT(worst.ts).split(' ')[1]} に記録${tags.length ? '・' + tags.slice(0, 4).join('/') : ''}`))));
}
async function quickLog(pain) {
  try { await saveLog({ ts: Date.now(), pain, tags: [], meds: [], note: '' }); toast('記録しました'); loadDash(); } catch { toast('保存できませんでした'); }
}
// 記録の保存(記録タブのフォームと、今日の記録ミニで共通)
async function saveLog(body, editId) {
  return editId ? api('/logs/' + editId, { method: 'PUT', body }) : api('/logs', { method: 'POST', body });
}
function painButtons(onPick, selected) {
  const box = h('div', { class: 'pain', role: 'radiogroup', 'aria-label': '痛みの度合い' });
  FACE_LABEL.forEach((lb, i) => box.append(h('button', { type: 'button', class: selected === i ? 'on' : '', role: 'radio', 'aria-checked': selected === i, 'aria-label': lb, onclick: () => onPick(i) }, faceEl(i, 36), h('small', {}, lb))));
  return box;
}

// 背景色の帯・天気アイコン・気温・痛みアイコンを描画するプラグイン
const overlay = {
  id: 'overlay',
  beforeDatasetsDraw(chart) {
    const { ctx, chartArea: a, scales: { x } } = chart;
    const pts = chart.$pts || [];
    ctx.save();
    pts.forEach((p, i) => {
      if (i === 0 || p.level === 'none') return;
      const x0 = x.getPixelForValue(pts[i - 1].ts), x1 = x.getPixelForValue(p.ts);
      ctx.globalAlpha = 0.22; ctx.fillStyle = COLOR[p.level];
      ctx.fillRect(x0, a.top, x1 - x0, a.bottom - a.top);
    });
    ctx.restore();
  },
  afterDatasetsDraw(chart) {
    const { ctx, chartArea: a, scales: { x, y } } = chart;
    const pts = chart.$pts || [];
    ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = getComputedStyle(document.body).color;
    // 天気アイコン+気温（密になりすぎないよう1点おき）
    pts.forEach((p, i) => {
      if (i % 2) return;
      const px = x.getPixelForValue(p.ts);
      if (window.WX) window.WX.draw(ctx, window.WX.fromOwm(p.icon), px, a.top + 1, 26, getComputedStyle(document.body).color, 2.4);
      else { ctx.font = `16px ${FONT}`; ctx.fillText(wxIcon(p.icon), px, a.top + 14); }
      if (p.temp != null) { ctx.font = `12px ${FONT}`; ctx.fillText(Math.round(p.temp) + '°', px, a.top + 40); }
    });
    // 現在時刻: 青い縦線と「今」のラベル、現在の気圧の点
    const nx = x.getPixelForValue(chart.$now), ny = (() => { const v = pressureAt(pts, chart.$now); return v == null ? null : y.getPixelForValue(v); })();
    ctx.save();
    ctx.fillStyle = tok('--color-primary') + '10'; ctx.fillRect(nx, a.top, a.right - nx, a.bottom - a.top);   // これから(予報)の側をうっすら色づけ
    ctx.strokeStyle = tok('--color-primary'); ctx.lineWidth = 1.4; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(nx, a.top - 14); ctx.lineTo(nx, a.bottom); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = tok('--color-primary'); ctx.beginPath(); ctx.roundRect ? ctx.roundRect(nx - 13, a.top - 32, 26, 17, 8) : ctx.rect(nx - 13, a.top - 32, 26, 17); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `700 11px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('今', nx, a.top - 19.5);
    if (ny != null) { ctx.fillStyle = tok('--color-primary') + '2a'; ctx.beginPath(); ctx.arc(nx, ny, 9, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = tok('--color-primary'); ctx.beginPath(); ctx.arc(nx, ny, 4.5, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    // 過去の痛み記録アイコン
    ctx.font = `22px ${FONT}`;
    (chart.$logs || []).forEach((l) => {
      const py = pressureAt(pts, l.ts);
      if (py == null) return;
      if (window.FACE) window.FACE.draw(ctx, l.pain, x.getPixelForValue(l.ts), y.getPixelForValue(py), 28);
      else ctx.fillText(FACES[l.pain], x.getPixelForValue(l.ts), y.getPixelForValue(py) + 8);
    });
    ctx.restore();
  },
};

function pressureAt(pts, ts) {
  for (let i = 1; i < pts.length; i++) {
    if (ts <= pts[i].ts && ts >= pts[i - 1].ts) {
      const f = (ts - pts[i - 1].ts) / (pts[i].ts - pts[i - 1].ts);
      return pts[i - 1].pressure + (pts[i].pressure - pts[i - 1].pressure) * f;
    }
  }
  return null;
}

function drawChart(fc, logs) {
  const pts = fc.points.filter((p) => p.pressure != null);
  if (!pts.length) { $('#chartWrap').textContent = 'データ取得中です。しばらくしてからお試しください。'; return; }
  const wrap = $('#chartWrap');
  if (!wrap.querySelector('canvas')) wrap.replaceChildren(h('canvas', { id: 'chart' }));
  const spanH = (pts[pts.length - 1].ts - pts[0].ts) / HOUR;
  wrap.style.width = Math.max(wrap.parentElement.clientWidth, spanH * 12) + 'px';
  const min = Math.floor(Math.min(...pts.map((p) => p.pressure)) - 3), max = Math.ceil(Math.max(...pts.map((p) => p.pressure)) + 9);
  const data = {
    datasets: [
      { label: '気圧予報/推移', data: pts.map((p) => ({ x: p.ts, y: p.pressure })), borderColor: tok('--color-ink'), borderWidth: 2.5, pointRadius: (c) => (c.raw && c.raw.x > fc.now ? 0 : 2), pointBackgroundColor: tok('--color-ink'), tension: 0.3,
        // 実況(いままで)=実線(ネイビー) / 予報(これから)=点線(青)
        segment: { borderColor: (c) => (c.p0.parsed.x >= fc.now ? tok('--color-primary') : tok('--color-ink')), borderDash: (c) => (c.p0.parsed.x >= fc.now ? [6, 5] : undefined) } },
      { label: 'アメダス実況', data: fc.observed.map((o) => ({ x: o.ts, y: o.pressure })), borderColor: tok('--color-ink'), borderWidth: 2, pointRadius: 0, hidden: !fc.observed.length }, // 実況は実線
    ],
  };
  const opts = {
    responsive: true, maintainAspectRatio: false, animation: false,
    layout: { padding: { top: 48 } },
    scales: {
      x: { type: 'linear', min: pts[0].ts, max: pts[pts.length - 1].ts, ticks: { stepSize: 6 * HOUR, maxRotation: 0, font: { size: 10 }, callback: (v) => { const d = new Date(v); return [`${d.getMonth() + 1}/${d.getDate()}`, `${d.getHours()}時`]; } }, grid: { color: 'rgba(128,128,128,.15)' } },
      y: { min, max, ticks: { display: false } }, // 縦軸は横スクロールしても残るよう、HTML側(#yAxis)に描画
    },
    plugins: { legend: { display: false }, tooltip: { callbacks: { title: (it) => fmtDT(it[0].parsed.x), label: (it) => { const p = pts.find((q) => q.ts === it.parsed.x); return `${it.parsed.y.toFixed(1)} hPa` + (p?.rate != null ? ` (${p.rate > 0 ? '+' : ''}${p.rate.toFixed(1)}/h ${LABEL[p.level]})` : ''); } } } },
  };
  Chart.defaults.font.family = FONT;
  if (S.chart) S.chart.destroy();
  S.chart = new Chart($('#chart'), { type: 'line', data, options: opts, plugins: [overlay] });
  S.chart.$pts = pts; S.chart.$now = fc.now; S.chart.$logs = logs;
  S.chart.update('none');
  drawYAxis(S.chart, min, max);
  // 現在時刻付近まで自動スクロール
  const sc = $('#chartScroll');
  sc.scrollLeft = Math.max(0, ((fc.now - pts[0].ts) / (pts[pts.length - 1].ts - pts[0].ts)) * wrap.clientWidth - sc.clientWidth * 0.3);
}

function drawYAxis(chart, min, max) {
  const box = $('#yAxis'); box.replaceChildren();
  box.style.height = $('#chartWrap').style.height || '300px';
  const step = max - min > 30 ? 10 : max - min > 14 ? 5 : 2;
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) box.append(h('span', { style: `top:${chart.scales.y.getPixelForValue(v)}px` }, String(v)));
  box.append(h('span', { style: 'top:6px;font-size:9px' }, 'hPa'));
}

const jmaText = (w) => w || '';
function renderJma(j) {
  const el = $('#jma');
  if (!j?.days?.length) { el.hidden = true; return; }
  el.hidden = false;
  const dow = '日月火水木金土';
  el.replaceChildren(
    h('div', { class: 'jma-row' }, ...j.days.slice(0, 3).map((d) => { const [y, m, dd] = d.date.split('-').map(Number); const wd = new Date(Date.UTC(y, m - 1, dd)).getUTCDay();
      return h('div', { class: 'jma-cell' }, h('b', {}, `${m}/${dd}(${dow[wd]})`), h('span', {}, jmaText(d.weather)), h('span', { class: 'pop' }, d.pop != null ? `☂${d.pop}%` : '')); })),
    h('div', { class: 'muted' }, `気象庁予報（${j.office || '気象庁'}・降水確率は日ごとの最大値）`));
}

// ---------- 記録 ----------
function renderPain() {
  const box = $('#pain'); box.replaceChildren(...painButtons((i) => { S.pain = i; renderPain(); }, S.pain).children);
}
function renderTags() {
  const box = $('#tags'); box.replaceChildren();
  [...DEFAULT_TAGS, ...S.me.tags].forEach((t) => {
    const custom = S.me.tags.includes(t);
    const c = h('button', { class: 'chip' + (S.tags.has(t) ? ' on' : ''), onclick: () => { S.tags.has(t) ? S.tags.delete(t) : S.tags.add(t); renderTags(); } }, t);
    if (custom) { // 長押しで独自タグ削除
      let tm; c.addEventListener('touchstart', () => (tm = setTimeout(async () => { if (confirm(`タグ「${t}」を削除しますか？`)) { await api('/tags?v=' + encodeURIComponent(t), { method: 'DELETE' }); S.me = await api('/me'); S.tags.delete(t); renderTags(); } }, 700)), { passive: true });
      c.addEventListener('touchend', () => clearTimeout(tm)); c.addEventListener('touchmove', () => clearTimeout(tm));
    }
    box.append(c);
  });
}
$('#addTag').addEventListener('click', async () => {
  const v = $('#newTag').value.trim(); if (!v) return;
  try { await api('/tags', { method: 'POST', body: { tag: v } }); S.me = await api('/me'); S.tags.add(v); $('#newTag').value = ''; renderTags(); } catch { toast('追加できませんでした'); }
});
function renderMyMeds() {
  const box = $('#myMeds'); box.replaceChildren();
  if (!S.me.myMeds.length) return box.append(h('span', { class: 'muted' }, 'マイ薬リストは空です（検索した薬の「★」で追加）'));
  S.me.myMeds.forEach((m) => box.append(h('button', { class: 'chip' + (S.meds.has(m) ? ' on' : ''), onclick: () => { S.meds.has(m) ? S.meds.delete(m) : S.meds.add(m); renderMyMeds(); renderSelMeds(); } }, '💊 ' + m)));
}
function renderSelMeds() {
  const box = $('#selMeds'); box.replaceChildren();
  S.meds.forEach((m) => {
    box.append(h('button', { class: 'chip on x', onclick: () => { S.meds.delete(m); renderSelMeds(); renderMyMeds(); } }, m));
    if (!S.me.myMeds.includes(m)) box.append(h('button', { class: 'chip', onclick: async () => { await api('/mymeds', { method: 'POST', body: { name: m } }); S.me = await api('/me'); renderMyMeds(); renderSelMeds(); toast('マイ薬リストに追加しました'); } }, '★ マイ薬に追加'));
  });
}
let medTimer;
$('#medQ').addEventListener('input', (e) => {
  clearTimeout(medTimer);
  const q = e.target.value.trim();
  if (!q) return $('#medSug').replaceChildren();
  medTimer = setTimeout(async () => {
    const r = await api('/drugs?q=' + encodeURIComponent(q)).catch(() => []);
    $('#medSug').replaceChildren(...r.map((d) => h('button', { onclick: () => { S.meds.add(d.name); $('#medQ').value = ''; $('#medSug').replaceChildren(); renderSelMeds(); renderMyMeds(); } }, d.name, ' ', h('small', {}, d.maker || ''))),
      ...(r.length ? [] : [h('button', { onclick: () => { S.meds.add(q); $('#medQ').value = ''; $('#medSug').replaceChildren(); renderSelMeds(); } }, `「${q}」をそのまま追加`)]));
  }, 200);
});

$('#save').addEventListener('click', async () => {
  if (S.pain == null) return toast('痛みの度合いを選んでください');
  const ts = new Date($('#when').value).getTime();
  if (!Number.isFinite(ts)) return toast('日時を確認してください');
  const body = { ts, pain: S.pain, tags: [...S.tags], meds: [...S.meds], note: $('#note').value };
  try {
    await saveLog(body, S.editId);
    toast('記録しました'); resetForm(); loadLogs();
  } catch (e) { toast(e.message === 'bad_ts' ? '日時が範囲外です' : '保存できませんでした'); }
});
$('#cancelEdit').addEventListener('click', resetForm);
function resetForm() {
  S.editId = null; S.pain = null; S.tags.clear(); S.meds.clear();
  $('#note').value = ''; $('#when').value = toLocalInput(Date.now());
  $('#formTitle').textContent = '体調を記録'; $('#save').textContent = '記録する'; $('#cancelEdit').hidden = true;
  renderPain(); renderTags(); renderMyMeds(); renderSelMeds();
}
const pressureNote = (l) => (l.pressure == null ? "" : `気圧 ${l.pressure.toFixed(1)}hPa` + (l.diff6 == null ? '' : `（6時間前比 ${l.diff6 > 0 ? '+' : ''}${l.diff6.toFixed(1)}）`));
function logRow(l) {
  const note = pressureNote(l);
  return h('li', {},
    h('div', {}, h('div', { class: 'logrow' }, faceEl(l.pain, 26), h('span', {}, fmtDT(l.ts))), h('div', { class: 'meta' }, [...l.tags, ...l.meds.map((m) => '💊' + m)].join(' / ') || '—'),
      note ? h('div', { class: 'meta pr' + (l.diff6 != null && l.diff6 <= -1.5 ? ' down' : '') }, note) : null),
    h('div', { class: 'acts' },
      h('button', { class: 'link', onclick: () => editLog(l) }, '編集'),
      h('button', { class: 'link', onclick: async () => { if (confirm('この記録を削除しますか？')) { await api('/logs/' + l.id, { method: 'DELETE' }); loadLogs(); } } }, '削除')));
}
async function loadLogs() {
  S.logs = await api(`/logs?from=${Date.now() - 30 * 24 * HOUR}`);
  const ul = $('#logList'); ul.replaceChildren();
  if (!S.logs.length) ul.append(h('li', {}, h('span', { class: 'muted' }, 'まだ記録がありません')));
  else S.logs.slice(0, 30).forEach((l) => ul.append(logRow(l)));
  if (S.logMode === 'cal') loadCal();
}

// ---------- 月間カレンダー(痛みの度合いを日ごとに表示) ----------
S.logMode = 'list'; S.calDay = null;
const monthStart = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
S.cal = monthStart(new Date());
const dayKey = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
function setLogMode(m) {
  S.logMode = m;
  document.querySelectorAll('#logMode button').forEach((b) => b.classList.toggle('on', b.dataset.m === m));
  $('#logList').hidden = m !== 'list'; $('#calBox').hidden = m !== 'cal';
  if (m === 'cal') loadCal();
}
document.querySelectorAll('#logMode button').forEach((b) => b.addEventListener('click', () => setLogMode(b.dataset.m)));
$('#calPrev').addEventListener('click', () => { S.cal = new Date(S.cal.getFullYear(), S.cal.getMonth() - 1, 1); S.calDay = null; loadCal(); });
$('#calNext').addEventListener('click', () => { S.cal = new Date(S.cal.getFullYear(), S.cal.getMonth() + 1, 1); S.calDay = null; loadCal(); });
async function loadCal() {
  const from = S.cal, to = new Date(from.getFullYear(), from.getMonth() + 1, 1);
  $('#calTitle').textContent = `${from.getFullYear()}年${from.getMonth() + 1}月`;
  $('#calNext').disabled = to > new Date();
  const logs = await api(`/logs?from=${from.getTime()}&to=${to.getTime() - 1}`);
  const by = new Map();
  logs.forEach((l) => { const k = dayKey(new Date(l.ts)); (by.get(k) || by.set(k, []).get(k)).push(l); });
  const grid = $('#calGrid'); grid.replaceChildren();
  ['日', '月', '火', '水', '木', '金', '土'].forEach((w) => grid.append(h('div', { class: 'cal-w' }, w)));
  for (let i = 0; i < from.getDay(); i++) grid.append(h('div', {}));
  const days = new Date(from.getFullYear(), from.getMonth() + 1, 0).getDate();
  for (let d = 1; d <= days; d++) {
    const date = new Date(from.getFullYear(), from.getMonth(), d), ls = by.get(dayKey(date));
    const worst = ls ? Math.max(...ls.map((l) => l.pain)) : 0;
    const future = date > new Date();
    const cell = h('button', { class: 'cal-d' + (ls ? ' has' : '') + (S.calDay === d ? ' sel' : ''), disabled: future, 'aria-label': `${d}日` + (ls ? ` 最大の痛み ${worst}` : future ? '' : ' 記録なし（タップで追加）'),
      onclick: () => { if (ls) { S.calDay = d; loadCal(); } else openLogForm(date); } }, h('span', {}, String(d)), ls ? faceEl(worst, 22) : null);
    grid.append(cell);
  }
  const dl = $('#calDay'); dl.replaceChildren();
  const sel = S.calDay && by.get(dayKey(new Date(from.getFullYear(), from.getMonth(), S.calDay)));
  if (sel) { dl.append(h('li', { class: 'cal-h' }, `${from.getMonth() + 1}月${S.calDay}日の記録`)); sel.forEach((l) => dl.append(logRow(l)));
    dl.append(h('li', {}, h('button', { class: 'link', onclick: () => openLogForm(new Date(from.getFullYear(), from.getMonth(), S.calDay)) }, 'この日に記録を追加'))); }
  else dl.append(h('li', {}, h('span', { class: 'muted' }, ls0(by) ? '日付をタップすると、その日の記録を表示（記録のない日は追加）します' : 'この月の記録はありません')));
}
const ls0 = (by) => by.size > 0;
// 記録フォームを開く(過去の日付の追加用)。「くわしく記録する」を展開し、日時欄にフォーカス
function openLogForm(date) {
  resetForm();
  if (date) { const d = new Date(date); if (!isToday(d)) d.setHours(12, 0, 0, 0); else d.setTime(Date.now()); $('#when').value = toLocalInput(d.getTime()); }
  const more = $('#logMore'); if (more) more.open = true;
  $('#formTitle').textContent = '過去の記録を追加';
  $('#when').scrollIntoView({ behavior: 'smooth', block: 'center' }); $('#when').focus({ preventScroll: true });
}
$('#addPast').addEventListener('click', () => openLogForm(null));
function editLog(l) {
  S.editId = l.id; S.pain = l.pain; S.tags = new Set(l.tags); S.meds = new Set(l.meds);
  $('#note').value = l.note; $('#when').value = toLocalInput(l.ts);
  $('#formTitle').textContent = '記録を編集'; $('#save').textContent = '更新する'; $('#cancelEdit').hidden = false;
  const more = $('#logMore'); if (more) more.open = true; // 編集時は詳細項目を開いて見せる
  S.me.tags = [...new Set([...S.me.tags, ...l.tags.filter((t) => !DEFAULT_TAGS.includes(t) && !S.me.tags.includes(t))])];
  renderPain(); renderTags(); renderMyMeds(); renderSelMeds(); window.scrollTo(0, 0);
}

// ---------- 分析 ----------
async function loadInsight() {
  const r = await api('/insights');
  // 傾向表示に必要な記録件数への進捗（必要件数の定義はサーバー側のインサイト算出条件と同じ）
  const prog = $('#insightProg');
  if (prog && r.needed) {
    const left = r.remaining ?? Math.max(0, r.needed - (r.analyzed || 0));
    prog.hidden = !left;
    if (left) {
      $('#insightProgText').textContent = `傾向が見えるまで あと${left}件分（気圧と照合できた「痛み3以上」の記録 ${r.analyzed || 0} / ${r.needed}件）`;
      $('#insightProgFill').style.width = `${Math.round(((r.analyzed || 0) / r.needed) * 100)}%`;
    }
  }
  // 重ね合わせプレビュー: 記録が1件以上あれば、気圧グラフ(気圧タブと同じ部品)に自分の記録を打点
  const ic = $('#insightChartCard');
  ic.hidden = !r.totalLogs;
  // 説明文: 傾向が出る前は「あと何件で出るか」、出たあとはグラフの説明だけ
  const left = r.needed ? (r.remaining ?? Math.max(0, r.needed - (r.analyzed || 0))) : 0;
  $('#insightChartNote').textContent = '気圧グラフに、記録した体調の顔を重ねています（直近7日間）。' + (left ? `「痛み3以上」の記録があと${left}件集まると、上の「傾向」が出ます。` : '');
  if (r.totalLogs) {
    try {
      const [fc, logs] = await Promise.all([api('/forecast?area=' + S.sel), api(`/logs?from=${Date.now() - 7 * 24 * HOUR}`)]);
      if (S.view === 'insight') drawChart(fc, logs);
    } catch { /* グラフが出せなくても傾向は表示する */ }
  }
  $('#insightText').textContent = r.text;
  const d = r.detail;
  $('#insightDetail').textContent = `記録 ${r.totalLogs}件 / 不調(痛み3以上) ${r.events}件 / 気圧と照合できた件数 ${r.analyzed}件` +
    (d ? `\n不調時の直前3時間の平均気圧変化 ${d.meanDropAtEvents}hPa（全期間 ${d.meanDropBaseline}hPa）` : '');
  $('#insightDetail').style.whiteSpace = 'pre-line';
}

// ---------- 設定 ----------
function renderSettings() {
  const ul = $('#areaList'); ul.replaceChildren();
  S.me.areas.forEach((c, i) => ul.append(h('li', {}, h('span', {}, S.areaName[c], i === 0 ? h('span', { class: 'muted' }, '（主エリア）') : ''),
    S.me.areas.length > 1 ? h('button', { class: 'link', onclick: () => saveAreas(S.me.areas.filter((x) => x !== c)) }, '削除') : null)));
  const sel = $('#areaSel'); sel.replaceChildren(...S.areas.filter((a) => !S.me.areas.includes(a.code)).map((a) => h('option', { value: a.code }, a.name)));
  $('#addArea').disabled = S.me.areas.length >= 3;
  $('#notifyChk').checked = S.me.notify && S.me.hasPush;
  $('#pushState').textContent = S.me.hasPush ? '通知: この端末で有効' : '通知: この端末では未設定';
  if ($('#notifyMin')) $('#notifyMin').value = S.me.notifyMin || 'caution';
  if ($('#notifyHour')) $('#notifyHour').value = String(S.me.notifyHour ?? 20);
  if ($('#notifyTest')) $('#notifyTest').hidden = !S.me.hasPush;
  const ml = $('#myMedList'); ml.replaceChildren();
  if (!S.me.myMeds.length) ml.append(h('li', {}, h('span', { class: 'muted' }, '登録なし')));
  S.me.myMeds.forEach((m) => ml.append(h('li', {}, m, h('button', { class: 'link', onclick: async () => { await api('/mymeds?v=' + encodeURIComponent(m), { method: 'DELETE' }); S.me = await api('/me'); S.meds.delete(m); renderSettings(); renderMyMeds(); renderSelMeds(); } }, '削除'))));
}
async function saveAreas(areas) {
  S.me = await api('/me', { method: 'PUT', body: { areas } });
  if (!S.me.areas.includes(S.sel)) S.sel = S.me.areas[0];
  renderSettings(); renderChips();
}
$('#addArea').addEventListener('click', () => { const v = $('#areaSel').value; if (v) saveAreas([...S.me.areas, v]); });

const loadScript = (src) => new Promise((ok, ng) => { const s = h('script', { src }); s.onload = ok; s.onerror = ng; document.head.append(s); });
async function enablePush() {
  if (!S.cfg.firebase || !S.cfg.vapidKey) throw new Error('サーバーに通知(FCM)の設定がありません');
  if (!('serviceWorker' in navigator) || !('Notification' in window)) throw new Error('このブラウザは通知に対応していません（iPhoneはホーム画面に追加してください）');
  if ((await Notification.requestPermission()) !== 'granted') throw new Error('通知が許可されませんでした');
  const reg = await navigator.serviceWorker.ready;
  await loadScript('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
  await loadScript('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');
  // eslint-disable-next-line no-undef
  firebase.initializeApp(S.cfg.firebase);
  // eslint-disable-next-line no-undef
  const token = await firebase.messaging().getToken({ vapidKey: S.cfg.vapidKey, serviceWorkerRegistration: reg });
  S.me = await api('/me', { method: 'PUT', body: { fcm_token: token, notify: true } });
}
$('#notifyChk').addEventListener('change', async (e) => {
  try {
    if (e.target.checked) { if (!S.me.hasPush) await enablePush(); else S.me = await api('/me', { method: 'PUT', body: { notify: true } }); }
    else S.me = await api('/me', { method: 'PUT', body: { notify: false } });
    toast(e.target.checked ? '通知をオンにしました' : '通知をオフにしました');
  } catch (err) { e.target.checked = false; toast(err.message); }
  renderSettings();
});
// 通知のしきい値・時刻（フェーズ3-2。初期値は現行どおり「注意以上・20時」）
$('#notifyMin')?.addEventListener('change', async (e) => {
  try { S.me = await api('/me', { method: 'PUT', body: { notify_min: e.target.value } }); toast('通知するレベルを変更しました'); } catch { toast('変更できませんでした'); }
  renderSettings();
});
$('#notifyHour')?.addEventListener('change', async (e) => {
  const v = Number(e.target.value); // await中にrenderSettingsで値が書き換わってもトースト文言がずれないよう退避
  try { S.me = await api('/me', { method: 'PUT', body: { notify_hour: v } }); toast(`通知時刻を${v}時に変更しました`); } catch { toast('変更できませんでした'); }
  renderSettings();
});
$('#notifyTest')?.addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  if (!S.me.hasPush) { toast('先に通知をオンにしてください'); return; }
  btn.disabled = true;
  try { await api('/push/test', { method: 'POST' }); toast('テスト通知を送信しました'); }
  catch (err) { toast(err.message === 'no_token' ? '通知がオフです' : 'テスト送信できませんでした'); }
  finally { btn.disabled = false; }
});
$('#exportCsv').addEventListener('click', async () => {
  try {
    const logs = await api('/logs?from=1&to=' + (Date.now() + HOUR));
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['id', 'ts', 'datetime', 'pain', 'tags', 'meds', 'note', 'area'], ...[...logs].reverse().map((l) => [l.id, l.ts, new Date(l.ts).toISOString(), l.pain, l.tags.join('|'), l.meds.join('|'), l.note, l.area])];
    const blob = new Blob(['\ufeff' + rows.map((r) => r.map(q).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `welmy-logs-${new Date().toISOString().slice(0, 10)}.csv` });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast(`${logs.length}件の記録をダウンロードしました`);
  } catch { toast('ダウンロードできませんでした'); }
});
$('#wipe').addEventListener('click', async () => {
  if (!confirm('記録・設定をすべて削除します。元に戻せません。よろしいですか？')) return;
  await api('/me', { method: 'DELETE' }).catch(() => {});
  store.del('uid'); S.tags.clear(); S.meds.clear(); S.pain = null; await boot(true); toast('削除しました');
});

// オフライン表示: 前回取得した内容を出していることを伝える
function offlineBar() {
  let bar = document.getElementById('offlineBar');
  if (navigator.onLine) { bar?.remove(); return; }
  if (!bar) { bar = h('div', { id: 'offlineBar', role: 'status' }, 'オフラインです。前回の内容を表示しています（記録の保存はオンラインで）。'); document.body.prepend(bar); }
}
window.addEventListener('online', () => { offlineBar(); if (S.view === 'dash') loadDash(); });
window.addEventListener('offline', offlineBar);
offlineBar();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
boot().catch((e) => { console.error(e); toast('起動に失敗しました'); });
