export type IncomingCall={uuid:string;callerName:string;video:boolean;expiresAt:number};
export function parseIncomingCall(value:unknown,now=Date.now()):IncomingCall|null{
 if(!value||typeof value!=='object')return null;const v=value as Record<string,unknown>;
 if(v.type!=='incoming-call'||typeof v.uuid!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.uuid))return null;
 const expiresAt=Number(v.expiresAt);if(!Number.isFinite(expiresAt)||expiresAt<=now||expiresAt>now+90000)return null;
 return {uuid:v.uuid.toLowerCase(),callerName:String(v.callerName||'Seu amor').slice(0,60),video:v.video===true||v.video==='true',expiresAt};
}
