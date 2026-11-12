// アプリシェルのキャッシュ + FCM(Web Push)の受信
const CACHE = 'kiatsu-shell-v51';
const SHELL = ['/app/', '/style.css', '/ds.css', '/header.css', '/app.js', '/wx.js', '/faces.js', '/manifest.json', '/terms.html', '/hero/hero.js', '/hero/hero.css', '/icon.svg', '/vendor/chart.js'];

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
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  // network-first（更新を優先し、オフライン時のみキャッシュ）
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        const copy = r.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return r;
      })
      .catch(() => caches.match(e.request)),
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
      icon: '/icon.svg',
      badge: '/icon.svg',
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
