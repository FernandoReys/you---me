import pg from 'pg';
import {readFile} from 'node:fs/promises';
if(!process.env.DATABASE_URL_UNPOOLED)throw Error('Configure DATABASE_URL_UNPOOLED para executar a migração.');
const client=new pg.Client({connectionString:process.env.DATABASE_URL_UNPOOLED});
await client.connect();
try{
 for(const name of ['001_initial.sql','002_personalization.sql','003_web_push.sql','004_native_calls.sql']){
  await client.query(await readFile(new URL('../migrations/'+name,import.meta.url),'utf8'));
  console.log('Migração '+name+' concluída.');
 }
}finally{await client.end()}
