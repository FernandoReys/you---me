import {createSign} from 'node:crypto';
import {connect} from 'node:http2';
const b64=value=>Buffer.from(typeof value==='string'?value:JSON.stringify(value)).toString('base64url');
let googleToken,appleToken;
export function nativeCapabilities(){return {android:!!process.env.FCM_SERVICE_ACCOUNT_JSON,ios:!!(process.env.APNS_TEAM_ID&&process.env.APNS_KEY_ID&&process.env.APNS_PRIVATE_KEY&&process.env.APNS_BUNDLE_ID)}}
async function googleAccessToken(){
 if(googleToken?.until>Date.now())return googleToken.value;
 const account=JSON.parse(process.env.FCM_SERVICE_ACCOUNT_JSON),now=Math.floor(Date.now()/1000);
 const input=b64({alg:'RS256',typ:'JWT'})+'.'+b64({iss:account.client_email,scope:'https://www.googleapis.com/auth/firebase.messaging',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
 const assertion=input+'.'+createSign('RSA-SHA256').update(input).sign(account.private_key).toString('base64url');
 const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}),signal:AbortSignal.timeout(5000)});
 if(!response.ok)throw Error('Firebase authentication failed');const result=await response.json();if(!result.access_token)throw Error('Firebase token missing');googleToken={value:result.access_token,until:Date.now()+Math.max(0,(Number(result.expires_in)-120)*1000)};return googleToken.value;
}
function appleAccessToken(){
 if(appleToken?.until>Date.now())return appleToken.value;const now=Math.floor(Date.now()/1000);
 const input=b64({alg:'ES256',kid:process.env.APNS_KEY_ID})+'.'+b64({iss:process.env.APNS_TEAM_ID,iat:now});
 const signature=createSign('SHA256').update(input).sign({key:process.env.APNS_PRIVATE_KEY.replace(/\\n/g,'\n'),dsaEncoding:'ieee-p1363'}).toString('base64url');
 appleToken={value:input+'.'+signature,until:Date.now()+45*60000};return appleToken.value;
}
export async function sendNativeCall(device,payload){
 if(device.platform==='android'){
  const account=JSON.parse(process.env.FCM_SERVICE_ACCOUNT_JSON);if(!/^[a-z0-9-]+$/.test(account.project_id))throw Error('Invalid Firebase project');
  const data=Object.fromEntries(Object.entries(payload).map(([key,value])=>[key,String(value)]));
  const result=await fetch('https://fcm.googleapis.com/v1/projects/'+account.project_id+'/messages:send',{method:'POST',headers:{Authorization:'Bearer '+await googleAccessToken(),'Content-Type':'application/json'},body:JSON.stringify({message:{token:device.token,data,android:{priority:'high',ttl:'45s'}}}),signal:AbortSignal.timeout(5000)});
  if(!result.ok){const error=new Error('FCM rejected the call');error.statusCode=result.status;throw error}return;
 }
 await new Promise((resolve,reject)=>{
  const client=connect(process.env.APNS_ENVIRONMENT==='sandbox'?'https://api.sandbox.push.apple.com':'https://api.push.apple.com');
  const done=(error)=>{client.close();error?reject(error):resolve()};client.on('error',reject);client.setTimeout(5000,()=>{client.destroy();reject(Error('APNs timeout'))});
  const request=client.request({':method':'POST',':path':'/3/device/'+device.token,authorization:'bearer '+appleAccessToken(),'apns-topic':process.env.APNS_BUNDLE_ID+'.voip','apns-push-type':'voip','apns-priority':'10','apns-expiration':String(Math.floor(payload.expiresAt/1000))});
  let status=0;request.on('response',headers=>status=Number(headers[':status']));request.on('data',()=>{});request.on('error',done);request.on('end',()=>{if(status===200)done();else{const error=new Error('APNs rejected the call');error.statusCode=status;done(error)}});request.end(JSON.stringify({aps:{'content-available':1},...payload}));
 });
}
