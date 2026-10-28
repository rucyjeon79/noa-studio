/* Desktop companion: one real account summary and the existing AInoa instance. */
(()=>{'use strict';
if(window.top!==window.self||/^\/(?:adm|noa-app)\//.test(location.pathname)||document.getElementById('noa-desktop'))return;
let context={access:{member:false}};try{context=JSON.parse(document.getElementById('noa-desktop-context')?.textContent||'{}');}catch{}
const html=document.documentElement,wide=matchMedia('(min-width:1440px) and (min-height:640px)');let rail,host,balance,subscription,notice,memberBox,guestBox,latest=null,active=false;
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
function link(text,url,cls){const a=el('a',text,cls);a.href=url;return a;}
function account(data){latest=data;if(!rail)return;const logged=!!data.member;memberBox.hidden=!logged;guestBox.hidden=logged;
 if(!logged){balance.textContent='—';subscription.textContent='';return;}
 balance.textContent=Number.isFinite(data.balance)?data.balance.toLocaleString('ko-KR')+'P':'확인 필요';
 subscription.textContent=data.grant?.status==='active'&&Number(data.remainingDays)>0?'구독 중 · '+Number(data.remainingDays)+'일 남음':'구독·포인트 내역';notice.textContent='';
}
window.addEventListener('noa-membership-status',e=>account(e.detail));
window.addEventListener('noa-membership-error',()=>{if(notice)notice.textContent='계정 연결을 확인하지 못했어요. MY에서 다시 확인해 주세요.';});
function build(){
 rail=el('aside',undefined,'noa-desktop');rail.id='noa-desktop';rail.hidden=true;rail.setAttribute('aria-label','MY와 AInoa');
 const my=el('section',undefined,'noa-desktop-my'),head=el('header');head.append(el('h2','MY'),link('전체 보기','/noa-my.php'));my.append(head);
 memberBox=el('div');memberBox.hidden=!context.access?.member;
 const identity=link('','/noa-my.php','noa-desktop-identity'),badge=window.NoaMemberBadges?.badge(context.badge,true);if(badge)identity.append(badge);
 const who=el('span'),name=el('strong',context.displayName||'나의 계정'),rank=el('small',context.access?.name||'회원');who.append(name,rank);identity.append(who);memberBox.append(identity);
 const wallet=link('','/noa-subscription.php','noa-desktop-wallet');wallet.append(el('span','보유 포인트'));balance=el('strong','확인 중');wallet.append(balance);subscription=link('구독·포인트 내역','/noa-subscription.php','noa-desktop-subscription');memberBox.append(wallet,subscription);
 const nav=el('nav',undefined,'noa-desktop-menu');nav.setAttribute('aria-label','나의 메뉴');const activity=link('내 활동','/noa-notifications.php'),count=el('span',undefined,'nnt-count');count.dataset.nntCount='';count.hidden=true;activity.append(count);nav.append(activity,link('최근 재생','/noa-my.php#my-recent'));
 if(context.access?.creator)nav.append(link('내 채널 관리','/noa-channel-workspace.php'));
 nav.append(link('나의 설정','/noa-settings.php'));if(context.access?.admin)nav.append(link('홈페이지 관리','/noa-library.php'));memberBox.append(nav);
 guestBox=el('div',undefined,'noa-desktop-guest');guestBox.hidden=!!context.access?.member;guestBox.append(el('p','나의 음악과 도착한 소식을 한곳에서.'),link('로그인','/bbs/login.php?url=%2Fnoa-my.php','noa-desktop-login'));
 notice=el('p','','noa-desktop-status');notice.setAttribute('role','status');my.append(memberBox,guestBox,notice);
 const ai=el('section',undefined,'noa-desktop-ai'),aiHead=el('header'),portrait=el('img');portrait.src='/noa-assets/ainoa-symbol.png?v=20261026-portrait-1';portrait.alt='';portrait.width=48;portrait.height=48;
 const caption=el('div');caption.append(el('h2','AInoa'),el('span','음악과 이야기, 곁에 둘게요.'));aiHead.append(portrait,caption);host=el('div');host.id='noa-desktop-ainoa';ai.append(aiHead,host);rail.append(my,ai);document.body.append(rail);
 if(latest)account(latest);
}
function sync(){
 if(!window.NoaAInoa?.dock)return;const next=wide.matches&&!html.hasAttribute('data-noa-voice-embedded')&&!html.hasAttribute('data-noa-theme-only');
 if(next&&!rail)build();if(next===active)return;active=next;html.toggleAttribute('data-noa-desktop',active);rail.hidden=!active;
 window.NoaAInoa.dock(active?host:null);
 window.NoaAInoaAdmin?.dock(active?document.getElementById('noa-desktop-admin'):null);
}
function start(){sync();wide.addEventListener('change',sync);window.addEventListener('noa-ainoa-ready',sync);window.addEventListener('noa-membership-change',()=>{if(notice)notice.textContent='갱신 중';});
 const bar=document.getElementById('noa-account-bar');if(bar)new ResizeObserver(()=>html.style.setProperty('--noa-desktop-top',Math.ceil(bar.getBoundingClientRect().height)+'px')).observe(bar);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
