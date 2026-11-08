/* global Chart */
const $ = (s) => document.querySelector(s);
const LABEL = { none: '安定', rise: '上昇注意', slight: 'やや注意', caution: '注意', warning: '警戒' };
const COLOR = { rise: '#3b82f6', slight: '#eab308', caution: '#f97316', warning: '#dc2626' };
const FACES = ['🙂', '😕', '😣', '😖', '😫'];
const FACE_LABEL = ['軽い', 'やや痛い', '痛い', 'かなり痛い', '耐えがたい'];
const DEFAULT_TAGS = ['頭痛', 'だるさ', 'めまい', '肩こり', '吐き気', '関節痛', '眠気'];
const HOUR = 3600e3;

const S = {
  uid: null, me: null, areas: [], areaName: {}, cur: null /* 現在地の都道府県 */, view: 'dash',
  sel: null, pain: 0, tags: new Set(), meds: new Set(), editId: null, chart: null, fc: null, logs: [],
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
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 2600);
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
  renderAll();
}

function renderAll() {
  renderChips(); renderPain(); renderTags(); renderMyMeds(); renderSelMeds(); renderSettings();
  $('#when').value = toLocalInput(Date.now());
  show(S.view);
}

// ---------- タブ ----------
function show(v) {
  S.view = v;
  document.querySelectorAll('.view').forEach((e) => (e.hidden = e.id !== 'view-' + v));
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.v === v));
  if (v === 'dash') loadDash();
  if (v === 'log') loadLogs();
  if (v === 'insight') loadInsight();
  window.scrollTo(0, 0);
}
document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => show(b.dataset.v)));

// ---------- ダッシュボード ----------
function renderChips() {
  const box = $('#areaChips'); box.replaceChildren();
  const mk = (code, label) => h('button', { class: 'chip' + (S.sel === code ? ' on' : ''), role: 'tab', onclick: () => { S.sel = code; renderChips(); loadDash(); } }, label);
  box.append(h('button', { class: 'chip', onclick: locate }, '📍 現在地' + (S.cur ? `（${S.areaName[S.cur]}）` : '')));
  const codes = [...new Set([...(S.cur ? [S.cur] : []), ...S.me.areas])];
  codes.forEach((c) => box.append(mk(c, S.areaName[c])));
}

function locate() {
  if (!navigator.geolocation) return toast('この端末では現在地を取得できません');
  navigator.geolocation.getCurrentPosition(
    async (p) => {
      // 座標は都道府県の判定にだけ使い、サーバーにも保存されない
      const a = await api(`/nearest?lat=${p.coords.latitude}&lon=${p.coords.longitude}`);
      S.cur = a.code; S.sel = a.code; renderChips(); loadDash();
    },
    () => toast('位置情報を取得できませんでした。設定からエリアを登録できます'),
    { timeout: 10000, maximumAge: 600000 },
  );
}

async function loadDash() {
  if (!S.sel) return;
  const code = S.sel;
  try {
    const [fc, logs, st] = await Promise.all([
      api('/forecast?area=' + code),
      api(`/logs?from=${Date.now() - 72 * HOUR}`),
      api('/area-stats?area=' + code),
    ]);
    if (code !== S.sel) return; // 切替競合
    S.fc = fc; renderSummary(fc); drawChart(fc, logs); renderJma(fc.jma); renderStats(st);
    $('#fetched').textContent = fc.fetchedAt ? `更新 ${fmtDT(fc.fetchedAt)}` : '';
    $('#demoBadge').hidden = !fc.demo && !S.cfg.demo;
  } catch (e) { toast('気象データを取得できませんでした'); }
}

