import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { fileURLToPath } from 'node:url';

export function createApp({ dataDir = process.env.DATA_DIR || './data' } = {}) {
 mkdirSync(dataDir, { recursive: true }); mkdirSync(path.join(dataDir,'uploads'), {recursive:true});
 const db = new DatabaseSync(path.join(dataDir,'app.sqlite'));
 db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,invite TEXT UNIQUE NOT NULL,pair TEXT);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user TEXT NOT NULL,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS items(id TEXT PRIMARY KEY,pair TEXT NOT NULL,kind TEXT NOT NULL,author TEXT NOT NULL,body TEXT NOT NULL,created INTEGER NOT NULL);`);
 const app=express(), server=createServer(app), io=new Server(server,{maxHttpBufferSize:100000});
 app.disable('x-powered-by'); app.use(express.json({limit:'32kb'}));
 app.use((req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');next();});
 const id=()=>randomBytes(18).toString('hex');
 function userFor(cookie='') {const token=/(?:^|;\s*)session=([a-f0-9]+)/.exec(cookie)?.[1];return token ? db.prepare('SELECT users.* FROM users JOIN sessions ON sessions.user=users.id WHERE sessions.token=? AND sessions.expires>?').get(token,Date.now()):null;}
 const safe=u=>({id:u.id,name:u.name,email:u.email,invite:u.invite,pair:u.pair,partner:u.pair?db.prepare('SELECT id,name FROM users WHERE pair=? AND id<>?').get(u.pair,u.id)||null:null});
 app.use('/api',(req,res,next)=>{req.user=userFor(req.headers.cookie);next();});
 const auth=(req,res,next)=>req.user?next():res.status(401).json({error:'Entre na sua conta para continuar.'});
 const paired=(req,res,next)=>req.user.pair?next():res.status(400).json({error:'Conecte seu amor pelo código de convite primeiro.'});
 const attempts=new Map();
 app.post('/api/auth/:action',(req,res)=>{
  const key=req.ip, now=Date.now(), record=attempts.get(key); const count=record&&record.until>now?record:{n:0,until:now+600000}; attempts.set(key,count);
  if(++count.n>30)return res.status(429).json({error:'Muitas tentativas. Aguarde alguns minutos.'});
  const {name,email,password}=req.body; if(typeof email!=='string'||typeof password!=='string'||email.length>254||password.length>256)return res.status(400).json({error:'Informe e-mail e senha válidos.'});
  let user;
  if(req.params.action==='register'){
   if(typeof name!=='string'||!name.trim()||name.length>60||!/^\S+@\S+\.\S+$/.test(email)||password.length<8)return res.status(400).json({error:'Informe nome, e-mail válido e senha com pelo menos 8 caracteres.'});
   const salt=id(), hashed=scryptSync(password,salt,64).toString('hex');
   try {const uid=id();db.prepare('INSERT INTO users VALUES(?,?,?,?,?,NULL)').run(uid,name.trim(),email.trim().toLowerCase(),salt+':'+hashed,randomBytes(5).toString('hex').toUpperCase());user=db.prepare('SELECT * FROM users WHERE id=?').get(uid);}catch{return res.status(409).json({error:'Este e-mail já está cadastrado.'});}
  }else if(req.params.action==='login'){
   user=db.prepare('SELECT * FROM users WHERE email=?').get(email.trim().toLowerCase());const [salt,hash]=(user?.password||'dummy:'+ '00'.repeat(64)).split(':');
   if(!timingSafeEqual(scryptSync(password,salt,64),Buffer.from(hash,'hex')))return res.status(401).json({error:'E-mail ou senha incorretos.'});
  }else return res.sendStatus(404);
  const token=id();db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(token,user.id,now+30*86400000);
  res.setHeader('Set-Cookie',`session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000${process.env.NODE_ENV==='production'?'; Secure':''}`);res.json(safe(user));
 });
 app.get('/api/me',auth,(req,res)=>res.json(safe(req.user)));
 app.post('/api/logout',auth,(req,res)=>{const token=/(?:^|;\s*)session=([a-f0-9]+)/.exec(req.headers.cookie)?.[1];db.prepare('DELETE FROM sessions WHERE token=?').run(token);for(const s of io.sockets.sockets.values())if(s.handshake.headers.cookie===req.headers.cookie)s.disconnect(true);res.setHeader('Set-Cookie','session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');res.json({ok:true});});
 app.post('/api/connect',auth,(req,res)=>{
  if(req.user.pair)return res.status(409).json({error:'Você já está conectado ao seu amor.'});
  const partner=db.prepare('SELECT * FROM users WHERE invite=?').get(String(req.body.code||'').trim().toUpperCase());
  if(!partner||partner.id===req.user.id||partner.pair)return res.status(400).json({error:'Código inválido ou conta já conectada.'});
  const pair=id();db.prepare('UPDATE users SET pair=? WHERE id IN (?,?)').run(pair,req.user.id,partner.id);for(const socket of io.sockets.sockets.values())if([req.user.id,partner.id].includes(socket.data.user.id))socket.emit('refresh');res.json(safe(db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id)));
 });
 app.get('/api/items',auth,(req,res)=>res.json(req.user.pair?db.prepare('SELECT * FROM items WHERE pair=? ORDER BY created ASC').all(req.user.pair).map(i=>({...i,body:JSON.parse(i.body)})):[]));
 const add=(req,kind,body)=>{const item={id:id(),pair:req.user.pair,kind,author:req.user.id,body,created:Date.now()};db.prepare('INSERT INTO items VALUES(?,?,?,?,?,?)').run(item.id,item.pair,kind,item.author,JSON.stringify(body),item.created);io.to(item.pair).emit('refresh');return item;};
 app.post('/api/items',auth,paired,(req,res)=>{
  const {kind,body}=req.body;
  if(!['message','movie','goal'].includes(kind)||!body||typeof body.text!=='string'||!body.text.trim()||body.text.length>4000)return res.status(400).json({error:'Preencha o texto (até 4.000 caracteres).'});
  res.json(add(req,kind,{text:body.text.trim(),done:false,type:body.type==='Série'?'Série':'Filme'}));
 });
 app.patch('/api/items/:id',auth,paired,(req,res)=>{const item=db.prepare('SELECT * FROM items WHERE id=? AND pair=?').get(req.params.id,req.user.pair);if(!item||!['movie','goal'].includes(item.kind))return res.sendStatus(404);const body={...JSON.parse(item.body),done:!!req.body.done};db.prepare('UPDATE items SET body=? WHERE id=?').run(JSON.stringify(body),item.id);io.to(req.user.pair).emit('refresh');res.json({ok:true});});
 app.delete('/api/items/:id',auth,paired,(req,res)=>{const item=db.prepare('SELECT * FROM items WHERE id=? AND pair=?').get(req.params.id,req.user.pair);if(!item)return res.sendStatus(404);if(item.author!==req.user.id)return res.status(403).json({error:'Somente quem adicionou pode excluir.'});if(item.kind==='photo')unlinkSync(path.join(dataDir,'uploads',JSON.parse(item.body).file));db.prepare('DELETE FROM items WHERE id=?').run(item.id);io.to(req.user.pair).emit('refresh');res.json({ok:true});});
 const upload=multer({dest:path.join(dataDir,'uploads'),limits:{fileSize:10*1024*1024,files:1}});
 app.post('/api/photos',auth,paired,upload.single('photo'),(req,res)=>{
  if(!req.file)return res.status(400).json({error:'Escolha uma foto.'});
  const b=readFileSync(req.file.path), mime=b.subarray(0,3).equals(Buffer.from([255,216,255]))?'image/jpeg':b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP'?'image/webp':null;
  if(!mime){unlinkSync(req.file.path);return res.status(400).json({error:'Use uma imagem JPEG, PNG ou WebP.'});}
  res.json(add(req,'photo',{file:req.file.filename,mime,text:String(req.body.text||'Nosso momento').slice(0,120)}));
 });
 app.get('/api/photos/:file',auth,paired,(req,res)=>{const item=db.prepare("SELECT body FROM items WHERE pair=? AND kind='photo'").all(req.user.pair).map(x=>JSON.parse(x.body)).find(x=>x.file===req.params.file);if(!item)return res.sendStatus(404);res.setHeader('Cache-Control','private, no-store');res.type(item.mime).sendFile(path.resolve(dataDir,'uploads',item.file));});
 app.get('/api/rtc',auth,(req,res)=>res.json({iceServers:[{urls:'stun:stun.l.google.com:19302'},...(process.env.TURN_URL&&process.env.TURN_USERNAME&&process.env.TURN_PASSWORD?[{urls:process.env.TURN_URL,username:process.env.TURN_USERNAME,credential:process.env.TURN_PASSWORD}]:[])]}));
 io.use((socket,next)=>{const user=userFor(socket.handshake.headers.cookie);if(!user)return next(new Error('Não autenticado'));socket.data.user=user;next();});
 io.on('connection',socket=>{const user=socket.data.user;if(user.pair){socket.join(user.pair);socket.to(user.pair).emit('presence',true);}socket.on('signal',payload=>{const fresh=userFor(socket.handshake.headers.cookie);if(!fresh?.pair)return;const partner=db.prepare('SELECT id FROM users WHERE pair=? AND id<>?').get(fresh.pair,fresh.id);for(const s of io.sockets.sockets.values())if(s.data.user.id===partner?.id)s.emit('signal',{from:fresh.name,data:payload});});socket.on('disconnect',()=>{if(user.pair)socket.to(user.pair).emit('presence',false);});});
 app.use(express.static('public'));
 app.use((err,req,res,next)=>{console.error(err.message);res.status(err instanceof multer.MulterError?400:500).json({error:err instanceof multer.MulterError?'A foto deve ter no máximo 10 MB.':'Não foi possível concluir. Tente novamente.'});});
 return {server,db,io};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const {server}=createApp();server.listen(process.env.PORT||3000,'0.0.0.0',()=>console.log('Nosso Cantinho iniciado na porta '+(process.env.PORT||3000)));}
