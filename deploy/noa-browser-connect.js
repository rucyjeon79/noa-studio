(()=>{'use strict';
const $=id=>document.getElementById(id),app=$('browser-app');if(!app)return;
const waiting=new Set(['queued','starting']),running=new Set(['queued','starting','active','closing']);
let state={},busy=false,refreshing=false,refreshAgain=false,timer;
const names={disconnected:'연결 화면을 열어 Google 로그인을 진행하세요.',queued:'연결 요청을 접수했습니다. 실행기를 준비하고 있습니다.',starting:'브라우저를 열고 첫 화면을 불러오고 있습니다.',active:'아래 화면에서 Google 로그인을 진행하세요.',closing:'연결 정보를 암호화해 N80에 저장하고 있습니다.',saved:'연결 정보를 N80에 저장했습니다.',closed:'연결을 닫았습니다.',expired:'연결 시간이 만료되었습니다. 다시 열어 주세요.',connection_lost:'연결 응답이 끊겼습니다. 닫은 뒤 다시 열어 주세요.',failed:'브라우저 연결을 확인하지 못했습니다. 다시 열어 주세요.'};
async function api(body){const r=await fetch('/noa-browser-connect.php?api=1',{credentials:'same-origin',cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json','X-NOA-CSRF':app.dataset.csrf},body:JSON.stringify(body)}:{})});const v=await r.json();if(!r.ok)throw Error(v.error||'connection_failed');return v;}
function draw(v){
 v={...v,state:v.phase||v.state};state=v;$('browser-status').textContent=names[v.state]||'연결 상태를 확인하고 있습니다.';$('browser-url').textContent=v.url||'';
 const screen=$('browser-screen');screen.hidden=!v.frame;if(v.frame){if(screen.getAttribute('src')!==v.frame)screen.src=v.frame;}else screen.removeAttribute('src');
 const preparing=$('browser-preparing');preparing.hidden=!waiting.has(v.state);preparing.dataset.stage=v.state==='queued'?'1':'2';
 $('browser-step-request').setAttribute('aria-current',v.state==='queued'?'step':'false');$('browser-step-start').setAttribute('aria-current',v.state==='starting'?'step':'false');
 $('browser-preparing-note').textContent=v.waitSeconds>=60?'준비가 지연되고 있습니다. 연결되는 대로 이 자리에 표시합니다.':'연결되면 이 자리에 브라우저 화면이 나타납니다.';
 $('browser-elapsed').textContent=Number.isInteger(v.waitSeconds)&&v.waitSeconds>0?v.waitSeconds+'초 경과':'';
 $('browser-input-controls').hidden=!v.frame;$('browser-type').hidden=!v.frame;
 for(const b of document.querySelectorAll('[data-target],[data-key],[data-scroll],#browser-type button,#browser-text,#browser-save'))b.disabled=busy||!v.inputReady;
 $('browser-open').disabled=busy||running.has(v.state);$('browser-close').disabled=busy||!(running.has(v.state)||v.state==='connection_lost');
}
async function refresh(){
 clearTimeout(timer);if(document.hidden)return;if(refreshing){refreshAgain=true;return;}refreshing=true;
 try{if(!busy)draw(await api());}catch{$('browser-status').textContent='연결 상태를 불러오지 못했습니다.';}
 finally{refreshing=false;if(refreshAgain){refreshAgain=false;void refresh();}else if(running.has(state.state))timer=setTimeout(refresh,3000);}
}
async function send(command,extra={}){if(busy)return;busy=true;draw(state);try{await api({command,id:state.id,frameSeq:state.frameSeq,...extra});}catch(e){$('browser-status').textContent=e.message==='browser_frame_changed'?'화면이 바뀌었습니다. 새 화면에서 다시 눌러 주세요.':'연결 요청을 확인하지 못했습니다.';}finally{busy=false;await refresh();}}
$('browser-open').onclick=()=>send('open');$('browser-save').onclick=()=>send('save');$('browser-close').onclick=()=>send('close');
$('browser-screen').onclick=e=>{if(!state.inputReady)return;const r=e.currentTarget.getBoundingClientRect();send('input',{event:{kind:'click',x:Math.min(1279,Math.floor((e.clientX-r.left)*1280/r.width)),y:Math.min(899,Math.floor((e.clientY-r.top)*900/r.height))}});};
for(const b of document.querySelectorAll('[data-target]'))b.onclick=()=>send('input',{event:{kind:'navigate',target:b.dataset.target}});
for(const b of document.querySelectorAll('[data-key]'))b.onclick=()=>send('input',{event:{kind:'key',key:b.dataset.key}});
for(const b of document.querySelectorAll('[data-scroll]'))b.onclick=()=>send('input',{event:{kind:'scroll',y:Number(b.dataset.scroll)}});
$('browser-type').onsubmit=e=>{e.preventDefault();if(!state.inputReady)return;const text=$('browser-text').value;$('browser-text').value='';send('input',{event:{kind:'type',text}});};
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});refresh();})();
