import {execFileSync} from 'node:child_process';import {readFileSync} from 'node:fs';
for(const f of ['server.js','scripts/migrate.js','lib/store.js','lib/profile.js','lib/push.js','api/index.js','public/app.js','public/story.js','public/personalize.js','public/icons.js','public/push.js','public/viewport.js','public/notice.js','public/memorias/jogo/physics.js','public/sw.js'])execFileSync(process.execPath,['--check',f],{stdio:'inherit'});
JSON.parse(readFileSync('public/manifest.webmanifest','utf8'));console.log('Source checks passed.');
