/* ホーム画面への追加の案内(PWA)。サービスワーカーの登録も行う。
   案内の表示は、独自ドメインへ移ってから有効にする(旧ドメインで追加した人に、追加し直しをさせないため)。
   有効にするには ENABLE_INSTALL_HINT を true に。動作確認だけなら URL に ?pwa=1 を付ける。 */
(function () {
  var ENABLE_INSTALL_HINT = false;
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(function () {});
  var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  var force = /[?&]pwa=1/.test(location.search);
  if (standalone || !(ENABLE_INSTALL_HINT || force)) return;
  var KEY = 'pwaHintUntil';
  try { if (!force && Number(localStorage.getItem(KEY)) > Date.now()) return; } catch (e) {}
  var ios = /iPhone|iPad|iPod/.test(navigator.userAgent), deferred = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; show(); });
  if (ios) setTimeout(show, 2500);
  var shown = false;
  function show() {
    if (shown || document.getElementById('pwaHint')) return; shown = true;
    var b = document.createElement('div'); b.id = 'pwaHint'; b.setAttribute('role', 'dialog'); b.setAttribute('aria-label', 'ホーム画面に追加');
    b.innerHTML = '<img src="/icon-192.png" width="40" height="40" alt="" aria-hidden="true"><div class="pwa-t"><b>ホーム画面に追加</b><span>' +
      (ios ? '共有ボタン <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V4M8 8l4-4 4 4M5 12v7h14v-7"/></svg> から「ホーム画面に追加」で、アプリのように使えます。通知もこの形で届きます。' : 'アプリのようにすぐ開けて、気圧の通知も受け取れます。') +
      '</span></div>' + (ios ? '' : '<button type="button" class="pwa-add">追加</button>') + '<button type="button" class="pwa-x" aria-label="閉じる">×</button>';
    document.body.appendChild(b);
    var add = b.querySelector('.pwa-add');
    if (add) add.addEventListener('click', function () { if (deferred) { deferred.prompt(); deferred.userChoice.finally(function () { b.remove(); }); } });
    b.querySelector('.pwa-x').addEventListener('click', function () { b.remove(); try { localStorage.setItem(KEY, String(Date.now() + 14 * 864e5)); } catch (e) {} });
  }
})();
