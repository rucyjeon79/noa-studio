const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const vm = require('node:vm');
const source = readFileSync('deploy/noa-music-save.js', 'utf8');
function fixture({supported=true, pickError, mime='audio/mpeg', bytes=3, content=3, status=200, failWrite=false}={}) {
  const nodes={}; const calls=[]; let options;
  for(const id of ['music-download-file','music-save-help','music-save-status','music-save-cancel','music-save-fallback']) nodes[id]={hidden:true,textContent:'',dataset:{filename:'마음결.mp3'},href:'https://noastudio.ai.kr/noa-app/jukebox/download.php?key=x&receipt=paid',handlers:{},addEventListener(n,f){this.handlers[n]=f;},setAttribute(){},removeAttribute(){}};
  const writer={async write(v){calls.push('write');if(failWrite)throw Error('disk_full');assert.equal(v.length,content);},async close(){calls.push('close');},async abort(){calls.push('abort');}};
  const window={isSecureContext:true};
  if(supported)window.showSaveFilePicker=async o=>{options=o;calls.push('picker');if(pickError)throw pickError;return {createWritable:async()=>{calls.push('writable');return writer;}};};
  vm.runInNewContext(source,{window,document:{getElementById:id=>nodes[id]},AbortController,DOMException,fetch:async(url,opts)=>{calls.push('fetch');assert.equal(opts.credentials,'same-origin');return new Response(new Uint8Array(content),{status,headers:{'Content-Type':mime,'Content-Length':bytes}});}});
  return {nodes,calls,options:()=>options,click:()=>nodes['music-download-file'].handlers.click({preventDefault(){}})};
}
test('opens remembered picker before fetching, streams and closes only complete audio',async()=>{
 const x=fixture();await x.click();assert.deepEqual(x.calls,['picker','fetch','writable','write','close']);
 assert.equal(x.options().id,'noa-music-download');assert.equal(x.options().suggestedName,'마음결.mp3');assert.match(x.nodes['music-save-status'].textContent,/저장했어요/);
 const y=fixture();await y.click();assert.equal(y.options().id,x.options().id);
});
test('cancel picker sends no request and does not fall back to downloading',async()=>{
 const x=fixture({pickError:new DOMException('cancel','AbortError')});await x.click();assert.deepEqual(x.calls,['picker']);assert.equal(x.nodes['music-save-fallback'].hidden,true);
});
test('login HTML or an error cannot overwrite the selected file',async()=>{
 for(const opts of [{mime:'text/html'},{status:403}]){const x=fixture(opts);await x.click();assert.deepEqual(x.calls,['picker','fetch']);assert.equal(x.nodes['music-save-fallback'].hidden,false);}
});
test('truncated audio and disk failure abort without committing',async()=>{
 for(const opts of [{bytes:4},{failWrite:true}]){const x=fixture(opts);await x.click();assert.ok(x.calls.includes('abort'));assert.ok(!x.calls.includes('close'));}
});
test('unsupported browsers retain normal authenticated download',()=>{
 const x=fixture({supported:false});assert.equal(x.nodes['music-download-file'].handlers.click,undefined);assert.match(x.nodes['music-save-help'].textContent,/다운로드 설정/);
});
test('repeated clicks while picker is open dispatch one request',async()=>{
 const x=fixture();await Promise.all([x.click(),x.click()]);assert.equal(x.calls.filter(v=>v==='picker').length,1);assert.equal(x.calls.filter(v=>v==='fetch').length,1);
});
