/* 全ページ共通の操作まわり（フェーズ1）
   - 通知登録CTA([data-ncta]): 説明モーダルを1枚挟んでからブラウザの通知許可を求める。登録済みなら「通知はオンです」に切り替え。
   - 「体調を記録する」([data-quicklog]): ページ遷移なしのワンタップ記録モーダル。JSが無効ならそのまま /app/#log へ遷移する。
   アプリ本体(/app/)のロジックとは独立した軽量スクリプト。 */
(function () {
  'use strict';
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
  };
  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'class') e.className = attrs[k];
      else if (k.indexOf('on') === 0) e.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null && attrs[k] !== false) e.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c))); });
    return e;
  }
  function api(path, opt) {
    opt = opt || {};
    var uid = store.get('uid');
    return fetch('/api' + path, {
      method: opt.method || 'GET',
      headers: Object.assign({ 'content-type': 'application/json' }, uid ? { 'x-user-id': uid } : {}),
      body: opt.body ? JSON.stringify(opt.body) : undefined,
    }).then(function (r) {
      if (!r.ok) { var e = new Error('http_' + r.status); e.status = r.status; throw e; }
      return r.status === 204 ? null : r.json();
    });
  }
  // 匿名IDが無ければ作る（/app/ と同じ localStorage 'uid' を共有）
  function ensureUser() {
    var uid = store.get('uid');
    if (uid) return Promise.resolve(uid);
    var area = store.get('area');
    return api('/users', { method: 'POST', body: area ? { area_code: area } : {} }).then(function (r) {
      store.set('uid', r.id);
      return r.id;
    });
  }

  /* ---------- モーダル（共通） ---------- */
  var overlay = null;
  function closeModal() {
    if (overlay) { overlay.remove(); overlay = null; document.removeEventListener('keydown', onKey); }
  }
  function onKey(e) { if (e.key === 'Escape') closeModal(); }
  function openModal(title, bodyKids) {
    closeModal();
    var box = el('div', { class: 'wmodal-box', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, [
      el('div', { class: 'wmodal-h' }, [el('b', {}, [title]), el('button', { type: 'button', class: 'wmodal-x', 'aria-label': '閉じる', onclick: closeModal }, ['×'])]),
    ].concat(bodyKids));
    overlay = el('div', { class: 'wmodal', onclick: function (e) { if (e.target === overlay) closeModal(); } }, [box]);
    document.body.append(overlay);
    document.addEventListener('keydown', onKey);
    var f = box.querySelector('button, a'); if (f) f.focus();
    return box;
  }

  /* ---------- 通知登録CTA ---------- */
  var ctas = Array.prototype.slice.call(document.querySelectorAll('[data-ncta]'));
  function setCtaOn() {
    ctas.forEach(function (c) {
      var b = c.querySelector('[data-ncta-btn]');
      if (b) { b.textContent = '通知はオンです'; b.classList.remove('primary'); b.classList.add('is-on'); b.disabled = true; }
      var note = c.querySelector('[data-ncta-note]');
      if (note) { note.textContent = '通知の設定（オフへの切り替え等）は「気圧・記録」の設定からできます。'; note.hidden = false; }
    });
  }
  function ctaNote(msg) {
    ctas.forEach(function (c) { var n = c.querySelector('[data-ncta-note]'); if (n) { n.textContent = msg; n.hidden = !msg; } });
  }
  function loadScript(src) {
    return new Promise(function (ok, ng) { var s = el('script', { src: src }); s.onload = ok; s.onerror = ng; document.head.append(s); });
  }
  // 許可リクエスト〜FCMトークン登録（/app/ の設定と同じサーバーAPIを使う）
  function enablePush() {
    var cfg;
    return api('/config').then(function (c) {
      cfg = c;
      if (!cfg.firebase || !cfg.vapidKey) throw new Error('サーバーに通知(FCM)の設定がありません');
      if (!('serviceWorker' in navigator) || !('Notification' in window)) throw new Error('このブラウザは通知に対応していません（iPhoneは「ホーム画面に追加」したアプリからお試しください）');
      navigator.serviceWorker.register('/sw.js').catch(function () {});
      return Notification.requestPermission();
    }).then(function (perm) {
      if (perm !== 'granted') throw new Error('通知が許可されませんでした');
      return navigator.serviceWorker.ready;
    }).then(function (reg) {
      return loadScript('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js')
        .then(function () { return loadScript('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js'); })
        .then(function () {
          /* global firebase */
          firebase.initializeApp(cfg.firebase);
          return firebase.messaging().getToken({ vapidKey: cfg.vapidKey, serviceWorkerRegistration: reg });
        });
    }).then(function (token) {
      return ensureUser().then(function () { return api('/me', { method: 'PUT', body: { fcm_token: token, notify: true } }); });
    });
  }
  function openNotifyModal() {
    var box = openModal('前の晩の気圧通知', [
      el('p', {}, ['このあと、ブラウザの通知の許可をお聞きします。許可すると、翌日が「注意」以上の気圧低下のときだけ、毎晩20時ごろに通知が届きます。それ以外の日は送りません。']),
      el('p', { class: 'muted small' }, ['通知はいつでも「気圧・記録」の設定からオフにできます。氏名・メールアドレスの登録は不要です。']),
      el('p', { class: 'wmodal-btns' }, [
        el('button', { type: 'button', class: 'btn primary block', onclick: function (e) {
          var b = e.currentTarget; b.disabled = true; b.textContent = '設定しています…';
          enablePush().then(function () { closeModal(); setCtaOn(); }).catch(function (err) {
            closeModal(); ctaNote(err.message || '通知を設定できませんでした');
          });
        } }, ['許可して受け取る']),
        el('button', { type: 'button', class: 'btn block', onclick: closeModal }, ['あとで']),
      ]),
    ]);
    return box;
  }
  if (ctas.length) {
    ctas.forEach(function (c) {
      var b = c.querySelector('[data-ncta-btn]');
      if (b) b.addEventListener('click', openNotifyModal);
    });
    // 登録済みならボタンを切り替える
    if (store.get('uid')) api('/me').then(function (me) { if (me.notify && me.hasPush) setCtaOn(); }).catch(function () {});
  }

  /* ---------- ワンタップ体調記録 ---------- */
  var FACES = ['😊', '🙂', '😕', '😣', '😖', '😫']; // faces.js(手描き風の顔)が読めないときの代用
  var FACE_LABEL = ['痛みなし', '軽い', 'やや痛い', '痛い', 'かなり痛い', '耐えがたい'];
  function quickSave(pain, box) {
    var body = box.querySelector('.wmodal-body');
    body.replaceChildren(el('p', { class: 'muted' }, ['記録しています…']));
    ensureUser().then(function () {
      return api('/logs', { method: 'POST', body: { pain: pain } });
    }).then(function () {
      // 明日の予報の地域: ページで選択中の地域 → 登録済みの主エリア → 既定(東京)
      var area = store.get('area');
      return (area ? Promise.resolve(area) : api('/me').then(function (me) { return (me.areas && me.areas[0]) || '13'; }).catch(function () { return '13'; }))
        .then(function (a) { return api('/week?area=' + a); })
        .catch(function () { return null; });
    }).then(function (w) {
      var d = w && w.days && w.days[1];
      var lb = d && d.pressure ? d.pressure.label : (w ? '安定' : null);
      body.replaceChildren(
        el('p', { class: 'wql-done' }, ['記録しました', lb ? '（明日の予報: ' + lb + '）' : '']),
        el('p', { class: 'wmodal-btns' }, [
          el('a', { class: 'btn block', href: '/app/#log' }, ['記録をくわしく見る・編集する']),
          el('button', { type: 'button', class: 'btn primary block', onclick: closeModal }, ['閉じる']),
        ]),
      );
    }).catch(function () {
      // 保存できないときは、従来どおり記録画面へ
      location.href = '/app/#log';
    });
  }
  function openQuickLog() {
    var box = openModal('体調を記録', [
      el('div', { class: 'wmodal-body' }, [
        el('p', { class: 'muted small' }, ['いまの痛み・不調の度合いをタップすると、その場で記録できます（日時と気圧は自動で記録されます）。']),
        el('div', { class: 'wql-faces', role: 'group', 'aria-label': '痛みの度合い' }, FACES.map(function (f, i) {
          return el('button', { type: 'button', class: 'wql-face', onclick: function () { quickSave(i, box); } }, [el('span', { 'aria-hidden': 'true' }, [window.FACE ? window.FACE.el(i, 40) : f]), el('small', {}, [FACE_LABEL[i]])]);
        })),
        el('p', { class: 'wmodal-btns' }, [el('a', { class: 'btn block', href: '/app/#log' }, ['症状・服薬もくわしく記録する'])]),
      ]),
    ]);
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-quicklog]');
    if (!a || document.body.dataset.page === 'app') return;
    e.preventDefault();
    openQuickLog();
  });
})();
