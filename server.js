import express from 'express';
import {createServer} from 'node:http';
import {randomBytes,createHash,scrypt,timingSafeEqual,createHmac} from 'node:crypto';
import {promisify} from 'node:util';
import path from 'node:path';
import multer from 'multer';
import {fileURLToPath} from 'node:url';
import {openStore} from './lib/store.js';
const derive=promisify(scrypt),id=()=>randomBytes(18).toString('hex'),hash=v=>createHash('sha256').update(v).digest('hex');
const parseItem=i=>({...i,created:Number(i.created),body:JSON.parse(i.body)});
export function createApp(options={}){
 const db=options.store||openStore(options),app=express(),server=createServer(app);
 app.disable('x-powered-by');app.use(express.json({limit:'100kb'}));
 app.use((req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('Permissions-Policy','camera=(self), microphone=(self), geolocation=()');if(req.path.startsWith('/api'))res.setHeader('Cache-Control','private, no-store');
 if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.get('origin')){let origin;try{origin=new URL(req.get('origin')).host}catch{return res.status(403).json({error:'Origem inválida.'})}if(origin!==req.get('host'))return res.status(403).json({error:'Origem inválida.'})}next();});
 async function userFor(cookie=''){const token=/(?:^|;\s*)session=([a-f0-9]{36})/.exec(cookie)?.[1];return token?db.one('SELECT users.* FROM users JOIN sessions ON sessions.user_id=users.id WHERE sessions.token=? AND sessions.expires>?',hash(token),Date.now()):null}
 async function safe(u){const now=Date.now();const partner=u.pair?await db.one('SELECT id,name,seen AS last_seen,COALESCE((SELECT MAX(seen) FROM sessions WHERE user_id=users.id AND expires>?),0) AS active_seen FROM users WHERE pair=? AND id<>?',now,u.pair,u.id):null;const mine=await db.one('SELECT MAX(seen) AS active_seen FROM sessions WHERE user_id=? AND expires>?',u.id,now);return{id:u.id,name:u.name,email:u.email,invite:u.invite,pair:u.pair,online:Number(mine?.active_seen)>now-20000,partner:partner?{id:partner.id,name:partner.name,online:Number(partner.active_seen)>now-20000,lastSeen:Number(partner.last_seen)}:null}}
 app.use('/api',async(req,res,next)=>{try{req.user=await userFor(req.headers.cookie);const token=/(?:^|;\s*)session=([a-f0-9]{36})/.exec(req.headers.cookie||'')?.[1];req.sessionHash=token?hash(token):null;next()}catch(e){next(e)}});
 const auth=(req,res,next)=>req.user?next():res.status(401).json({error:'Entre na sua conta para continuar.'});
 const paired=(req,res,next)=>req.user.pair?next():res.status(400).json({error:'Conecte seu amor pelo código de convite primeiro.'});
 app.get('/api/health',async(req,res)=>{await db.one('SELECT id FROM users LIMIT 1');res.json({ok:true,storage:db.postgres?'postgres':'sqlite-local'})});
 app.post('/api/auth/:action',async(req,res)=>{
  const {name,email,password}=req.body||{};if(typeof email!=='string'||typeof password!=='string'||email.length>254||password.length>256)return res.status(400).json({error:'Informe e-mail e senha válidos.'});
  const now=Date.now(),ip=String(req.headers['x-vercel-forwarded-for']||req.ip),key=hash(ip+':'+email.trim().toLowerCase());
  await db.run('INSERT INTO auth_attempts(key,n,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET n=CASE WHEN auth_attempts.expires<? THEN 1 ELSE auth_attempts.n+1 END,expires=CASE WHEN auth_attempts.expires<? THEN ? ELSE auth_attempts.expires END',key,now+600000,now,now,now+600000);
  const attempts=await db.one('SELECT n FROM auth_attempts WHERE key=?',key);if(attempts.n>20)return res.status(429).json({error:'Muitas tentativas. Aguarde 10 minutos.'});
  let user;
  if(req.params.action==='register'){
   if(typeof name!=='string'||!name.trim()||name.length>60||!/^\S+@\S+\.\S+$/.test(email)||password.length<10)return res.status(400).json({error:'Informe nome, e-mail válido e senha com pelo menos 10 caracteres.'});
   const salt=id(),hashed=(await derive(password,salt,64)).toString('hex'),uid=id();
   try{await db.run('INSERT INTO users(id,name,email,password,invite,pair,seen) VALUES(?,?,?,?,?,NULL,?)',uid,name.trim(),email.trim().toLowerCase(),salt+':'+hashed,randomBytes(5).toString('hex').toUpperCase(),now)}catch(e){if(e.code==='23505'||e.code?.startsWith('SQLITE_CONSTRAINT'))return res.status(409).json({error:'Não foi possível criar a conta com este e-mail.'});throw e}user=await db.one('SELECT * FROM users WHERE id=?',uid);
  }else if(req.params.action==='login'){
   user=await db.one('SELECT * FROM users WHERE email=?',email.trim().toLowerCase());const [salt,passwordHash]=(user?.password||'dummy:'+'00'.repeat(64)).split(':');
   const valid=timingSafeEqual(await derive(password,salt,64),Buffer.from(passwordHash,'hex'));if(!valid||!user)return res.status(401).json({error:'E-mail ou senha incorretos.'});
  }else return res.sendStatus(404);
  const token=id();await db.run('INSERT INTO sessions(token,user_id,expires,seen) VALUES(?,?,?,?)',hash(token),user.id,now+30*86400000,now);await db.run('UPDATE users SET seen=? WHERE id=?',now,user.id);
  res.setHeader('Set-Cookie',`session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000${process.env.NODE_ENV==='production'?'; Secure':''}`);res.json(await safe({...user,seen:now}));
 });
 app.get('/api/me',auth,async(req,res)=>res.json(await safe(req.user)));
 app.post('/api/presence',auth,async(req,res)=>{const seen=req.body.visible===false?0:Date.now();await db.run('UPDATE sessions SET seen=? WHERE token=?',seen,req.sessionHash);if(seen)await db.run('UPDATE users SET seen=? WHERE id=?',seen,req.user.id);res.json({ok:true})});
 app.post('/api/logout',auth,async(req,res)=>{const token=/(?:^|;\s*)session=([a-f0-9]+)/.exec(req.headers.cookie)?.[1];await db.run('DELETE FROM sessions WHERE token=?',hash(token));res.setHeader('Set-Cookie','session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'+(process.env.NODE_ENV==='production'?'; Secure':''));res.json({ok:true})});
 app.post('/api/connect',auth,async(req,res)=>{
  const partner=await db.one('SELECT id FROM users WHERE invite=?',String(req.body.code||'').trim().toUpperCase());if(!partner||partner.id===req.user.id)return res.status(400).json({error:'Código inválido ou conta já conectada.'});
  const connected=await db.transaction(async tx=>{const rows=await tx.all('SELECT id,pair FROM users WHERE id IN (?,?) ORDER BY id'+(db.postgres?' FOR UPDATE':''),req.user.id,partner.id);if(rows.length!==2||rows.some(u=>u.pair))return false;await tx.run('UPDATE users SET pair=? WHERE id IN (?,?)',id(),req.user.id,partner.id);return true});
  if(!connected)return res.status(409).json({error:'Uma das contas já está conectada.'});res.json(await safe(await db.one('SELECT * FROM users WHERE id=?',req.user.id)));
 });
 const getItems=async user=>user.pair?(await db.all('SELECT * FROM items WHERE pair=? ORDER BY created ASC,id ASC',user.pair)).map(parseItem):[];
 app.get('/api/items',auth,async(req,res)=>res.json(await getItems(req.user)));
 app.get('/api/sync',auth,async(req,res)=>{
  const after=Math.max(0,Number(req.query.after)||0);let user=req.user;if(req.query.visible==='1'){await db.run('UPDATE sessions SET seen=? WHERE token=?',Date.now(),req.sessionHash);await db.run('UPDATE users SET seen=? WHERE id=?',Date.now(),user.id);user={...user,seen:Date.now()}}
  const [me,items,signals]=await Promise.all([safe(user),getItems(user),user.pair?db.all('SELECT seq,body FROM signals WHERE recipient=? AND pair=? AND seq>? AND created>? ORDER BY seq ASC LIMIT 100',user.id,user.pair,after,Date.now()-90000):[]]);
  res.json({me,items,signals:signals.map(s=>({seq:Number(s.seq),...JSON.parse(s.body)})),cursor:signals.length?Number(signals.at(-1).seq):after});
 });
 async function add(req,kind,body){const item={id:id(),pair:req.user.pair,kind,author:req.user.id,body,created:Date.now()};await db.run('INSERT INTO items(id,pair,kind,author,body,created) VALUES(?,?,?,?,?,?)',item.id,item.pair,kind,item.author,JSON.stringify(body),item.created);return item}
 app.post('/api/items',auth,paired,async(req,res)=>{const {kind,body}=req.body;if(!['message','movie','goal'].includes(kind)||!body||typeof body.text!=='string'||!body.text.trim()||body.text.length>4000)return res.status(400).json({error:'Preencha o texto (até 4.000 caracteres).'});res.json(await add(req,kind,{text:body.text.trim(),done:false,type:body.type==='Série'?'Série':'Filme'}))});
 app.patch('/api/items/:id',auth,paired,async(req,res)=>{const item=await db.one('SELECT * FROM items WHERE id=? AND pair=?',req.params.id,req.user.pair);if(!item||!['movie','goal'].includes(item.kind))return res.sendStatus(404);await db.run('UPDATE items SET body=? WHERE id=?',JSON.stringify({...JSON.parse(item.body),done:!!req.body.done}),item.id);res.json({ok:true})});
 app.delete('/api/items/:id',auth,paired,async(req,res)=>{const item=await db.one('SELECT * FROM items WHERE id=? AND pair=?',req.params.id,req.user.pair);if(!item)return res.sendStatus(404);if(item.author!==req.user.id)return res.status(403).json({error:'Somente quem adicionou pode excluir.'});await db.transaction(async tx=>{if(item.kind==='photo')await tx.run('DELETE FROM photos WHERE id=? AND pair=?',JSON.parse(item.body).file,req.user.pair);await tx.run('DELETE FROM items WHERE id=?',item.id)});res.json({ok:true})});
 const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:3*1024*1024,files:1,fields:2}});
 app.post('/api/photos',auth,paired,upload.single('photo'),async(req,res)=>{
  if(!req.file)return res.status(400).json({error:'Escolha uma foto.'});const b=req.file.buffer;
  const mime=b.subarray(0,3).equals(Buffer.from([255,216,255]))?'image/jpeg':b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP'?'image/webp':null;
  if(!mime)return res.status(400).json({error:'Use JPEG, PNG ou WebP.'});const file=id();const item={id:id(),pair:req.user.pair,kind:'photo',author:req.user.id,body:{file,mime,text:String(req.body.text||'Nosso momento').slice(0,120)},created:Date.now()};
  await db.transaction(async tx=>{await tx.run('INSERT INTO photos(id,pair,mime,bytes) VALUES(?,?,?,?)',file,item.pair,mime,b);await tx.run('INSERT INTO items(id,pair,kind,author,body,created) VALUES(?,?,?,?,?,?)',item.id,item.pair,item.kind,item.author,JSON.stringify(item.body),item.created)});res.json(item);
 });
 app.get('/api/photos/:file',auth,paired,async(req,res)=>{const photo=await db.one('SELECT mime,bytes FROM photos WHERE id=? AND pair=?',req.params.file,req.user.pair);if(!photo)return res.sendStatus(404);res.type(photo.mime).send(Buffer.from(photo.bytes))});
 app.get('/api/rtc',auth,(req,res)=>{
  let relay=null;
  if(process.env.TURN_URL&&process.env.TURN_SHARED_SECRET){const username=Math.floor(Date.now()/1000+3600)+':'+req.user.id;relay={urls:process.env.TURN_URL.split(',').map(s=>s.trim()),username,credential:createHmac('sha1',process.env.TURN_SHARED_SECRET).update(username).digest('base64')}}
  else if(process.env.TURN_URL&&process.env.TURN_USERNAME&&process.env.TURN_PASSWORD)relay={urls:process.env.TURN_URL.split(',').map(s=>s.trim()),username:process.env.TURN_USERNAME,credential:process.env.TURN_PASSWORD};
  res.json({iceServers:[{urls:'stun:stun.cloudflare.com:3478'},...(relay?[relay]:[])],relayConfigured:!!relay});
 });
 app.post('/api/signals',auth,paired,async(req,res)=>{
  const data=req.body;if(!['offer','answer','candidate','end','busy'].includes(data?.type)||typeof data.callId!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(data.callId)||JSON.stringify(data).length>65000)return res.status(400).json({error:'Sinal de chamada inválido.'});
  const partner=await db.one('SELECT id FROM users WHERE pair=? AND id<>?',req.user.pair,req.user.id);if(!partner)return res.status(409).json({error:'Conecte seu par.'});
  if(['offer','answer'].includes(data.type)&&(!data.sdp||typeof data.sdp.sdp!=='string'||data.sdp.type!==data.type))return res.status(400).json({error:'Descrição de chamada inválida.'});
  await db.run('DELETE FROM signals WHERE created<?',Date.now()-180000);await db.run('INSERT INTO signals(pair,sender,recipient,body,created) VALUES(?,?,?,?,?)',req.user.pair,req.user.id,partner.id,JSON.stringify({from:req.user.name,data,at:Date.now()}),Date.now());res.json({ok:true});
 });
 app.use(express.static(path.join(path.dirname(fileURLToPath(import.meta.url)),'public')));
 app.use((err,req,res,next)=>{console.error('Request failed:',err.code||err.name);res.status(err instanceof multer.MulterError?400:500).json({error:err instanceof multer.MulterError?'A foto deve ter até 3 MB.':'Não foi possível concluir. Tente novamente.'})});
 return{app,server,db};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const {server}=createApp();const portFlag=process.argv.indexOf('--port');const port=portFlag>=0?Number(process.argv[portFlag+1]):Number(process.env.PORT||3000);if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Porta inválida.');server.listen(port,'0.0.0.0',()=>console.log('You & Me iniciado.'))}
