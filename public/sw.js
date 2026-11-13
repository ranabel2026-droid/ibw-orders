const CACHE='ibw-shell-v7';
const SHELL=['/','/styles.css','/i18n.js','/app.js','/shamcash-qr.png','/icons/icon-192.png','/icons/icon-512.png','/fonts/Cairo-Regular.ttf','/fonts/Cairo-Bold.ttf'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==location.origin||new URL(e.request.url).pathname.startsWith('/api/'))return;if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).catch(()=>caches.match('/')));return;}e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request)));});