function renderSummary(fc) {
  const now = fc.now;
  const next = fc.points.filter((p) => p.ts > now && p.ts <= now + 24 * HOUR && p.level !== 'none');
  const sev = { warning: 4, caution: 3, slight: 2, rise: 1 };
  const worst = next.sort((a, b) => sev[b.level] - sev[a.level] || a.rate - b.rate)[0];
  const el = $('#summary'); el.className = 'card summary ' + (worst ? worst.level : '');
  const last = [...fc.points].reverse().find((p) => p.ts <= now) || fc.points[0];
  const ico = { warning: '🚨', caution: '⚠️', slight: '🟡', rise: '🔼' }[worst?.level] || '✅';
  el.replaceChildren(
    h('div', { class: 'ico' }, ico),
    h('div', {},
      h('b', {}, worst ? `今後24時間: ${LABEL[worst.level]}` : '今後24時間: 大きな変動なし'),
      h('div', { class: 'muted' }, worst
        ? `${fmtDT(worst.ts)}ごろ ${worst.rate > 0 ? '+' : ''}${worst.rate.toFixed(1)} hPa/h`
        : '気圧は比較的安定する見込みです'),
      last?.pressure != null ? h('div', { class: 'muted' }, `現在の海面気圧 約${Math.round(last.pressure)} hPa`) : null),
  );
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
      ctx.font = '16px sans-serif'; ctx.fillText(wxIcon(p.icon), px, a.top + 14);
      if (p.temp != null) { ctx.font = '11px sans-serif'; ctx.fillText(Math.round(p.temp) + '°', px, a.top + 30); }
    });
    // 現在時刻線
    const nx = x.getPixelForValue(chart.$now);
    ctx.strokeStyle = '#888'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(nx, a.top); ctx.lineTo(nx, a.bottom); ctx.stroke(); ctx.setLineDash([]);
    // 過去の痛み記録アイコン
    ctx.font = '22px sans-serif';
    (chart.$logs || []).forEach((l) => {
      const py = pressureAt(pts, l.ts);
      if (py == null) return;
      ctx.fillText(FACES[l.pain - 1], x.getPixelForValue(l.ts), y.getPixelForValue(py) + 8);
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
  const min = Math.floor(Math.min(...pts.map((p) => p.pressure)) - 3), max = Math.ceil(Math.max(...pts.map((p) => p.pressure)) + 3);
  const data = {
    datasets: [
      { label: '気圧予報/推移', data: pts.map((p) => ({ x: p.ts, y: p.pressure })), borderColor: '#2563eb', borderWidth: 2.5, pointRadius: 2, tension: 0.3 },
      { label: 'アメダス実況', data: fc.observed.map((o) => ({ x: o.ts, y: o.pressure })), borderColor: '#10b981', borderDash: [4, 4], borderWidth: 2, pointRadius: 3, hidden: !fc.observed.length },
    ],
  };
  const opts = {
    responsive: true, maintainAspectRatio: false, animation: false,
    layout: { padding: { top: 38 } },
    scales: {
      x: { type: 'linear', min: pts[0].ts, max: pts[pts.length - 1].ts, ticks: { stepSize: 6 * HOUR, maxRotation: 0, font: { size: 10 }, callback: (v) => { const d = new Date(v); return d.getHours() === 0 ? `${d.getMonth() + 1}/${d.getDate()}` : d.getHours() + '時'; } }, grid: { color: 'rgba(128,128,128,.15)' } },
      y: { min, max, ticks: { display: false } }, // 縦軸は横スクロールしても残るよう、HTML側(#yAxis)に描画
    },
    plugins: { legend: { display: false }, tooltip: { callbacks: { title: (it) => fmtDT(it[0].parsed.x), label: (it) => { const p = pts.find((q) => q.ts === it.parsed.x); return `${it.parsed.y.toFixed(1)} hPa` + (p?.rate != null ? ` (${p.rate > 0 ? '+' : ''}${p.rate.toFixed(1)}/h ${LABEL[p.level]})` : ''); } } } },
  };
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
    h('b', {}, '気象庁の天気予報'),
    ...j.days.slice(0, 3).map((d) => { const [y, m, dd] = d.date.split('-').map(Number); const wd = new Date(Date.UTC(y, m - 1, dd)).getUTCDay(); return h('div', { class: 'jma-day' }, h('b', {}, `${m}/${dd}(${dow[wd]})`), h('span', {}, jmaText(d.weather)), h('span', { class: 'pop' }, d.pop != null ? `☂${d.pop}%` : '')); }),
    h('div', { class: 'muted' }, `${j.office || '気象庁'} 発表（降水確率は日ごとの最大値）`),
  );
}

