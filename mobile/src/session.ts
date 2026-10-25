import CookieManager from '@react-native-cookies/cookies';
import * as Keychain from 'react-native-keychain';
import {Platform} from 'react-native';
import {APP_URL} from './config';
const service='youme.native.session';
export async function copyWebSession(){
 const cookies=await CookieManager.get(APP_URL,Platform.OS==='ios');
 const token=cookies.session?.value;
 if(token&&/^[a-f0-9]{36}$/.test(token))await Keychain.setGenericPassword('session',token,{service,accessible:Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY});
}
export async function forgetSession(){await Keychain.resetGenericPassword({service});await CookieManager.clearAll(Platform.OS==='ios')}
export async function api<T=any>(route:string,options:{method?:string;body?:unknown}={}):Promise<T>{
 const credentials=await Keychain.getGenericPassword({service});
 if(!credentials)throw Error('Entre na sua conta no app.');
 const response=await fetch(APP_URL+'/api'+route,{method:options.method||'GET',headers:{'Content-Type':'application/json',Cookie:'session='+credentials.password},body:options.body?JSON.stringify(options.body):undefined});
 const body=await response.json().catch(()=>({}));if(!response.ok)throw Error(body.error||'Não foi possível conectar.');return body;
}
