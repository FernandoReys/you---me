import webpush from 'web-push';
import {createHash} from 'node:crypto';
const hash=v=>createHash('sha256').update(v).digest('hex');
const config=()=>({publicKey:process.env.VAPID_PUBLIC_KEY,privateKey:process.env.VAPID_PRIVATE_KEY,subject:process.env.VAPID_SUBJECT});
export function pushConfigured(){const c=config();return !!(c.publicKey&&c.privateKey&&c.subject)}
export function validateSubscription(input){
 if(!input||typeof input.endpoint!=='string'||input.endpoint.length>2048)return null;
 let url;try{url=new URL(input.endpoint)}catch{return null}
 // Delivery must never turn a user-supplied URL into a general-purpose HTTP proxy.
 const host=url.hostname;
 const trusted=['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'].includes(host)||/^[a-z0-9-]+\.notify\.windows\.com$/.test(host);
 if(url.protocol!=='https:'||url.port||url.username||url.password||url.hash||!trusted)return null;
 const keys=input.keys;if(!keys||typeof keys.auth!=='string'||typeof keys.p256dh!=='string'||!(/^[\w-]{22}={0,2}$/.test(keys.auth))||!(/^[\w-]{87}={0,2}$/.test(keys.p256dh)))return null;
 const point=Buffer.from(keys.p256dh,'base64url');if(point.length!==65||point[0]!==4||Buffer.from(keys.auth,'base64url').length!==16)return null;
 return {endpoint:input.endpoint,expirationTime:null,keys:{p256dh:keys.p256dh,auth:keys.auth}};
}
export function createPush(db,{send=webpush.sendNotification}={}){
 async function deliver(userId,payload,{ttl=86400,endpointHash}={}){
  if(!pushConfigured())return {sent:0,failed:0};
  const rows=await db.all('SELECT p.endpoint_hash,p.subscription FROM push_subscriptions p JOIN sessions s ON s.token=p.session_hash WHERE p.user_id=? AND s.user_id=p.user_id AND s.expires>?'+(endpointHash?' AND p.endpoint_hash=?':''),userId,Date.now(),...(endpointHash?[endpointHash]:[]));
  const results=await Promise.all(rows.map(async row=>{
   try{await send(JSON.parse(row.subscription),JSON.stringify(payload),{TTL:ttl,urgency:'high',timeout:4000,vapidDetails:config()});return true}
   catch(error){if([404,410].includes(error.statusCode))await db.run('DELETE FROM push_subscriptions WHERE endpoint_hash=? AND user_id=?',row.endpoint_hash,userId);return false}
  }));return {sent:results.filter(Boolean).length,failed:results.filter(v=>!v).length};
 }
 async function notifyPartner(user,kind){
  if(!pushConfigured()||!user.pair)return;
  const partner=await db.one('SELECT id FROM users WHERE pair=? AND id<>?',user.pair,user.id);if(!partner)return;
  const call=kind==='call';
  try{await deliver(partner.id,{title:'You & Me',body:call?'Seu amor está ligando. Toque para abrir o app.':kind==='photo'?'Seu amor compartilhou uma foto. Abra o app para ver.':'Você recebeu uma nova mensagem. Abra o app para ler.',url:'/#chat',tag:call?'youme-call':'youme-message',kind:call?'call':'message'},{ttl:call?45:86400})}catch{console.warn('Push delivery temporarily unavailable')}
 }
 function install(app,auth){
  app.get('/api/push/config',auth,(req,res)=>res.json({configured:pushConfigured(),publicKey:pushConfigured()?config().publicKey:null}));
  app.get('/api/push/status',auth,async(req,res)=>{
   const endpoint=String(req.query.endpoint||'');if(endpoint.length>2048)return res.sendStatus(400);
   const row=endpoint?await db.one('SELECT endpoint_hash FROM push_subscriptions WHERE endpoint_hash=? AND user_id=? AND session_hash=?',hash(endpoint),req.user.id,req.sessionHash):null;res.json({enabled:!!row,configured:pushConfigured()});
  });
  app.post('/api/push/subscribe',auth,async(req,res)=>{
   if(!pushConfigured())return res.status(503).json({error:'As notificações ainda não estão configuradas no servidor.'});
   const sub=validateSubscription(req.body);if(!sub)return res.status(400).json({error:'Inscrição de notificações inválida.'});
   await db.run('DELETE FROM push_subscriptions WHERE user_id=? AND session_hash IN (SELECT token FROM sessions WHERE expires<=?)',req.user.id,Date.now());
   const count=await db.one('SELECT COUNT(*) AS n FROM push_subscriptions WHERE user_id=?',req.user.id),endpointHash=hash(sub.endpoint),existing=await db.one('SELECT endpoint_hash FROM push_subscriptions WHERE endpoint_hash=? AND user_id=?',endpointHash,req.user.id);
   if(Number(count.n)>=10&&!existing)return res.status(409).json({error:'Limite de 10 aparelhos. Desative os alertas em outro aparelho.'});
   await db.run('INSERT INTO push_subscriptions(endpoint_hash,user_id,session_hash,subscription,created,updated) VALUES(?,?,?,?,?,?) ON CONFLICT(endpoint_hash) DO UPDATE SET user_id=excluded.user_id,session_hash=excluded.session_hash,subscription=excluded.subscription,updated=excluded.updated',endpointHash,req.user.id,req.sessionHash,JSON.stringify(sub),Date.now(),Date.now());res.json({ok:true});
  });
  app.post('/api/push/unsubscribe',auth,async(req,res)=>{
   const endpoint=req.body?.endpoint;if(typeof endpoint!=='string'||endpoint.length>2048)return res.sendStatus(400);
   await db.run('DELETE FROM push_subscriptions WHERE endpoint_hash=? AND user_id=?',hash(endpoint),req.user.id);res.json({ok:true});
  });
  app.post('/api/push/test',auth,async(req,res)=>{
   const endpoint=req.body?.endpoint;if(typeof endpoint!=='string'||endpoint.length>2048)return res.sendStatus(400);
   const row=await db.one('SELECT tested_at FROM push_limits WHERE user_id=?',req.user.id);if(row&&Number(row.tested_at)>Date.now()-30000)return res.status(429).json({error:'Aguarde 30 segundos antes de testar novamente.'});
   await db.run('INSERT INTO push_limits(user_id,tested_at) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET tested_at=excluded.tested_at',req.user.id,Date.now());
   const result=await deliver(req.user.id,{title:'You & Me · Tudo pronto',body:'Os alertas deste aparelho estão ativados. Agora bloqueie a tela e peça ao seu amor para enviar uma mensagem.',url:'/#chat',tag:'youme-test',kind:'test'},{ttl:300,endpointHash:hash(endpoint)});
   if(!result.sent)return res.status(502).json({error:'O serviço de notificações não confirmou o envio. Reative os alertas e tente novamente.'});res.json({ok:true,sent:result.sent});
  });
 }
 return {install,notifyPartner,deliver};
}
