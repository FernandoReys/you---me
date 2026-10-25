const $=s=>document.querySelector(s);
let api,toast,action,registration,userId,enabled=false,deferredInstall=null,currentGeneration=0;
const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const standalone=()=>window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
function supported(){return 'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window&&window.isSecureContext}
function urlBytes(base64){const padding='='.repeat((4-base64.length%4)%4),raw=atob((base64+padding).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(raw,c=>c.charCodeAt(0))}
function displayStatus(text){$('#notification-status').textContent=text;$('#enable-alerts').textContent=enabled?'Desativar alertas neste aparelho':'Ativar notificações';$('#test-alerts').hidden=!enabled}
async function worker(){if(registration)return registration;let timeout;try{registration=await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>timeout=setTimeout(()=>reject(Error('Não foi possível iniciar os alertas. Recarregue o app.')),8000))]);return registration}finally{clearTimeout(timeout)}}
export async function syncPushForUser(id){
 if(userId===id)return;userId=id;const generation=++currentGeneration;enabled=false;
 if(!id)return;
 if(ios&&!standalone()){displayStatus('No iPhone, instale o app na Tela de Início e abra pelo ícone para ativar as notificações.');return}
 if(!supported()){displayStatus('Este navegador não oferece push. Instale o app ou abra em um navegador atualizado.');return}
 try{const reg=await worker(),subscription=await reg.pushManager.getSubscription();if(generation!==currentGeneration)return;
  if(Notification.permission==='granted'&&subscription){const result=await api('/push/status?endpoint='+encodeURIComponent(subscription.endpoint));enabled=result.enabled;if(enabled){await api('/push/subscribe',{method:'POST',body:subscription.toJSON()})}}
  if(generation!==currentGeneration)return;
  displayStatus(enabled?'Ativado neste aparelho. Você pode receber novidades com o app fechado e a tela bloqueada.':Notification.permission==='denied'?'As notificações estão bloqueadas. Permita-as nas configurações do navegador ou do aparelho.':'Ative para receber mensagens mesmo com o app fechado.');
 }catch{displayStatus('Não foi possível verificar os alertas. Tente ativá-los novamente.')}
}
export async function disconnectPush(){
 ++currentGeneration;const id=userId;userId=null;enabled=false;
 if(!supported())return;
 try{const sub=await(await worker()).pushManager.getSubscription();if(sub){await api('/push/unsubscribe',{method:'POST',body:{endpoint:sub.endpoint}});await sub.unsubscribe()}}catch{/* Logout also revokes this session's subscription on the server. */}
 return id;
}
function openInstall(){
 $('#install-ios').hidden=!ios;$('#install-android').hidden=ios;$('#install-prompt').hidden=!deferredInstall;$('#install-current').hidden=!standalone();$('#install-dialog').showModal();
}
export function initPush(options){({api,toast,action}=options);
 if('serviceWorker' in navigator&&window.isSecureContext)navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).catch(()=>displayStatus('Não foi possível preparar os alertas. Recarregue o app.'));
 $('#enable-alerts').onclick=e=>action(async()=>{
  if(ios&&!standalone()){openInstall();return}
  if(!supported())throw Error('Push indisponível neste navegador. Use o app instalado e um sistema atualizado.');
  if(enabled){const sub=await(await worker()).pushManager.getSubscription();if(sub){await api('/push/unsubscribe',{method:'POST',body:{endpoint:sub.endpoint}});await sub.unsubscribe()}enabled=false;displayStatus('Alertas desativados neste aparelho.');return}
  // Permission request is directly tied to this user gesture (required on iOS).
  const permission=await Notification.requestPermission();if(permission!=='granted'){displayStatus('Permissão não concedida. Ajuste as notificações nas configurações do aparelho.');return}
  const config=await api('/push/config');if(!config.configured)throw Error('As notificações ainda não estão configuradas no servidor.');
  const reg=await worker();let sub=await reg.pushManager.getSubscription();if(sub){const old=sub.options.applicationServerKey;const next=urlBytes(config.publicKey);if(old&&Array.from(new Uint8Array(old)).join(',')!==Array.from(next).join(',')){await sub.unsubscribe();sub=null}}
  sub||=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBytes(config.publicKey)});
  await api('/push/subscribe',{method:'POST',body:sub.toJSON()});enabled=true;displayStatus('Ativado. As notificações chegam também com o app fechado ou a tela bloqueada.');toast('Notificações ativadas neste aparelho. Toque em Testar notificação para conferir.');
 },e.currentTarget);
 $('#test-alerts').onclick=e=>action(async()=>{const sub=await(await worker()).pushManager.getSubscription();if(!sub)throw Error('Reative os alertas para continuar.');await api('/push/test',{method:'POST',body:{endpoint:sub.endpoint}});toast('Teste enviado pelo servidor. Confira a central de notificações.');},e.currentTarget);
 $('#install-app').onclick=openInstall;$('#install-app-login').onclick=openInstall;$('#close-install').onclick=()=>$('#install-dialog').close();
 $('#install-prompt').onclick=e=>action(async()=>{if(!deferredInstall)return;await deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;$('#install-prompt').hidden=true},e.currentTarget);
 window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;$('#install-prompt').hidden=false});
 window.addEventListener('appinstalled',()=>{deferredInstall=null;$('#install-prompt').hidden=true;$('#install-current').hidden=false;toast('You & Me instalado. ♡')});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)navigator.clearAppBadge?.()?.catch(()=>{})});
}
