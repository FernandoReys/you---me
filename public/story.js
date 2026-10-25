const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let loaded=false,loading=null,timer;
function selectTab(key){
 $$('[data-story-tab]').forEach(button=>{const active=button.dataset.storyTab===key;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1});
 for(const tab of ['timeline','letter','time','surprises','game'])$('#story-'+tab).hidden=key!==tab;
 if(key==='game'){const frame=$('#couple-game');if(!frame.getAttribute('src'))frame.src=frame.dataset.src}
 $('.story-native-tabs').scrollIntoView({behavior:'smooth',block:'start'});
}
export async function loadStory(){
 if(loaded)return;if(loading)return loading;
 loading=(async()=>{
  try{const response=await fetch('/memorias/historia.json');if(!response.ok)throw Error('Não foi possível abrir nossa história. Tente novamente.');const story=await response.json();
   $('#story-timeline').innerHTML=story.chapters.map((chapter,index)=>`<article class="story-chapter"><div class="chapter-image"><img src="${esc(chapter.photo)}" alt="${esc(chapter.alt)}" loading="lazy" decoding="async"></div><div class="chapter-copy"><span class="eyebrow">CAPÍTULO ${String(index+1).padStart(2,'0')}</span>${chapter.paragraphs.map(p=>`<p>${esc(p)}</p>`).join('')}<span class="chapter-heart" aria-hidden="true">♡</span></div></article>`).join('')+'<div class="story-continuation"><span>♡</span><h3>A nossa história continua.</h3><p>Entre todas as possibilidades, eu ainda escolheria você.</p></div>';
   $('#story-letter').innerHTML=`<article class="story-letter-card"><span class="eyebrow">ESCREVI PARA VOCÊ</span><h2>Para minha fofinha ♡</h2><div>${story.letter.split(/\n\s*\n/).map(p=>`<p>${esc(p).replace(/\n/g,'<br>')}</p>`).join('')}</div><span class="letter-signature">com amor, sempre.</span></article>`;
   $('#story-time').innerHTML='<div class="story-time-card"><span class="eyebrow">DESDE 04 DE ABRIL DE 2026</span><h2>O tempo passa.<br>O carinho fica.</h2><div class="time-counter" aria-label="Tempo desde o início do relacionamento">'+[['days','dias'],['hours','horas'],['minutes','minutos'],['seconds','segundos']].map(([key,label])=>`<div><strong data-time="${key}">0</strong><span>${label}</span></div>`).join('')+'</div><p>De pequenos momentos, a gente faz a nossa história. ♡</p></div>';
   const updateTime=()=>{const elapsed=Math.max(0,Math.floor((Date.now()-new Date(story.startDate).getTime())/1000));const values={days:Math.floor(elapsed/86400),hours:Math.floor(elapsed/3600)%24,minutes:Math.floor(elapsed/60)%60,seconds:elapsed%60};for(const [key,value] of Object.entries(values))$('[data-time="'+key+'"]').textContent=String(value).padStart(2,'0')};updateTime();clearInterval(timer);timer=setInterval(()=>{if(!document.hidden&&!$('#story-time').hidden)updateTime()},1000);
   $('#story-surprises').innerHTML='<div class="surprises-intro"><span class="eyebrow">UMA SURPRESA DE CADA VEZ</span><h2>Tem carinho em cada caixinha.</h2><p>Toque para abrir uma mensagem que escrevi para você.</p></div><div class="native-gifts">'+story.surprises.map((message,index)=>`<button class="native-gift" aria-expanded="false" data-gift="${index}"><span aria-hidden="true">♡</span><b>Presente ${index+1}</b><p hidden>${esc(message)}</p></button>`).join('')+'</div>';
   $$('[data-gift]').forEach(button=>button.onclick=()=>{const open=button.getAttribute('aria-expanded')!=='true';button.setAttribute('aria-expanded',String(open));button.querySelector('p').hidden=!open;button.querySelector('b').textContent=open?'Para você ♡':'Presente '+(Number(button.dataset.gift)+1)});
   $('#story-loading').hidden=true;loaded=true;
  }catch(error){$('#story-loading').textContent='Não foi possível carregar. Saia desta aba e tente novamente.';throw error}finally{loading=null}
 })();return loading;
}
$$('[data-story-tab]').forEach(button=>{button.onclick=()=>selectTab(button.dataset.storyTab);button.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const tabs=$$('[data-story-tab]'),index=tabs.indexOf(button);const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;selectTab(tabs[next].dataset.storyTab);tabs[next].focus()}});
