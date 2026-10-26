const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const code=fs.readFileSync('deploy/noa-launch.js','utf8');
function visit(path,{installed=true,referrer='',saved=false,storageBlocked=false}={}){
 const url=new URL(path,'https://noastudio.ai.kr'),state={redirect:null,registered:false,saved};
 const context={URLSearchParams,window:{matchMedia:()=>({matches:installed})},navigator:{serviceWorker:{register(path,options){state.registered={path,options};return Promise.resolve();}}},document:{referrer},location:{pathname:url.pathname,search:url.search,hash:url.hash,replace(path){state.redirect=path;}},sessionStorage:{getItem(){if(storageBlocked)throw Error('unavailable');return state.saved?'1':null;},setItem(){state.saved=true;}}};
 vm.runInNewContext(code,context);return state;
}
test('new install starts at home without changing existing app identity',()=>{const m=JSON.parse(fs.readFileSync('deploy/noa-manifest.json'));assert.equal(m.start_url,'/');assert.equal(m.id,'/noa-music.php');assert.equal(m.scope,'/');});
test('old standalone launch and its login redirect open home',()=>{for(const path of ['/noa-music.php','/bbs/login.php?url=%2Fnoa-music.php','/noa-login.php?url=%2Fnoa-music.php'])assert.equal(visit(path).redirect,'/');});
test('normal browser and deliberate music navigation remain intact',()=>{for(const options of [{installed:false},{referrer:'https://noastudio.ai.kr/'},{saved:true},{storageBlocked:true}])assert.equal(visit('/noa-music.php',options).redirect,null);});
test('song deep links, genre links and other login destinations remain intact',()=>{for(const path of ['/noa-music.php?track=abc','/noa-music.php?genre=kpop-original','/noa-music.php#songs','/bbs/login.php?url=%2Fnoa-youtube.php','/noa-login.php?url=%2Fnoa-youtube.php','/'])assert.equal(visit(path).redirect,null);});
test('home updates the existing no-cache service worker and offline retry points home',()=>{const s=visit('/');assert.equal(s.registered.path,'/noa-sw.js');assert.equal(s.registered.options.updateViaCache,'none');const sw=fs.readFileSync('deploy/noa-sw.js','utf8');assert(sw.includes('href="/"'));assert(!sw.includes('/noa-music.php'));});
