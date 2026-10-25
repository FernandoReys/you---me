import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
import {createApp} from '../../server.js';
import {nativeCalls} from '../server/nativeRoutes.mjs';
test('native registration, fresh offers, expiration and recipient isolation',async()=>{
 const dataDir=mkdtempSync(path.join(tmpdir(),'youme-native-'));const instance=createApp({dataDir,databaseUrl:null}),sent=[];
 await instance.db.run("CREATE TABLE IF NOT EXISTS native_devices(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,session_hash TEXT NOT NULL,platform TEXT NOT NULL,token TEXT NOT NULL,updated INTEGER NOT NULL)");
 const calls=nativeCalls(instance.db,{send:async(device,payload)=>sent.push({device,payload})});calls.install(instance.app,(req,res,next)=>req.user?next():res.sendStatus(401));
 instance.server.listen(0,'127.0.0.1');await once(instance.server,'listening');const base='http://127.0.0.1:'+instance.server.address().port;
 const req=async(route,body,cookie)=>{const r=await fetch(base+'/api'+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(cookie?{cookie}:{})},body:body?JSON.stringify(body):undefined});return{status:r.status,body:await r.json().catch(()=>null),cookie:r.headers.get('set-cookie')?.split(';')[0]}};
 try{
  assert.equal((await req('/native/config')).status,401);
  const a=await req('/auth/register',{name:'Fernando',email:'native-a@example.test',password:'NativeTest123!'}),b=await req('/auth/register',{name:'Ster',email:'native-b@example.test',password:'NativeTest123!'}),other=await req('/auth/register',{name:'Other',email:'native-c@example.test',password:'NativeTest123!'});
  await req('/connect',{code:b.body.invite},a.cookie);
  assert.equal((await req('/native/devices',{platform:'android',token:'test-token-123456789012345'},b.cookie)).status,503);
  process.env.FCM_SERVICE_ACCOUNT_JSON='{}';assert.equal((await req('/native/devices',{platform:'android',token:'test-token-123456789012345'},b.cookie)).status,200);
  const callId='f925e5bc-04fd-4a58-976a-d94de3198a4d',offer={type:'offer',callId,video:true,sdp:{type:'offer',sdp:'test'}};await req('/signals',offer,a.cookie);
  assert.equal((await req('/native/calls/'+callId,null,b.cookie)).status,200);assert.equal((await req('/native/calls/'+callId,null,other.cookie)).status,404);
  const user=await instance.db.one('SELECT * FROM users WHERE id=?',a.body.id);await calls.notify(user,offer);assert.equal(sent.length,1);assert.equal(sent[0].payload.uuid,callId);assert.equal(sent[0].payload.video,true);assert.equal(sent[0].payload.sdp,undefined);
  await req('/signals',{type:'end',callId},a.cookie);assert.equal((await req('/native/calls/'+callId,null,b.cookie)).status,410);
 }finally{delete process.env.FCM_SERVICE_ACCOUNT_JSON;await new Promise(r=>instance.server.close(r));await instance.db.close();rmSync(dataDir,{recursive:true,force:true})}
});
