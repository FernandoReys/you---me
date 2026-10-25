import {Platform,PermissionsAndroid} from 'react-native';
import RNCallKeep from 'react-native-callkeep';
import {mediaDevices,RTCPeerConnection,RTCSessionDescription,RTCIceCandidate,MediaStream} from 'react-native-webrtc';
import {api} from './session';
import {IncomingCall,parseIncomingCall} from './callState';
import {NATIVE_CALLS_ENABLED} from './config';
type Signal={seq:number;at:number;from:string;data:{type:string;callId:string;video?:boolean;sdp?:any;candidate?:any}};
type State={uuid:string;name:string;video:boolean;status:string;local?:MediaStream;remote?:MediaStream};
let state:State|null=null,peer:RTCPeerConnection|null=null,stream:MediaStream|null=null,poll:ReturnType<typeof setInterval>|undefined,deadline:ReturnType<typeof setTimeout>|undefined,cursor=0,syncing=false,mediaReady=false,candidates:any[]=[],sentReady=false,outgoing:any[]=[],setupPromise:Promise<unknown>|undefined;
const listeners=new Set<(s:State|null)=>void>();
export const listenCalls=(listener:(s:State|null)=>void)=>{listeners.add(listener);listener(state);return()=>{listeners.delete(listener)}};
function emit(){for(const listener of listeners)listener(state?{...state}:null)}
function signal(data:object){return api('/signals',{method:'POST',body:{...data,callId:state?.uuid}})}
async function sendCandidates(){sentReady=true;for(const data of outgoing)await signal(data);outgoing=[]}
async function addCandidates(){if(!peer?.remoteDescription)return;for(const candidate of candidates)await peer.addIceCandidate(new RTCIceCandidate(candidate));candidates=[]}
export async function initializeCalls(){
 if(!NATIVE_CALLS_ENABLED)return false;
 setupPromise||=RNCallKeep.setup({ios:{appName:'You & Me',supportsVideo:true,maximumCallGroups:'1',maximumCallsPerCallGroup:'1',includesCallsInRecents:true},android:{alertTitle:'Chamadas do You & Me',alertDescription:'Permita chamadas para atender com a tela bloqueada.',cancelButton:'Agora não',okButton:'Continuar',additionalPermissions:[],selfManaged:false,foregroundService:{channelId:'youme-calls',channelName:'Chamadas em andamento',notificationTitle:'Chamada do You & Me em andamento'}}});
 await setupPromise;RNCallKeep.setAvailable(true);RNCallKeep.setReachable();return true;
}
async function prepare(){
 if(!state)throw Error('Chamada encerrada.');const uuid=state.uuid;
 if(Platform.OS==='android'){
  const audio=await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);if(audio!=='granted')throw Error('Permita o microfone para atender.');
  if(state.video){const camera=await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);if(camera!=='granted')throw Error('Permita a câmera para a chamada de vídeo.')}
 }
 const local=await mediaDevices.getUserMedia({audio:true,video:state.video?{facingMode:'user',width:640,height:480}:false});
 if(state?.uuid!==uuid){local.getTracks().forEach(t=>t.stop());throw Error('Chamada encerrada.')}
 stream=local;state.local=local;emit();const config=await api('/rtc');
 if(state?.uuid!==uuid){local.getTracks().forEach(t=>t.stop());return}
 peer=new RTCPeerConnection({iceServers:config.iceServers});local.getTracks().forEach(track=>peer!.addTrack(track,local));
 peer.addEventListener('icecandidate',event=>{if(event.candidate){const payload={type:'candidate',candidate:event.candidate.toJSON()};if(sentReady)signal(payload).catch(()=>{});else outgoing.push(payload)}});
 peer.addEventListener('track',event=>{if(state&&event.streams[0]){state.remote=event.streams[0];emit()}});
 peer.addEventListener('connectionstatechange',()=>{if(peer?.connectionState==='connected'&&state){if(deadline)clearTimeout(deadline);state.status='Conectado';RNCallKeep.setCurrentCallActive(state.uuid);if(Platform.OS==='ios')RNCallKeep.reportConnectedOutgoingCallWithUUID(state.uuid);emit()}if(peer?.connectionState==='failed')void endCall()});
 mediaReady=true;
}
function startPolling(){if(poll)clearInterval(poll);poll=setInterval(()=>void sync().catch(()=>{}),1500);deadline=setTimeout(()=>void endCall(),60000)}
async function sync(){
 if(syncing||!state)return;syncing=true;
 try{const data=await api<{signals:Signal[];cursor:number}>('/sync?visible=1&after='+cursor);for(const item of data.signals){cursor=Math.max(cursor,item.seq);if(item.data.callId!==state?.uuid)continue;
  if(item.data.type==='candidate'){candidates.push(item.data.candidate);await addCandidates()}
  else if(item.data.type==='answer'&&peer){await peer.setRemoteDescription(new RTCSessionDescription(item.data.sdp));await addCandidates()}
  else if(['end','busy'].includes(item.data.type)){await endCall(false);break}
 }cursor=Math.max(cursor,data.cursor)}finally{syncing=false}
}
export async function showIncoming(value:unknown,alreadyReported=false){
 const call=parseIncomingCall(value);if(!call||!await initializeCalls())return;
 if(state&&state.uuid!==call.uuid)return;
 state={uuid:call.uuid,name:call.callerName,video:call.video,status:'Chamada recebida'};emit();
 if(!alreadyReported)RNCallKeep.displayIncomingCall(call.uuid,call.callerName,call.callerName,'generic',call.video);
 if(deadline)clearTimeout(deadline);deadline=setTimeout(()=>void endCall(),Math.max(0,call.expiresAt-Date.now()));
}
export async function answerCall(uuid:string){
 uuid=uuid.toLowerCase();
 try{
  // The authenticated server must return only an offer addressed to this account.
  const call=await api<{offer:Signal}>('/native/calls/'+uuid);const offer=call.offer;
  if(Date.now()-offer.at>60000||offer.data.callId!==uuid)throw Error('A chamada já terminou.');
  if(!state)state={uuid,name:offer.from,video:!!offer.data.video,status:'Conectando…'};
  if(state.uuid!==uuid)return;state.status='Conectando…';emit();
  await prepare();if(!peer||!mediaReady)return;
  await peer.setRemoteDescription(new RTCSessionDescription(offer.data.sdp));await addCandidates();await peer.setLocalDescription(await peer.createAnswer());await signal({type:'answer',sdp:peer.localDescription});await sendCandidates();startPolling();await sync();
 }catch{if(state)await endCall();else RNCallKeep.endCall(uuid)}
}
export async function startCall(uuid:string,video:boolean){
 if(state||!await initializeCalls())return;
 const me=await api('/me');if(!me.partner)throw Error('Conecte seu par antes de ligar.');
 state={uuid,name:me.partner.name,video,status:'Ligando…'};emit();RNCallKeep.startCall(uuid,me.partner.name,me.partner.name,'generic',video);
 try{await prepare();if(!peer)return;await peer.setLocalDescription(await peer.createOffer());await signal({type:'offer',video,sdp:peer.localDescription});await sendCandidates();startPolling()}catch(error){await endCall();throw error}
}
export async function endCall(notify=true){
 if(!state)return;const uuid=state.uuid;if(notify)await signal({type:'end'}).catch(()=>{});
 if(poll)clearInterval(poll);if(deadline)clearTimeout(deadline);peer?.close();stream?.getTracks().forEach(t=>t.stop());peer=null;stream=null;state=null;candidates=[];outgoing=[];sentReady=false;mediaReady=false;cursor=0;RNCallKeep.endCall(uuid);emit();
}
export function muteCall(){const track=stream?.getAudioTracks()[0];if(track)track.enabled=!track.enabled}
RNCallKeep.addEventListener('answerCall',({callUUID})=>void answerCall(callUUID));
RNCallKeep.addEventListener('endCall',()=>void endCall());
RNCallKeep.addEventListener('didPerformSetMutedCallAction',({muted})=>stream?.getAudioTracks().forEach(t=>t.enabled=!muted));
RNCallKeep.addEventListener('didLoadWithEvents',async events=>{for(const event of events){if(event.name==='RNCallKeepPerformAnswerCallAction')await answerCall(event.data.callUUID);if(event.name==='RNCallKeepPerformEndCallAction')await endCall()}});
