// Never cache authenticated pages, API responses, member information or music.
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request).catch(() => new Response(
    '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NOA STUDIO</title><body style="background:#090a0e;color:#d7ad62;font:18px system-ui;padding:32px"><h1>NOA STUDIO</h1><p>인터넷 연결을 확인한 뒤 다시 열어 주세요.</p><a href="/" style="color:inherit">다시 연결</a></body></html>',
    {status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}}
  )));
});
