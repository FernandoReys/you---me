// Keep the app inside the visible area, including Safari's keyboard pan.
export function viewportMetrics({height,layoutHeight,baselineHeight,offsetTop=0,focused=false,scale=1}){
 const zoomed=Math.abs(scale-1)>.05;
 const keyboard=focused&&!zoomed&&Math.max(layoutHeight,baselineHeight)-height>120;
 return {height:Math.max(1,Math.round(height)),keyboard,top:keyboard?Math.round(Math.max(0,Math.min(offsetTop,layoutHeight-height))):0};
}
export function initViewport(){
 const root=document.documentElement;let baseline=window.visualViewport?.height||innerHeight,oldWidth=innerWidth,frame;
 function update(){
  const vv=window.visualViewport,height=vv?.height||innerHeight;
  const focused=!!document.activeElement?.matches('input:not([type=file]):not([type=range]),textarea,[contenteditable=true]');
  if(Math.abs(innerWidth-oldWidth)>80){baseline=height;oldWidth=innerWidth}
  if(!focused&&height>=baseline-120)baseline=height;else if(focused)baseline=Math.max(baseline,height);
  const metrics=viewportMetrics({height,layoutHeight:innerHeight,baselineHeight:baseline,offsetTop:vv?.offsetTop||0,focused,scale:vv?.scale||1});
  const changed=root.classList.contains('keyboard-open')!==metrics.keyboard;
  root.style.setProperty('--app-height',metrics.height+'px');root.style.setProperty('--viewport-top',metrics.top+'px');root.classList.toggle('keyboard-open',metrics.keyboard);
  root.classList.toggle('app-visible',!document.querySelector('#app').hidden);
  if(changed&&document.activeElement?.closest('#message-form'))requestAnimationFrame(()=>{const messages=document.querySelector('#messages');messages.scrollTop=messages.scrollHeight});
 }
 function schedule(){cancelAnimationFrame(frame);frame=requestAnimationFrame(update)}
 window.visualViewport?.addEventListener('resize',schedule);window.visualViewport?.addEventListener('scroll',schedule);window.addEventListener('resize',schedule);window.addEventListener('orientationchange',()=>setTimeout(schedule,150));document.addEventListener('focusin',schedule);document.addEventListener('focusout',()=>{schedule();setTimeout(schedule,250)});
 new MutationObserver(schedule).observe(document.querySelector('#app'),{attributes:true,attributeFilter:['hidden']});update();
}
