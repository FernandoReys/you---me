import {createHash} from 'node:crypto';
import {nativeCapabilities,sendNativeCall} from './providers.mjs';
const digest=value=>createHash('sha256').update(value).digest('hex');
export function nativeCalls(db,{send=sendNativeCall}={}){
 function install(app,auth){
  app.get('/api/native/config',auth,(req,res)=>res.json(nativeCapabilities()));
  app.post('/api/native/devices',auth,async(req,res)=>{
   const {platform,token}=req.body||{};
   if(!['ios','android'].includes(platform)||typeof token!=='string'||token.length<20||token.length>4096||!(/^[a-zA-Z0-9_:\-]+$/.test(token))||(platform==='ios'&&!/^[a-f0-9]{64,200}$/i.test(token)))return res.status(400).json({error:'Registro de aparelho inválido.'});
   if(!nativeCapabilities()[platform])return res.status(503).json({error:'Configure o push nativo do servidor antes de ativar as chamadas.'});
   await db.run('INSERT INTO native_devices(token_hash,user_id,session_hash,platform,token,updated) VALUES(?,?,?,?,?,?) ON CONFLICT(token_hash) DO UPDATE SET user_id=excluded.user_id,session_hash=excluded.session_hash,platform=excluded.platform,token=excluded.token,updated=excluded.updated',digest(token),req.user.id,req.sessionHash,platform,token,Date.now());res.json({ok:true});
  });
  app.get('/api/native/calls/:uuid',auth,async(req,res)=>{
   if(!/^[a-f0-9-]{36}$/i.test(req.params.uuid)||!req.user.pair)return res.sendStatus(404);
   const rows=await db.all('SELECT body FROM signals WHERE recipient=? AND pair=? AND created>? ORDER BY seq DESC LIMIT 100',req.user.id,req.user.pair,Date.now()-60000);
   let offer;for(const row of rows){const item=JSON.parse(row.body);if(item.data.callId===req.params.uuid){if(['end','busy'].includes(item.data.type))return res.sendStatus(410);if(item.data.type==='offer'){offer=item;break}}}
   if(!offer)return res.sendStatus(404);res.json({offer});
  });
 }
 async function notify(user,data){
  if(data.type!=='offer'||!user.pair)return;const partner=await db.one('SELECT id FROM users WHERE pair=? AND id<>?',user.pair,user.id);if(!partner)return;
  const devices=await db.all('SELECT d.token_hash,d.platform,d.token FROM native_devices d JOIN sessions s ON s.token=d.session_hash WHERE d.user_id=? AND s.user_id=d.user_id AND s.expires>?',partner.id,Date.now());
  const payload={type:'incoming-call',uuid:data.callId,callerName:user.name,video:!!data.video,expiresAt:Date.now()+45000};
  await Promise.allSettled(devices.filter(d=>nativeCapabilities()[d.platform]).map(async device=>{try{await send(device,payload)}catch(error){if([404,410].includes(error.statusCode))await db.run('DELETE FROM native_devices WHERE token_hash=?',device.token_hash);throw error}}));
 }
 return {install,notify};
}
