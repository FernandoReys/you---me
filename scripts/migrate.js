import pg from 'pg';import {readFile} from 'node:fs/promises';
if(!process.env.DATABASE_URL_UNPOOLED)throw Error('Configure DATABASE_URL_UNPOOLED para executar a migração.');
const client=new pg.Client({connectionString:process.env.DATABASE_URL_UNPOOLED});await client.connect();try{await client.query(await readFile(new URL('../migrations/001_initial.sql',import.meta.url),'utf8'));console.log('Migração 001 concluída.')}finally{await client.end()}
