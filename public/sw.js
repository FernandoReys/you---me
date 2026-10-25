/* Only the public offline page is cached; private API responses are never cached. */
const OFFLINE_CACHE='youme-offline-v1';
self.addEventListener('install',event=>event.waitUntil((async()=>{await caches.open(OFFLINE_CACHE).then(cache=>cache.add('/offline.html'));await self.skipWaiting()})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('youme-offline-')&&key!==OFFLINE_CACHE)await caches.delete(key);await self.clients.claim()})()));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.mode==='navigate'&&url.origin===self.location.origin&&!url.pathname.startsWith('/api/'))event.respondWith(fetch(event.request).catch(()=>caches.match('/offline.html')))});
async function privateFetch(url){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4000);try{return await fetch(url,{credentials:'same-origin',cache:'no-store',signal:controller.signal})}finally{clearTimeout(timer)}}
async function privatePushOptions(data){
 let verified=data.kind==='test',avatar='/icon-192.png';
 if(data.recipient){
  try{const response=await privateFetch('/api/me');const me=response.ok?await response.json():null;verified=me?.id===data.recipient;
   if(verified&&typeof data.avatar==='string'&&data.avatar.startsWith('/api/profile-media/'+data.sender+'/avatar?')){
    try{const image=await privateFetch(data.avatar);if(image.ok&&/^image\/(jpeg|png|webp)$/.test(image.headers.get('content-type')||'')){const bytes=new Uint8Array(await image.arrayBuffer());if(bytes.length<=500000){let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);avatar='data:'+image.headers.get('content-type')+';base64,'+btoa(binary)}}}catch{}
   }
  }catch{}
 }
 // A queued push must not expose the previous account after logout/account switch.
 return {title:verified&&typeof data.title==='string'?data.title.slice(0,70):'You & Me',options:{body:verified&&typeof data.body==='string'?data.body.slice(0,240):'Você recebeu uma novidade. Abra o app para ver.',icon:avatar,badge:'/icon-192.png',tag:data.tag||'youme-message',data:{url:'/#chat'},renotify:true,...(data.kind==='call'?{requireInteraction:true}:{} )}};
}
self.addEventListener('push',event=>{
 let data={};try{data=event.data?.json()||{}}catch{}
 event.waitUntil((async()=>{const notification=await privatePushOptions(data);await self.registration.showNotification(notification.title,notification.options);if(data.kind!=='test')await self.navigator.setAppBadge?.(1)?.catch(()=>{})})());
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
