import {avatar} from './personalize.js';
let timer;
export function showMessageNotice(person,text,onOpen){
 const banner=document.querySelector('#message-notice');avatar(banner.querySelector('.notice-avatar'),person);banner.querySelector('b').textContent=person?.name||'Seu amor';banner.querySelector('.notice-text').textContent=Array.from(String(text||'Nova mensagem')).slice(0,180).join('');banner.hidden=false;banner.onclick=()=>{banner.hidden=true;onOpen()};clearTimeout(timer);timer=setTimeout(()=>banner.hidden=true,6000);
}
