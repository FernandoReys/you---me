import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
import pg from 'pg';
const sqliteSchema=`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,invite TEXT UNIQUE NOT NULL,pair TEXT,seen INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires INTEGER NOT NULL,seen INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS items(id TEXT PRIMARY KEY,pair TEXT NOT NULL,kind TEXT NOT NULL,author TEXT NOT NULL,body TEXT NOT NULL,created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS photos(id TEXT PRIMARY KEY,pair TEXT NOT NULL,mime TEXT NOT NULL,bytes BLOB NOT NULL);
CREATE TABLE IF NOT EXISTS signals(seq INTEGER PRIMARY KEY AUTOINCREMENT,pair TEXT NOT NULL,sender TEXT NOT NULL,recipient TEXT NOT NULL,body TEXT NOT NULL,created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS auth_attempts(key TEXT PRIMARY KEY,n INTEGER NOT NULL,expires INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS items_pair_created ON items(pair,created);
CREATE INDEX IF NOT EXISTS signals_recipient_seq ON signals(recipient,seq);`;
export function openStore({dataDir='./data',databaseUrl=process.env.DATABASE_URL}={}){
 if(databaseUrl){
  const pool=new pg.Pool({connectionString:databaseUrl,max:3,idleTimeoutMillis:10000,connectionTimeoutMillis:10000});
  if(process.env.VERCEL)import('@vercel/functions').then(({attachDatabasePool})=>attachDatabasePool(pool)).catch(()=>{});
  const wrapper=client=>({
   one:async(sql,...args)=>(await client.query(convert(sql),args)).rows[0]||null,
   all:async(sql,...args)=>(await client.query(convert(sql),args)).rows,
   run:async(sql,...args)=>{const r=await client.query(convert(sql),args);return {changes:r.rowCount}},
  });
  return {...wrapper(pool),postgres:true,async transaction(fn){const client=await pool.connect();try{await client.query('BEGIN');const result=await fn(wrapper(client));await client.query('COMMIT');return result}catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}},close:()=>pool.end()};
 }
 if(process.env.VERCEL)throw new Error('DATABASE_URL precisa ser configurada antes de publicar. SQLite não é usado no Vercel.');
 mkdirSync(dataDir,{recursive:true});const db=new DatabaseSync(path.join(dataDir,'app-v2.sqlite'));db.exec(sqliteSchema);
 const wrapper={one:async(sql,...args)=>db.prepare(sql).get(...args)||null,all:async(sql,...args)=>db.prepare(sql).all(...args),run:async(sql,...args)=>db.prepare(sql).run(...args)};
 let previous=Promise.resolve();
 return {...wrapper,postgres:false,async transaction(fn){let release;const done=new Promise(r=>release=r);const before=previous;previous=done;await before;db.exec('BEGIN IMMEDIATE');try{const result=await fn(wrapper);db.exec('COMMIT');return result}catch(e){db.exec('ROLLBACK');throw e}finally{release()}},close:()=>db.close()};
}
function convert(sql){let index=0;return sql.replace(/\?/g,()=>'$'+(++index))}
