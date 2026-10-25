import {execFileSync} from 'node:child_process';import {readFileSync} from 'node:fs';
for(const f of ['server.js','lib/store.js','api/index.js','public/app.js','public/story.js','public/sw.js'])execFileSync(process.execPath,['--check',f],{stdio:'inherit'});
JSON.parse(readFileSync('public/manifest.webmanifest','utf8'));console.log('Source checks passed.');
