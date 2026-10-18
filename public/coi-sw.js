// 評価値エンジン (SharedArrayBuffer を使う) を動かすための Service Worker。
// GitHub Pages では HTTP ヘッダーを設定できないので、ここで COOP / COEP ヘッダーを付けて
// ページを cross-origin isolated にする。
// オンライン対戦などに影響しないよう、isolated にするのは ?mode=replay を付けて開いたページだけ。
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || req.method !== 'GET') return;
  if (req.cache === 'only-if-cached' && req.mode !== 'same-origin') return;

  const isolatePage = req.mode === 'navigate' && url.searchParams.get('mode') === 'replay';
  // isolated なページから読むワーカーやスクリプトにも COEP が必要
  const isSubresource = req.mode !== 'navigate';
  if (!isolatePage && !isSubresource) return;

  e.respondWith(
    fetch(req).then((res) => {
      if (res.status === 0 || res.type === 'opaque') return res;
      const headers = new Headers(res.headers);
      headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
      headers.set('Cross-Origin-Resource-Policy', 'same-origin');
      if (isolatePage) headers.set('Cross-Origin-Opener-Policy', 'same-origin');
      return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
    }),
  );
});
