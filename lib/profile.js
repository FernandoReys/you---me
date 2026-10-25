import multer from 'multer';
import {randomBytes} from 'node:crypto';
export const DEFAULT_PREFERENCES={theme:'midnight',bubble:'classic',wallpaperOpacity:35};
const themes=['midnight','rose','crimson','obsidian','petrol'];
const bubbles=['classic','soft','love','cat','ghost'];
export async function profileFor(db,userId){
 const row=await db.one('SELECT preferences,avatar_version,wallpaper_version FROM user_settings WHERE user_id=?',userId);
 return {preferences:{...DEFAULT_PREFERENCES,...JSON.parse(row?.preferences||'{}')},avatar:row?.avatar_version?`/api/profile-media/${userId}/avatar?v=${row.avatar_version}`:null,wallpaper:row?.wallpaper_version?`/api/profile-media/${userId}/wallpaper?v=${row.wallpaper_version}`:null};
}
export function installProfileRoutes(app,db,auth,safe){
 const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:3*1024*1024,files:1,fields:0}});
 app.patch('/api/profile',auth,async(req,res)=>{
  const {name}=req.body||{};
  if(typeof name!=='string'||!name.trim()||name.length>60)return res.status(400).json({error:'Use um nome de 1 a 60 caracteres.'});
  await db.run('UPDATE users SET name=? WHERE id=?',name.trim(),req.user.id);res.json(await safe({...req.user,name:name.trim()}));
 });
 app.put('/api/preferences',auth,async(req,res)=>{
  const p=req.body;
  if(!p||!themes.includes(p.theme)||!bubbles.includes(p.bubble)||!Number.isInteger(p.wallpaperOpacity)||p.wallpaperOpacity<15||p.wallpaperOpacity>65)return res.status(400).json({error:'Escolha um tema, um balão e uma intensidade válida.'});
  const preferences={theme:p.theme,bubble:p.bubble,wallpaperOpacity:p.wallpaperOpacity};
  await db.run('INSERT INTO user_settings(user_id,preferences) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET preferences=excluded.preferences',req.user.id,JSON.stringify(preferences));res.json({preferences});
 });
 app.post('/api/profile-media/:kind',auth,upload.single('photo'),async(req,res)=>{
  const {kind}=req.params;if(!['avatar','wallpaper'].includes(kind))return res.sendStatus(404);
  const b=req.file?.buffer;if(!b)return res.status(400).json({error:'Escolha uma imagem.'});
  const mime=b.subarray(0,3).equals(Buffer.from([255,216,255]))?'image/jpeg':b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP'?'image/webp':null;
  if(!mime)return res.status(400).json({error:'Use uma imagem JPEG, PNG ou WebP.'});
  const version=randomBytes(8).toString('hex'),column=kind==='avatar'?'avatar_version':'wallpaper_version';
  await db.transaction(async tx=>{
   await tx.run('INSERT INTO profile_media(user_id,kind,mime,bytes) VALUES(?,?,?,?) ON CONFLICT(user_id,kind) DO UPDATE SET mime=excluded.mime,bytes=excluded.bytes',req.user.id,kind,mime,b);
   await tx.run(`INSERT INTO user_settings(user_id,${column}) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET ${column}=excluded.${column}`,req.user.id,version);
  });res.json(await profileFor(db,req.user.id));
 });
 app.delete('/api/profile-media/:kind',auth,async(req,res)=>{
  const {kind}=req.params;if(!['avatar','wallpaper'].includes(kind))return res.sendStatus(404);
  const column=kind==='avatar'?'avatar_version':'wallpaper_version';
  await db.transaction(async tx=>{await tx.run('DELETE FROM profile_media WHERE user_id=? AND kind=?',req.user.id,kind);await tx.run(`UPDATE user_settings SET ${column}='' WHERE user_id=?`,req.user.id)});
  res.json(await profileFor(db,req.user.id));
 });
 app.get('/api/profile-media/:user/:kind',auth,async(req,res)=>{
  const {user,kind}=req.params;if(!['avatar','wallpaper'].includes(kind))return res.sendStatus(404);
  if(user!==req.user.id){
   if(kind!=='avatar'||!req.user.pair)return res.sendStatus(404);
   const partner=await db.one('SELECT id FROM users WHERE id=? AND pair=?',user,req.user.pair);if(!partner)return res.sendStatus(404);
  }
  const photo=await db.one('SELECT mime,bytes FROM profile_media WHERE user_id=? AND kind=?',user,kind);
  if(!photo)return res.sendStatus(404);res.type(photo.mime).send(Buffer.from(photo.bytes));
 });
}
