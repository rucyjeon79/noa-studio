/* Shared AInoa voice: local composition, verified facts, no paid AI calls. */
(function(scope){'use strict';
const seasons=[['겨울','겨울의 여백을 닮은','겨울 노래가 생각나는'],['봄','봄의 설렘을 담은','봄 노래가 생각나는'],['여름','여름의 리듬을 닮은','여름 노래가 생각나는'],['가을','가을의 여운을 담은','가을 노래가 생각나는']];
const moods=['테이크 유어 타임. 쉼표도 음악의 일부니까요.','오늘은 마음의 볼륨을 한 칸만 낮춰볼까요? 어 리틀 피스.','낫 배드. 완벽하지 않은 하루에도 좋은 한 소절은 있죠.','저라면 걱정은 잠깐 사이드 비로 넘겨둘래요.','스몰 스텝. 작은 리듬도 모이면 한 곡이 되니까요.','가끔은 계획에 없는 쉼표가 제일 멋져요. 저스트 라이크 재즈.'];
const sayings=['천 리 길도 한 걸음부터. 오늘은 딱 한 박자만 가봐요.','시작이 반이라는 말, 오늘의 첫 소절에 붙여둘까요?','급할수록 돌아가라는 말처럼, 잠깐 숨을 고르는 것도 방법이에요.'];
const times={dawn:['고요한 새벽','하루가 시작되기 전 새벽','잠시 숨을 고르는 새벽'],morning:['새로운 아침','하루를 여는 아침','천천히 기지개를 켜는 아침'],day:['하루 한가운데','잠깐 쉬어 갈 오후','하루의 리듬을 이어 가는 시간'],evening:['하루를 마무리하는 저녁','여운을 나누기 좋은 저녁','잠시 돌아보는 저녁'],night:['차분한 밤','오늘을 접어 두는 밤','한 곡 더 생각나는 밤']};
function compose(text,{date=new Date(),title='',index=0,name='',practical=false}={}){
 if(practical)return String(text);
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',month:'numeric',hour:'numeric',hourCycle:'h23'}).formatToParts(date),part=k=>Number(parts.find(p=>p.type===k).value),month=part('month'),hour=part('hour');
 const season=seasons[Math.floor(month%12/3)],time=times[hour<6?'dawn':hour<12?'morning':hour<18?'day':hour<21?'evening':'night'];
 const opening=[`${season[1]} ${time[index%3]}, 작은 소식이 있어요.`,`${time[index%3]}, ${season[0]}의 여백에 헬로, 하고 인사를 놓아둘게요.`,`${season[2]} ${time[index%3]}, 함께해 줘서 반가워요.`][Math.floor(index/3)%3];
 const feeling=title?['「'+title+'」를 만났네요. 테이크 유어 타임. 각자의 속도로 들어요.','「'+title+'」와 함께하는 순간에 제 소식도 놓아둘게요.','「'+title+'」를 만난 이 페이지에서 잠깐 이야기 나눠요.'][index%3]:moods[Math.floor(index/9)%moods.length];
 const saying=index%3===1?' '+sayings[Math.floor(index/3)%sayings.length]:'';
 return (name?name+'님, ':'')+opening+' '+feeling+saying+'\n'+String(text);
}
function emptyStatus(text){return /(?:등록된|표시할|검색된|일치하는).*(?:없습니다|없어요)/.test(text);}
if(typeof module==='object'&&module.exports)module.exports={compose,emptyStatus};
if(!scope.document||scope.NoaVoice)return;
const parentVoice=(()=>{try{return scope.parent!==scope?scope.parent.NoaVoice:null;}catch{return null;}})();
const doc=scope.document,read=k=>{try{return sessionStorage.getItem(k);}catch{return null;}},write=(k,v)=>{try{sessionStorage.setItem(k,v);}catch{}};
let counter=Number(read('noa-voice-sequence')||0),account=null,currentTrack=null,active=null,queue=[],timer=null,mounted=false,ownChange=false;
const recent=new Map();
function readable(text){return String(text||'').trim().replace(/했습니다\./g,'했어요.').replace(/되었습니다\./g,'됐어요.').replace(/합니다\./g,'해요.').replace(/됩니다\./g,'돼요.').replace(/있습니다\./g,'있어요.').replace(/없습니다\./g,'없어요.');}
function say(text,options={}){
 if(parentVoice)return parentVoice.say(text,options);
 text=readable(text);if(!text)return;
 const key=options.key||text,now=Date.now();if(!options.force&&now-(recent.get(key)||0)<4000)return;recent.set(key,now);if(recent.size>200)recent.delete(recent.keys().next().value);
 options={...options,sticky:options.requireAcknowledgement===true};
 const item={text,options};if(options.key){const i=queue.findIndex(x=>x.options.key===options.key);if(i>=0)queue.splice(i,1);}
 if(options.priority&&active){if(active.options.requireAcknowledgement&&active.options.key!==options.key)queue.unshift(active);queue.unshift(item);close(false);}else{queue.push(item);render();}
}
function close(next=true,ack=false){if(ack)try{sessionStorage.removeItem('noa-voice-redirect');}catch{}clearTimeout(timer);active=null;const tip=doc.querySelector('#noa-ainoa .ainoa-tip');if(tip)tip.hidden=true;if(next||queue.length)render();}
function place(){const root=doc.getElementById('noa-ainoa'),modal=[...doc.querySelectorAll('dialog[open]')].at(-1);if(root&&root.parentElement!==(modal||doc.body))(modal||doc.body).append(root);}
function render(){
 place();if(active||!queue.length||doc.hidden)return;const tip=doc.querySelector('#noa-ainoa .ainoa-tip');if(!tip)return;
 active=queue.shift();ownChange=true;tip.replaceChildren();tip.classList.add('ainoa-message');tip.setAttribute('aria-live','polite');tip.setAttribute('aria-atomic','true');
 const label=doc.createElement('strong');label.textContent='AInoa';const text=doc.createElement('p');
 text.textContent=compose(active.text,{index:counter++,name:active.options.name||'',title:currentTrack?.title||'',practical:active.options.key!=='welcome'});write('noa-voice-sequence',String(counter));
 const actions=doc.createElement('div');actions.className='ainoa-message-actions';
 if(active.options.href){try{const url=new URL(active.options.href,location.origin);if(url.origin===location.origin){const a=doc.createElement('a');a.href=url.pathname+url.search+url.hash;a.textContent=active.options.linkLabel||'소식 보기';actions.append(a);}}catch{}}
 const button=doc.createElement('button');button.type='button';button.setAttribute('aria-label','AInoa 말풍선 닫기');button.onclick=()=>close(true,true);
 if(active.options.requireAcknowledgement){button.textContent='확인했어요';actions.append(button);}else{button.textContent='×';button.className='ainoa-message-dismiss';tip.append(button);}
 tip.append(label,text);if(actions.childElementCount)tip.append(actions);tip.hidden=false;ownChange=false;
 // Only explicit operational acknowledgement stays open. Greetings and notices expire.
 if(!active.options.requireAcknowledgement)timer=setTimeout(()=>close(),Math.max(6000,Math.min(10000,text.textContent.length*45)));
}
function condition(node){say(node.dataset.noaCondition,{priority:true,sticky:true,force:true,key:'access-condition',href:/로그인/.test(node.dataset.noaCondition)?'/noa-login.php':'/noa-my.php',linkLabel:/로그인/.test(node.dataset.noaCondition)?'로그인':'MY에서 확인'});}
doc.addEventListener('click',e=>{const node=e.target.closest?.('[data-noa-condition]');if(!node)return;e.preventDefault();e.stopImmediatePropagation();condition(node);},true);
doc.addEventListener('keydown',e=>{if(!['Enter',' '].includes(e.key))return;const node=e.target.closest?.('[data-noa-condition]');if(node){e.preventDefault();e.stopImmediatePropagation();condition(node);}},true);
scope.addEventListener('noa-track-selected',e=>{currentTrack=e.detail?.record||null;});
scope.addEventListener('noa-notice',e=>say(e.detail?.text,e.detail||{}));
// Preserve native confirmation/prompt behavior. Nonblocking alerts survive redirects via one-shot storage.
scope.alert=text=>{write('noa-voice-redirect',JSON.stringify({text:String(text),at:Date.now()}));say(text,{priority:true,sticky:true,key:'pending-alert'});};
const statusSelector='[role="status"],[role="alert"],.noa-toast,.toast,.alert-danger,.alert-success,.alert-warning';
const seen=new WeakMap();let scheduled=false;
function markAccess(){
 let caps=account?.capabilities;try{caps=caps||JSON.parse(doc.getElementById('noa-access')?.textContent||'null');}catch{}if(!caps)return;
 for(const a of doc.querySelectorAll('a[href]')){if(a.closest('#noa-ainoa'))continue;let url;try{url=new URL(a.href,location.href);}catch{continue;}if(url.origin!==location.origin)continue;
 const path=url.pathname,need=path==='/noa-catalog.php'?'music':['/noa-music.php','/noa-music-download.php','/noa-youtube.php','/noa-world.php','/noa-my.php','/noa-settings.php','/noa-notifications.php','/noa-membership.php','/noa-subscription.php'].includes(path)?'member':path==='/noa-creator.php'?'creator':null;
 if(need&&!caps[need]){a.removeAttribute('href');a.tabIndex=0;a.setAttribute('role','button');a.setAttribute('aria-disabled','true');a.dataset.noaCondition=need==='music'?'음원은 이용 기간이 남은 VIP회원·VIP 크리에이터가 들을 수 있어요. MY에서 이용권을 확인해 주세요.':need==='creator'?'창작자·VIP 크리에이터가 이용할 수 있어요. 계정 자격을 확인해 주세요.':'로그인한 회원이 이용할 수 있어요. 먼저 로그인해 주세요.';}
 }
}
function scan(){scheduled=false;markAccess();render();for(const node of doc.querySelectorAll(statusSelector)){
 if(node.closest('.ainoa-tip,.ainoa-admin-dialog')||node.matches('.ainoa-answer')||node.closest('[hidden]'))continue;
 const text=node.textContent.trim();if(!text||emptyStatus(text)||text===seen.get(node)||!node.getClientRects().length)continue;seen.set(node,text);
 // Dynamic operational notices only; progress numbers and empty-state copy are not repeated as alerts.
 if(node.matches('[role="alert"],.noa-toast,.toast,.alert-danger,.alert-success,.alert-warning')||/저장|실패|못했|오류|확인해|완료|차감|켜|껐|연결|전달|등록|삭제|필요|부족|지연/.test(text))say(text,{key:node.id||text,requireAcknowledgement:node.dataset.noaRequiredAck==='true'});
}}
function schedule(){if(scheduled)return;scheduled=true;setTimeout(scan,150);}
function facts(d){if(!d.member)return '지금은 비로그인 상태예요. 로그인하면 구독 상태와 남은 기간, 포인트를 함께 알려드릴게요.';
 const days=d.remainingDays===null?'잔여일은 '+(d.subscription==='확인 중'?'확인 중이에요.':'등록된 종료일이 없어 안내하기 어려워요.'):('남은 기간은 '+d.remainingDays+'일이에요.');
 return '현재 '+d.subscription+'이에요. '+days+' '+(Number.isSafeInteger(d.balance)?'잔여 포인트는 '+d.balance.toLocaleString('ko-KR')+'P예요.':'잔여 포인트를 확인하지 못했어요.');}
async function welcome(){
 try{const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),10000);let d;try{const r=await fetch('/noa-ainoa.php?action=welcome',{credentials:'same-origin',cache:'no-store',signal:abort.signal});if(!r.ok)throw Error();d=await r.json();if(!d.ok)throw Error();}finally{clearTimeout(timeout);}account=d;markAccess();
 const key='noa-welcome:'+d.accountKey,last=Number(read(key)||0),now=Date.now();
 if(now-last>30*60*1000){write(key,String(now));say(facts(d),{name:d.displayName||'방문자',priority:active?.options.key!=='pending-alert',sticky:true,key:'welcome'});}else write(key,String(now));
 scope.dispatchEvent(new CustomEvent('noa-voice-ready',{detail:{member:d.member,accountKey:d.accountKey}}));
 }catch{if(!read('noa-welcome-failed')){write('noa-welcome-failed','1');say('계정 정보를 잠시 불러오지 못했어요. 구독 상태·잔여일·포인트는 MY에서 다시 확인해 주세요.',{name:'방문자',sticky:true,key:'welcome-error'});}}
}
function boot(){if(mounted)return;mounted=true;if(location.pathname.startsWith('/adm/'))doc.documentElement.dataset.noaVoiceAdmin='true';if(parentVoice)doc.documentElement.dataset.noaVoiceEmbedded='true';
 new MutationObserver(records=>{if(ownChange)return;if(records.some(r=>!r.target.closest?.('.ainoa-tip')))schedule();}).observe(doc.body,{subtree:true,childList:true,characterData:true});
 try{const carried=JSON.parse(read('noa-voice-redirect')||'null');sessionStorage.removeItem('noa-voice-redirect');if(carried&&Date.now()-carried.at<30000)say(carried.text,{sticky:true,priority:true,key:'pending-alert'});}catch{}
 schedule();if(!parentVoice)void welcome();
}
doc.addEventListener('close',e=>{if(e.target.matches?.('dialog')&&e.target.contains(doc.getElementById('noa-ainoa')))doc.body.append(doc.getElementById('noa-ainoa'));},true);
doc.addEventListener('invalid',e=>{if(e.target.validationMessage){e.preventDefault();say(e.target.validationMessage,{priority:true,requireAcknowledgement:true,key:'form-validation'});}},true);
scope.addEventListener('pageshow',e=>{if(e.persisted){close(false);void welcome();}});
scope.NoaVoice={say,compose,getAccount:()=>parentVoice?parentVoice.getAccount():account};if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
doc.addEventListener('visibilitychange',()=>{if(!doc.hidden)render();});
})(typeof window==='undefined'?globalThis:window);
