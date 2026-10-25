import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { io as client } from 'socket.io-client';
import { createApp } from '../server.js';

test('fluxo do casal: autenticação, isolamento, chat, fotos, listas, sinalização e persistência',async()=>{
 const dataDir=mkdtempSync(path.join(tmpdir(),'entre-nos-'));
 let instance=createApp({dataDir});let sockets=[];
 async function start(){instance.server.listen(0,'127.0.0.1');await once(instance.server,'listening');return 'http://127.0.0.1:'+instance.server.address().port;}
 let base=await start();
 const request=async(url,{cookie,body,method='GET'}={})=>{const r=await fetch(base+'/api'+url,{method,headers:{...(cookie?{cookie}:{}),...(body instanceof FormData?{}:{'Content-Type':'application/json'})},body:body instanceof FormData?body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json().catch(()=>null),cookie:r.headers.get('set-cookie')?.split(';')[0]};};
 const register=async(name)=>{const r=await request('/auth/register',{method:'POST',body:{name,email:name+'@example.com',password:'UmaSenha123!'}});assert.equal(r.status,200);return r;};
 async function connect(cookie){const s=client(base,{extraHeaders:{cookie},reconnection:false});sockets.push(s);await once(s,'connect');return s;}
 const event=(s,name)=>Promise.race([once(s,name),new Promise((_,reject)=>{const t=setTimeout(()=>reject(new Error('Evento não recebido: '+name)),3000);t.unref();})]);
 try{
  assert.equal((await request('/me')).status,401);
  const a=await register('Fernando'),b=await register('Amor'),other=await register('Outra');
  assert.equal((await request('/auth/login',{method:'POST',body:{email:'Fernando@example.com',password:'errada'}})).status,401);
  assert.equal((await request('/auth/login',{method:'POST',body:{email:'Fernando@example.com',password:'UmaSenha123!'}})).status,200);
  assert.equal((await request('/items',{cookie:a.cookie,method:'POST',body:{kind:'message',body:{text:'Oi'}}})).status,400);
  assert.equal((await request('/connect',{cookie:a.cookie,method:'POST',body:{code:a.data.invite}})).status,400);
  assert.equal((await request('/connect',{cookie:b.cookie,method:'POST',body:{code:a.data.invite}})).status,200);
  assert.equal((await request('/me',{cookie:a.cookie})).data.partner.name,'Amor');
  assert.equal((await request('/connect',{cookie:other.cookie,method:'POST',body:{code:a.data.invite}})).status,400);
  const sa=await connect(a.cookie),sb=await connect(b.cookie);
  const refresh=event(sb,'refresh');
  const msg=await request('/items',{cookie:a.cookie,method:'POST',body:{kind:'message',body:{text:'Oi, meu amor!'}}});assert.equal(msg.status,200);await refresh;
  const list=(await request('/items',{cookie:b.cookie})).data;assert.equal(list[0].body.text,'Oi, meu amor!');
  assert.equal((await request('/items',{cookie:other.cookie})).data.length,0);
  assert.equal((await request('/items/'+msg.data.id,{cookie:b.cookie,method:'DELETE'})).status,403);
  const movie=await request('/items',{cookie:b.cookie,method:'POST',body:{kind:'movie',body:{text:'Nosso filme',type:'Série'}}});
  assert.equal((await request('/items/'+movie.data.id,{cookie:a.cookie,method:'PATCH',body:{done:true}})).status,200);
  const goal=await request('/items',{cookie:a.cookie,method:'POST',body:{kind:'goal',body:{text:'Viajar juntos'}}});assert.equal(goal.status,200);
  const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
  const form=new FormData();form.set('photo',new Blob([image],{type:'image/png'}),'foto.png');form.set('text','Nossa memória');
  const photo=await request('/photos',{cookie:a.cookie,method:'POST',body:form});assert.equal(photo.status,200);
  const imageResponse=await fetch(base+'/api/photos/'+photo.data.body.file,{headers:{cookie:b.cookie}});assert.equal(imageResponse.status,200);assert.deepEqual(Buffer.from(await imageResponse.arrayBuffer()),image);
  assert.equal((await fetch(base+'/api/photos/'+photo.data.body.file,{headers:{cookie:other.cookie}})).status,400);
  const bad=new FormData();bad.set('photo',new Blob(['<script>bad</script>'],{type:'image/png'}),'bad.png');assert.equal((await request('/photos',{cookie:a.cookie,method:'POST',body:bad})).status,400);
  const signal=event(sb,'signal');sa.emit('signal',{type:'offer',sdp:{type:'offer',sdp:'test'}});assert.equal((await signal)[0].data.type,'offer');
  assert.equal((await request('/rtc',{cookie:a.cookie})).data.iceServers.length,1);
  assert.equal((await fetch(base)).status,200);
  for(const s of sockets)s.disconnect();sockets=[];
  await new Promise(resolve=>instance.io.close(resolve));instance.db.close();
  instance=createApp({dataDir});base=await start();
  assert.equal((await request('/items',{cookie:b.cookie})).data.length,4);
  assert.equal((await request('/items',{cookie:b.cookie})).data.find(i=>i.id===movie.data.id).body.done,true);
  assert.equal((await request('/logout',{cookie:a.cookie,method:'POST'})).status,200);
  assert.equal((await request('/me',{cookie:a.cookie})).status,401);
 }finally{for(const s of sockets)s.disconnect();await new Promise(resolve=>instance.io.close(resolve));instance.db.close();rmSync(dataDir,{recursive:true,force:true});}
});
