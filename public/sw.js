/* Only the public offline page is cached; private API responses are never cached. */
const OFFLINE_CACHE='youme-offline-v1';
self.addEventListener('install',event=>event.waitUntil((async()=>{await caches.open(OFFLINE_CACHE).then(cache=>cache.add('/offline.html'));await self.skipWaiting()})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('youme-offline-')&&key!==OFFLINE_CACHE)await caches.delete(key);await self.clients.claim()})()));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.mode==='navigate'&&url.origin===self.location.origin&&!url.pathname.startsWith('/api/'))event.respondWith(fetch(event.request).catch(()=>caches.match('/offline.html')))});
self.addEventListener('push',event=>{
 let data={};try{data=event.data?.json()||{}}catch{}
 // Generic lock-screen text intentionally excludes private message/photo contents.
 const title=typeof data.title==='string'?data.title.slice(0,70):'You & Me';
 const options={body:typeof data.body==='string'?data.body.slice(0,240):'Você tem uma novidade no seu cantinho.',icon:'/icon-192.png',badge:'/icon-192.png',tag:data.tag||'youme-message',data:{url:'/#chat'},renotify:true};
 event.waitUntil((async()=>{await self.registration.showNotification(title,options);if(data.kind!=='test')await self.navigator.setAppBadge?.(1)?.catch(()=>{})})());
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{
  await self.navigator.clearAppBadge?.()?.catch(()=>{});
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  for(const client of windows){if(new URL(client.url).origin===self.location.origin){await client.focus();client.postMessage({type:'open-chat'});return}}
  return self.clients.openWindow('/#chat');
 })());
});
self.addEventListener('pushsubscriptionchange',event=>event.waitUntil((async()=>{
 try{const subscription=event.newSubscription||await self.registration.pushManager.subscribe(event.oldSubscription?.options||{userVisibleOnly:true});await fetch('/api/push/subscribe',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(subscription)})}catch{/* Reconciled when the user next opens the installed app. */}
})()));
