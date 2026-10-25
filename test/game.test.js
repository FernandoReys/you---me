import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {stepPlayer} from '../public/memorias/jogo/physics.js';
const ground=468;
const makePlayer=(x=330)=>({x,y:ground-56,w:40,h:56,vx:0,vy:0,speed:4.2,grounded:true});
test('a running jump lands on the first 150px platform',()=>{
 const p=makePlayer(),platforms=[{x:0,w:620,y:0},{x:380,w:140,y:150}];
 let peak=0,landed=false;
 for(let t=0;t<90;t++){
  stepPlayer(p,{right:t<20,jump:t===0},platforms,ground);
  peak=Math.max(peak,ground-p.y-p.h);
  if(p.grounded&&p.y===ground-150-p.h){landed=true;break}
 }
 assert.ok(peak>200);assert.ok(landed,'player must stand on the visible platform');
});
test('landing sweep catches a platform during a fast fall and passes from below',()=>{
 const p={...makePlayer(400),y:100,vy:200,grounded:false};
 stepPlayer(p,{},[{x:380,w:140,y:150}],ground);
 assert.equal(p.y,ground-150-p.h);assert.equal(p.grounded,true);
 const rising={...makePlayer(400),vy:-16,y:330,grounded:false};
 stepPlayer(rising,{},[{x:380,w:140,y:150}],ground);
 assert.ok(rising.y<330);assert.equal(rising.grounded,false);
});
test('jump input shortly before landing is buffered',()=>{
 const p={...makePlayer(400),y:250,vy:8,grounded:false};
 const platforms=[{x:380,w:140,y:150}];
 stepPlayer(p,{jump:true},platforms,ground);
 for(let i=0;i<5&&!p.grounded;i++)stepPlayer(p,{},platforms,ground);
 assert.equal(p.grounded,true);
 stepPlayer(p,{},platforms,ground);assert.ok(p.vy<0);
});
test('inline game module is valid JavaScript and game tab is present',()=>{
 const html=readFileSync('public/memorias/jogo/index.html','utf8');
 const js=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace(/^import .*$/m,'');
 new vm.Script(js);
 assert.match(readFileSync('public/index.html','utf8'),/data-story-tab="game"/);
});
