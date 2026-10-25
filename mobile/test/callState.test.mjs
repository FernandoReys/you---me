import test from 'node:test';
import assert from 'node:assert/strict';
import {parseIncomingCall} from '../src/callState.ts';
const now=Date.now(),valid={type:'incoming-call',uuid:'f925e5bc-04fd-4a58-976a-d94de3198a4d',callerName:'Fernando',video:'true',expiresAt:String(now+45000)};
test('accepts fresh Android/iOS call metadata',()=>{assert.deepEqual(parseIncomingCall(valid,now),{uuid:valid.uuid,callerName:'Fernando',video:true,expiresAt:now+45000})});
test('ignores expired and malformed calls',()=>{assert.equal(parseIncomingCall({...valid,expiresAt:now-1},now),null);assert.equal(parseIncomingCall({...valid,uuid:'invalid'},now),null);assert.equal(parseIncomingCall({...valid,expiresAt:now+3600000},now),null)});
