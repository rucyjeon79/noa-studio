(()=>{'use strict';
const $=id=>document.getElementById(id),app=$('browser-app');if(!app)return;
let state={},busy=false,refreshing=false,available=false,timer;
const pending=['queued','active','closing'];
const messages={disconnected:['연결 화면을 열어 Google 로그인을 진행하세요.','Google 연결을 시작하세요','아래 버튼을 누르면 로그인할 화면을 준비합니다.'],queued:['연결 화면을 준비하고 있습니다.','연결 화면 준비 중','준비가 끝나면 여기에 Google 로그인 화면이 나타납니다.'],active:['Google에 로그인한 뒤 Gemini와 Flow를 각각 확인해 주세요.','첫 화면을 불러오는 중','브라우저가 준비되는 동안 잠시 기다려 주세요.'],closing:['연결 정보를 저장하고 있습니다.','연결 저장 중','저장이 끝날 때까지 잠시 기다려 주세요.'],saved:['연결 정보를 저장했습니다.','연결 저장 완료','필요할 때 연결 화면을 다시 열 수 있습니다.'],closed:['연결을 닫았습니다.','연결 종료','다시 연결하려면 아래 버튼을 눌러 주세요.'],expired:['연결 시간이 만료되었습니다.','연결 시간 만료','연결 화면을 다시 열어 주세요.'],connection_lost:['연결 응답이 끊겼습니다.','연결 응답 없음','연결을 닫은 뒤 다시 열어 주세요.'],failed:['연결 화면을 열지 못했습니다.','연결 확인 필요','잠시 후 연결 화면을 다시 열어 주세요.']};
function feedback(text=''){$('browser-feedback').textContent=text;$('browser-feedback').hidden=!text;}
async function api(body){
 const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),12000);
 try{const r=await fetch('/noa-browser-connect.php?api=1',{credentials:'same-origin',cache:'no-store',signal:abort.signal,...(body?{method:'POST',headers:{'Content-Type':'application/json','X-NOA-CSRF':app.dataset.csrf},body:JSON.stringify(body)}:{})});const v=await r.json();if(!r.ok)throw Error(v.error||'connection_failed');return v;}finally{clearTimeout(timeout);}
}
function draw(v){
 state=v;app.dataset.state=v.state||'loading';
 const m=messages[v.state]||['연결 상태를 확인하고 있습니다.','연결 상태 확인 중','잠시만 기다려 주세요.'];
 const delayed=v.state==='queued'&&Number.isFinite(v.expiresAt)&&v.expiresAt*1000-Date.now()<18*60*1000;
 $('browser-status').textContent=delayed?'연결 준비가 지연되고 있습니다. 상태를 다시 확인하거나 연결을 취소할 수 있습니다.':m[0];
 $('browser-placeholder-title').textContent=delayed?'연결 준비 지연':m[1];
 $('browser-placeholder-help').textContent=delayed?'아직 로그인 화면이 도착하지 않았습니다. 준비가 끝나면 자동으로 표시됩니다.':m[2];
 const hasFrame=v.state==='active'&&!!v.frame,ready=available&&!busy&&hasFrame&&v.inputReady;
 const screen=$('browser-screen');screen.hidden=!hasFrame;
 if(hasFrame){if(screen.getAttribute('src')!==v.frame)screen.src=v.frame;}else screen.removeAttribute('src');
 $('browser-placeholder').hidden=hasFrame;
 $('browser-stage').setAttribute('aria-busy',String(!v.state||v.state==='queued'||v.state==='closing'||v.state==='active'&&!hasFrame));
 $('browser-url').textContent=hasFrame?v.url||'':'';$('browser-url').hidden=!hasFrame||!v.url;
 $('browser-interaction').hidden=!hasFrame;
 for(const b of app.querySelectorAll('[data-target],[data-key],[data-scroll],#browser-type button,#browser-text,#browser-save'))b.disabled=!ready;
 $('browser-open').hidden=pending.includes(v.state)||v.state==='connection_lost';$('browser-open').disabled=busy||!available;
 $('browser-save').hidden=!hasFrame;
 $('browser-close').hidden=!pending.includes(v.state)&&v.state!=='connection_lost';$('browser-close').disabled=busy||!available;
 $('browser-close').textContent=v.state==='queued'?'연결 취소':'저장 없이 닫기';
 $('browser-refresh').hidden=available&&!delayed;$('browser-refresh').disabled=busy||refreshing;
}
async function refresh(){
 clearTimeout(timer);if(refreshing||busy||document.hidden)return;refreshing=true;
 try{const next=await api();if(!busy){available=true;draw(next);}}
 catch{available=false;draw(state);feedback('연결 상태를 불러오지 못했습니다. 상태 다시 확인을 눌러 주세요.');}
 finally{refreshing=false;$('browser-refresh').disabled=busy;if(pending.includes(state.state))timer=setTimeout(refresh,3000);}
}
async function send(command,extra={}){
 if(busy||!available)return;busy=true;feedback();draw(state);
 try{await api({command,id:state.id,frameSeq:state.frameSeq,...extra});}
 catch(e){feedback(e.message==='browser_frame_changed'?'화면이 바뀌었습니다. 새 화면에서 다시 눌러 주세요.':'연결 요청을 확인하지 못했습니다. 상태를 확인한 뒤 다시 시도해 주세요.');}
 finally{busy=false;await refresh();}
}
$('browser-refresh').onclick=()=>{feedback();refresh();};
$('browser-open').onclick=()=>send('open');$('browser-save').onclick=()=>send('save');$('browser-close').onclick=()=>send('close');
$('browser-screen').onclick=e=>{if(!available||!state.inputReady||!state.frame)return;const r=e.currentTarget.getBoundingClientRect();send('input',{event:{kind:'click',x:Math.max(0,Math.min(1279,Math.floor((e.clientX-r.left)*1280/r.width))),y:Math.max(0,Math.min(899,Math.floor((e.clientY-r.top)*900/r.height)))}});};
for(const b of app.querySelectorAll('[data-target]'))b.onclick=()=>send('input',{event:{kind:'navigate',target:b.dataset.target}});
for(const b of app.querySelectorAll('[data-key]'))b.onclick=()=>send('input',{event:{kind:'key',key:b.dataset.key}});
for(const b of app.querySelectorAll('[data-scroll]'))b.onclick=()=>send('input',{event:{kind:'scroll',y:Number(b.dataset.scroll)}});
$('browser-type').onsubmit=e=>{e.preventDefault();if(!available||busy||!state.inputReady||!state.frame)return;const text=$('browser-text').value;if(!text)return;$('browser-text').value='';send('input',{event:{kind:'type',text}});};
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();else clearTimeout(timer);});refresh();
})();
