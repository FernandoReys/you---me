import {Platform} from 'react-native';
import {getApps} from '@react-native-firebase/app';
import {getMessaging,getToken,onTokenRefresh,requestPermission,setBackgroundMessageHandler,onMessage} from '@react-native-firebase/messaging';
import VoipPush from 'react-native-voip-push-notification';
import {api} from './session';
import {initializeCalls,showIncoming} from './calls';
import {NATIVE_CALLS_ENABLED} from './config';
async function saveToken(platform:'android'|'ios',token:string){await api('/native/devices',{method:'POST',body:{platform,token}})}
export async function registerDevice(){
 if(!NATIVE_CALLS_ENABLED)return;
 await initializeCalls();
 if(Platform.OS==='android'){
  if(!getApps().length)throw Error('Configure o Firebase antes de ativar chamadas nativas.');
  await requestPermission(getMessaging());await saveToken('android',await getToken(getMessaging()));
  onTokenRefresh(getMessaging(),token=>void saveToken('android',token).catch(()=>{}));
 }else{VoipPush.addEventListener('register',token=>void saveToken('ios',token).catch(()=>{}));VoipPush.registerVoipToken()}
}
export function registerBackgroundHandlers(){
 if(!NATIVE_CALLS_ENABLED)return;
 if(Platform.OS==='android'&&getApps().length){setBackgroundMessageHandler(getMessaging(),async message=>{await showIncoming(message.data)});onMessage(getMessaging(),async message=>{await showIncoming(message.data)})}
 if(Platform.OS==='ios')VoipPush.addEventListener('notification',value=>{void showIncoming(value,true)});
}
