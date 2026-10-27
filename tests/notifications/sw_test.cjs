const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const events={},shown=[],calls=[],opened=[];
const self={location:{origin:'https://noastudio.ai.kr'},addEventListener:(name,fn)=>events[name]=fn,registration:{showNotification:async(title,options)=>shown.push({title,options})},clients:{matchAll:async()=>[],openWindow:async url=>opened.push(url)}};
vm.runInNewContext(fs.readFileSync('deploy/noa-sw.js','utf8'),{self,URL,Response,fetch:async(...args)=>{calls.push(args);return {};}});
(async()=>{
 let pending;events.push({data:{json:()=>({id:42,body:'내 게시물에 새 댓글이 달렸어요.',url:'https://evil.invalid',receipt:'a'.repeat(64)})},waitUntil:p=>pending=p});await pending;
 assert.equal(shown.length,1);assert.equal(shown[0].options.data.url,'/noa-notifications.php?notice=42');assert.equal(shown[0].options.tag,'noa-activity-42');assert.equal(JSON.parse(calls[0][1].body).id,42);assert.equal(calls[0][1].credentials,'omit');
 events.notificationclick({notification:{data:{url:'https://evil.invalid'},close:()=>{}},waitUntil:p=>pending=p});await pending;assert.equal(opened[0],'https://noastudio.ai.kr/noa-notifications.php');
 events.push({data:{json:()=>{throw Error('malformed');}},waitUntil:p=>pending=p});await pending;assert.equal(shown[1].title,'AInoa · 내 활동 알림');assert.equal(calls.length,1);
 console.log('NOTIFICATION_SERVICE_WORKER_PASS: display, receipt, safe click, malformed push fallback');
})().catch(e=>{console.error(e);process.exitCode=1;});
