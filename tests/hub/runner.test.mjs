import test from 'node:test';
import assert from 'node:assert/strict';
import {signature,due} from '../../runtime/hub/runner.mjs';
import crypto from 'node:crypto';
test('host authentication matches the PHP envelope and fences the body',()=>{
 const body='{"action":"heartbeat"}',key='a'.repeat(64),ts='1794266100',nonce='b'.repeat(32);
 const expected=crypto.createHmac('sha256',key).update('N80-HUB-1\n'+crypto.createHash('sha256').update(body).digest('hex')+'\n'+ts+'\n'+nonce).digest('hex');
 assert.equal(signature(body,key,ts,nonce),expected);assert.notEqual(signature('{}',key,ts,nonce),expected);
});
test('ambiguous execution retries same identity with backoff, not a new task',()=>{
 assert.equal(due('x',{}, {pending:'old',nextAt:200},0,100),false);
 assert.equal(due('x',{}, {pending:'old',nextAt:200},0,200),true);
 assert.equal(due('x',{}, {unconfirmed:true},0,100),false);
});
test('schedule and explicit wakes coalesce',()=>{
 assert.equal(due('x',{}, {nextAt:200,requestedAt:30},30,100),false);
 assert.equal(due('x',{}, {nextAt:200,requestedAt:30},31,100),true);
 assert.equal(due('x',{}, {nextAt:200,requestedAt:30},30,200),true);
});
