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
self.addEventListener('push', event => {
  let data={};try{data=event.data?.json()||{};}catch{}
  const id=Number.isSafeInteger(data.id)&&data.id>0?data.id:null;
  // Only the authenticated inbox is opened. No provider-supplied external click URL.
  const url='/noa-notifications.php'+(id?'?notice='+id:'');
  event.waitUntil(self.registration.showNotification('AInoa · 내 활동 알림',{
    body:typeof data.body==='string'?data.body.slice(0,120):'나와 관련된 새로운 활동이 있어요.',
    icon:'/noa-assets/ainoa-symbol.png',tag:id?'noa-activity-'+id:'noa-activity',renotify:false,data:{url}
  }).then(()=>{
    if(!id||!/^[a-f0-9]{64}$/.test(data.receipt||''))return;
    return fetch('/noa-bridge/notifications.php?receipt=1',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',cache:'no-store',body:JSON.stringify({id,receipt:data.receipt})}).catch(()=>{});
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();let url=new URL('/noa-notifications.php',self.location.origin);
  try{const candidate=new URL(event.notification.data?.url||'',self.location.origin);if(candidate.origin===self.location.origin&&candidate.pathname==='/noa-notifications.php')url=candidate;}catch{}
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{
    for(const client of clients){if(new URL(client.url).origin!==self.location.origin)continue;if('navigate' in client)await client.navigate(url.href);return client.focus();}
    return self.clients.openWindow(url.href);
  }));
});
