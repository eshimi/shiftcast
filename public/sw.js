// アプリシェルのキャッシュ + FCM(Web Push)の受信
const CACHE = 'kiatsu-shell-v134';
const API_OK = ['/api/week', '/api/forecast', '/api/area-stats', '/api/me', '/api/logs', '/api/areas', '/api/config', '/api/insights', '/api/today']; // オフラインでも前回の値を出すAPI(GETのみ)
const SHELL = ['/app/', '/tokens.css', '/style.css', '/ds.css', '/header.css', '/brand.css', '/dash.css', '/app.js', '/wx.js', '/faces.js', '/manifest.json', '/offline', '/pwa.js', '/terms.html', '/hero/hero.js', '/hero/hero.css', '/vendor/chart.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/') && !API_OK.some((p) => url.pathname === p)) return;
  // network-first（更新を優先し、オフライン時のみ前回のキャッシュ）。ページは取得できなければ offline.html
  // 時刻がクエリに入るAPI(/api/logs)は、クエリなしの1件だけを保存して、オフライン時の代わりに使う
  const key = url.pathname === '/api/logs' ? new Request(url.origin + url.pathname) : e.request;
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(key, copy)); }
        return r;
      })
      .catch(async () => {
        const hit = await caches.match(key);
        if (hit) return hit;
        if (e.request.mode === 'navigate') return (await caches.match('/offline')) || Response.error();
        return Response.error();
      }),
  );
});

self.addEventListener('push', (e) => {
  let d = {};
  try {
    d = e.data.json();
  } catch {}
  const data = d.data || d.notification || d; // FCM data message: {data:{title,body}}
  e.waitUntil(
    self.registration.showNotification(data.title || '気圧アラート', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: '/' },
    }),
  );
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((cs) => (cs.length ? cs[0].focus() : self.clients.openWindow('/app/'))),
  );
});