function renderStats(st) {
  const el = $('#stats'); const name = S.areaName[S.sel];
  el.replaceChildren(
    h('b', {}, '地域の体調（匿名集計）'),
    st.hidden
      ? h('p', { class: 'muted' }, `${name}は集計に必要な利用者数に達していないため表示できません（プライバシー保護のため）。`)
      : h('p', { class: 'big' }, `現在、${name}の ${st.percent}% が不調を記録しています`),
    h('div', { class: 'muted' }, `過去${st.windowH}時間以内に「痛み」を記録した、アクティブユーザーの割合`),
  );
}

// ---------- 記録 ----------
function renderPain() {
  const box = $('#pain'); box.replaceChildren();
  FACES.forEach((f, i) => box.append(h('button', { class: S.pain === i + 1 ? 'on' : '', role: 'radio', 'aria-checked': S.pain === i + 1, 'aria-label': FACE_LABEL[i], onclick: () => { S.pain = i + 1; renderPain(); } }, f, h('small', {}, FACE_LABEL[i]))));
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
  if (!S.pain) return toast('痛みの度合いを選んでください');
  const ts = new Date($('#when').value).getTime();
  if (!Number.isFinite(ts)) return toast('日時を確認してください');
  const body = { ts, pain: S.pain, tags: [...S.tags], meds: [...S.meds], note: $('#note').value };
  try {
    if (S.editId) await api('/logs/' + S.editId, { method: 'PUT', body });
    else await api('/logs', { method: 'POST', body });
    toast('記録しました'); resetForm(); loadLogs();
  } catch (e) { toast(e.message === 'bad_ts' ? '日時が範囲外です' : '保存できませんでした'); }
});
$('#cancelEdit').addEventListener('click', resetForm);
function resetForm() {
  S.editId = null; S.pain = 0; S.tags.clear(); S.meds.clear();
  $('#note').value = ''; $('#when').value = toLocalInput(Date.now());
  $('#formTitle').textContent = '体調を記録'; $('#save').textContent = '記録する'; $('#cancelEdit').hidden = true;
  renderPain(); renderTags(); renderMyMeds(); renderSelMeds();
}
async function loadLogs() {
  S.logs = await api(`/logs?from=${Date.now() - 30 * 24 * HOUR}`);
  const ul = $('#logList'); ul.replaceChildren();
  if (!S.logs.length) return ul.append(h('li', {}, h('span', { class: 'muted' }, 'まだ記録がありません')));
  S.logs.slice(0, 30).forEach((l) => ul.append(h('li', {},
    h('div', {}, h('div', {}, `${FACES[l.pain - 1]} ${fmtDT(l.ts)}`), h('div', { class: 'meta' }, [...l.tags, ...l.meds.map((m) => '💊' + m)].join(' / ') || '—')),
    h('div', { class: 'acts' },
      h('button', { class: 'link', onclick: () => editLog(l) }, '編集'),
      h('button', { class: 'link', onclick: async () => { if (confirm('この記録を削除しますか？')) { await api('/logs/' + l.id, { method: 'DELETE' }); loadLogs(); } } }, '削除')))));
}
function editLog(l) {
  S.editId = l.id; S.pain = l.pain; S.tags = new Set(l.tags); S.meds = new Set(l.meds);
  $('#note').value = l.note; $('#when').value = toLocalInput(l.ts);
  $('#formTitle').textContent = '記録を編集'; $('#save').textContent = '更新する'; $('#cancelEdit').hidden = false;
  S.me.tags = [...new Set([...S.me.tags, ...l.tags.filter((t) => !DEFAULT_TAGS.includes(t) && !S.me.tags.includes(t))])];
  renderPain(); renderTags(); renderMyMeds(); renderSelMeds(); window.scrollTo(0, 0);
}

// ---------- 分析 ----------
async function loadInsight() {
  const r = await api('/insights');
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
$('#wipe').addEventListener('click', async () => {
  if (!confirm('記録・設定をすべて削除します。元に戻せません。よろしいですか？')) return;
  await api('/me', { method: 'DELETE' }).catch(() => {});
  store.del('uid'); S.tags.clear(); S.meds.clear(); S.pain = 0; await boot(true); toast('削除しました');
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
boot().catch((e) => { console.error(e); toast('起動に失敗しました'); });
