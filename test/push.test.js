import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
import {createECDH,randomBytes} from 'node:crypto';
import vm from 'node:vm';
import webpush from 'web-push';
import {createApp} from '../server.js';
import {validateSubscription} from '../lib/push.js';
function subscription(token='test'){const key=createECDH('prime256v1');key.generateKeys();return {endpoint:'https://fcm.googleapis.com/fcm/send/'+token,keys:{p256dh:key.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')}}}
test('push targets only the partner, encrypts messages, removes expired endpoints, and revokes on logout',async()=>{
 const dataDir=mkdtempSync(path.join(tmpdir(),'youme-push-')),sent=[];
 const keys=webpush.generateVAPIDKeys();Object.assign(process.env,{VAPID_PUBLIC_KEY:keys.publicKey,VAPID_PRIVATE_KEY:keys.privateKey,VAPID_SUBJECT:'https://example.com'});
 const instance=createApp({dataDir,databaseUrl:null,pushSend:async(sub,payload,options)=>{if(sub.endpoint.endsWith('expired'))throw {statusCode:410};const request=webpush.generateRequestDetails(sub,payload,options);assert.equal(request.headers['Content-Encoding'],'aes128gcm');assert.ok(Buffer.isBuffer(request.body));assert.ok(request.headers.Authorization.startsWith('vapid '));sent.push({sub,payload:JSON.parse(payload),options});return {statusCode:201}}});
 instance.server.listen(0,'127.0.0.1');await once(instance.server,'listening');const base='http://127.0.0.1:'+instance.server.address().port;
 const request=async(url,{cookie,body,method='GET'}={})=>{const r=await fetch(base+'/api'+url,{method,headers:{'Content-Type':'application/json',...(cookie?{cookie}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json().catch(()=>null),cookie:r.headers.get('set-cookie')?.split(';')[0]}};
 const register=async name=>request('/auth/register',{method:'POST',body:{name,email:name+'@example.test',password:'TestPassword123!'}});
 try{
  assert.equal((await request('/push/config')).status,401);
  const a=await register('Fernando'),b=await register('Ster'),other=await register('Other');
  await request('/connect',{cookie:a.cookie,method:'POST',body:{code:b.data.invite}});
  const config=await request('/push/config',{cookie:b.cookie});assert.equal(config.data.configured,true);assert.equal(config.data.publicKey,keys.publicKey);assert.equal(config.data.privateKey,undefined);
  for(const endpoint of ['http://127.0.0.1/a','https://169.254.169.254/','https://fcm.googleapis.com.evil.test/x','https://user@fcm.googleapis.com/x','https://fcm.googleapis.com:444/x'])assert.equal((await request('/push/subscribe',{cookie:b.cookie,method:'POST',body:{...subscription(),endpoint}})).status,400);
  const sub=subscription('ster'),aSub=subscription('fernando'),otherSub=subscription('other');
  for(const [u,s] of [[a,aSub],[b,sub],[other,otherSub]])assert.equal((await request('/push/subscribe',{cookie:u.cookie,method:'POST',body:s})).status,200);
  assert.equal((await request('/push/status?endpoint='+encodeURIComponent(sub.endpoint),{cookie:b.cookie})).data.enabled,true);
  assert.equal((await request('/push/status?endpoint='+encodeURIComponent(sub.endpoint),{cookie:other.cookie})).data.enabled,false);
  const photoForm=new FormData();photoForm.set('photo',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')],{type:'image/png'}),'avatar.png');assert.equal((await fetch(base+'/api/profile-media/avatar',{method:'POST',headers:{cookie:a.cookie},body:photoForm})).status,200);
  await request('/items',{cookie:a.cookie,method:'POST',body:{kind:'message',body:{text:'This is a secret message'}}});
  assert.equal(sent.length,1);assert.equal(sent[0].sub.endpoint,sub.endpoint);assert.equal(sent[0].payload.url,'/#chat');assert.equal(sent[0].payload.title,'Fernando');assert.equal(sent[0].payload.body,'This is a secret message');assert.equal(sent[0].payload.recipient,b.data.id);assert.match(sent[0].payload.avatar,new RegExp('/api/profile-media/'+a.data.id+'/avatar'));assert.equal(sent[0].options.TTL,86400);
  await request('/signals',{cookie:a.cookie,method:'POST',body:{type:'offer',callId:'test-background-call-12345',video:true,sdp:{type:'offer',sdp:'test'}}});assert.equal(sent.at(-1).payload.kind,'call');assert.match(sent.at(-1).payload.body,/Chamada de vídeo/);assert.equal(sent.at(-1).options.TTL,45);
  const beforeTest=sent.length;assert.equal((await request('/push/test',{cookie:b.cookie,method:'POST',body:{endpoint:otherSub.endpoint}})).status,502);assert.equal(sent.length,beforeTest);
  assert.equal((await request('/push/test',{cookie:a.cookie,method:'POST',body:{endpoint:aSub.endpoint}})).status,200);
  assert.equal((await request('/push/test',{cookie:a.cookie,method:'POST',body:{endpoint:aSub.endpoint}})).status,429);
  await request('/push/subscribe',{cookie:b.cookie,method:'POST',body:subscription('expired')});await request('/items',{cookie:a.cookie,method:'POST',body:{kind:'message',body:{text:'Another secret'}}});
  assert.equal((await instance.db.one('SELECT COUNT(*) AS n FROM push_subscriptions WHERE user_id=?',b.data.id)).n,1);
  const aPrefs={theme:'crimson',bubble:'cat',wallpaperOpacity:25},bPrefs={theme:'petrol',bubble:'soft',wallpaperOpacity:60};
  await request('/preferences',{cookie:a.cookie,method:'PUT',body:aPrefs});await request('/preferences',{cookie:b.cookie,method:'PUT',body:bPrefs});assert.deepEqual((await request('/me',{cookie:a.cookie})).data.preferences,aPrefs);assert.deepEqual((await request('/me',{cookie:b.cookie})).data.preferences,bPrefs);
  const relogin=await request('/auth/login',{method:'POST',body:{email:'Fernando@example.test',password:'TestPassword123!'}});assert.deepEqual(relogin.data.preferences,aPrefs);
  await request('/logout',{cookie:b.cookie,method:'POST'});const beforeLogout=sent.length;await request('/items',{cookie:a.cookie,method:'POST',body:{kind:'message',body:{text:'After logout'}}});assert.equal(sent.length,beforeLogout);
  assert.equal((await instance.db.one('SELECT COUNT(*) AS n FROM push_subscriptions WHERE user_id=?',b.data.id)).n,0);
 }finally{await new Promise(r=>instance.server.close(r));await instance.db.close();rmSync(dataDir,{recursive:true,force:true});for(const key of ['VAPID_PUBLIC_KEY','VAPID_PRIVATE_KEY','VAPID_SUBJECT'])delete process.env[key]}
});
test('the service worker displays push and opens the app from a locked-screen notification',async()=>{
 const listeners={},notifications=[],opened=[];
 let signedIn='recipient';const context={URL,console,AbortController,setTimeout,clearTimeout,caches:{},btoa,fetch:async url=>url==='/api/me'?({ok:true,json:async()=>({id:signedIn})}):({ok:true,headers:{get:()=> 'image/png'},arrayBuffer:async()=>new Uint8Array([137,80,78,71]).buffer}),self:{location:{origin:'https://example.test'},navigator:{setAppBadge:async()=>{},clearAppBadge:async()=>{}},addEventListener:(type,fn)=>listeners[type]=fn,registration:{showNotification:async(...args)=>notifications.push(args)},clients:{matchAll:async()=>[],openWindow:async url=>opened.push(url)}}};
 vm.runInNewContext(readFileSync('public/sw.js','utf8'),context);
 let pending;listeners.push({data:{json:()=>({title:'You & Me',body:'Nova mensagem',recipient:'recipient',sender:'sender',avatar:'/api/profile-media/sender/avatar?v=123',kind:'message',url:'https://evil.test'})},waitUntil:p=>pending=p});await pending;assert.equal(notifications.length,1);assert.equal(notifications[0][1].data.url,'/#chat');assert.equal(notifications[0][1].body,'Nova mensagem');assert.match(notifications[0][1].icon,/^data:image\/png;base64,/);signedIn='another-user';listeners.push({data:{json:()=>({title:'Private sender',body:'Private message',recipient:'recipient',kind:'message'})},waitUntil:p=>pending=p});await pending;assert.equal(notifications[1][0],'You & Me');assert.ok(!notifications[1][1].body.includes('Private'));
 listeners.notificationclick({notification:{close(){}},waitUntil:p=>pending=p});await pending;assert.equal(opened[0],'/#chat');
});
test('subscription validation rejects invalid key material',()=>{const sub=subscription();assert.ok(validateSubscription(sub));assert.equal(validateSubscription({...sub,keys:{...sub.keys,p256dh:'bad'}}),null)});
