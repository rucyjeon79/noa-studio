(()=>{'use strict';
const $=id=>document.getElementById(id),fmt=n=>Number(n).toLocaleString('ko-KR'),el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const errors={login_required:'로그인 후 포인트권을 구매할 수 있어요.',payment_not_ready:'카드·카카오페이 결제를 준비 중이에요.',payment_configuration_changed:'결제 설정이 바뀌었어요. 구매 내역에서 상태를 다시 확인해 주세요.',order_not_found:'이 계정의 구매 내역을 찾지 못했어요.',order_expired:'결제 시간이 지났어요. 포인트권을 다시 선택해 주세요.',payment_amount_mismatch:'주문 금액을 확인하지 못해 충전을 멈췄어요.',purchase_conflict:'진행 중인 주문을 먼저 확인해 주세요.',payment_verification_pending:'결제 결과를 확인하고 있어요. 다시 결제하지 말고 구매 내역의 상태 확인을 눌러 주세요.',csrf_required:'로그인 상태를 다시 확인해 주세요.'};
const cartKey='noa-point-cart-v1',intentKey='noa-toss-cart-intent',requestKey='noa-toss-create-v1';
const editions={p1000:'FIRST TRACK',p3000:'STUDIO VOICE',p5000:'DEEP MELODY',p10000:'LISTEN LONGER',p30000:'JAZZ MOMENT',p50000:'GRAND FINALE'};
let state,busy=false,retry=null,sdkPromise,cart=[];
try{const saved=JSON.parse(localStorage.getItem(cartKey)||'[]');if(Array.isArray(saved))cart=saved.filter(p=>p&&typeof p.productId==='string'&&Number.isInteger(p.quantity)&&p.quantity>=1&&p.quantity<=10).slice(0,6);}catch{}
try{const r=JSON.parse(sessionStorage.getItem(requestKey)||'null');if(r&&typeof r.requestId==='string'&&typeof r.signature==='string'&&Array.isArray(r.items))retry=r;}catch{}
function clearRequest(){retry=null;try{sessionStorage.removeItem(requestKey);}catch{}}
async function requestJSON(url,options={}){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);try{const r=await fetch(url,{...options,signal:controller.signal}),d=await r.json();if(!r.ok||!d.ok)throw Error(d.error||'payment_verification_pending');return d;}catch(e){if(e.name==='AbortError')throw Error('payment_verification_pending');throw e;}finally{clearTimeout(timer);}}
function cartItems(){return cart.filter(c=>state?.products.some(p=>p.id===c.productId)).map(c=>({...state.products.find(p=>p.id===c.productId),quantity:c.quantity}));}
function cartSignature(){return JSON.stringify(cart.map(p=>[p.productId,p.quantity]).sort((a,b)=>a[0].localeCompare(b[0])));}
function saveCart(){try{localStorage.setItem(cartKey,JSON.stringify(cart));}catch{}}
function changeCart(id,delta){
 if(busy)return;const p=state.products.find(p=>p.id===id);if(!p)return;
 const row=cart.find(p=>p.productId===id),next=(row?.quantity||0)+delta;
 if(next>10){notice('같은 금액권은 한 번에 10개까지 담을 수 있어요.',false);return;}
 if(next<=0)cart=cart.filter(p=>p.productId!==id);else if(row)row.quantity=next;else cart.push({productId:id,quantity:next});
 clearRequest();$('points-consent').checked=false;saveCart();renderCart();notice(delta>0?fmt(p.paidPoints)+'P 금액권을 카트에 담았어요.':'카트를 변경했어요.',false);
}
function totals(){return cartItems().reduce((a,p)=>{for(const k of ['priceWon','paidPoints','bonusPoints','totalPoints'])a[k]+=p[k]*p.quantity;a.quantity+=p.quantity;return a;},{priceWon:0,paidPoints:0,bonusPoints:0,totalPoints:0,quantity:0});}
function art(p,loading='lazy'){const img=el('img');img.src='/noa-assets/points-'+p.id+'.webp';img.alt='';img.width=768;img.height=512;img.loading=loading;img.decoding='async';return img;}
function button(text,label,action){const b=el('button',text);b.type='button';b.setAttribute('aria-label',label);b.disabled=busy;b.onclick=action;return b;}
function renderCart(){
 const holder=$('points-cart-items');holder.replaceChildren();const items=cartItems();
 if(!items.length){const empty=el('div');empty.className='np-cart-empty';empty.append(el('span','YOUR NEXT TRACK'),el('strong','어떤 음악으로 채워볼까요?'),el('p','마음에 드는 금액권을 담아주세요.'));holder.append(empty);}
 for(const p of items){const row=el('article');row.className='np-cart-item';row.dataset.productId=p.id;const copy=el('div');copy.className='np-cart-copy';copy.append(el('strong',fmt(p.paidPoints)+'P 금액권'),el('small',fmt(p.priceWon*p.quantity)+'원 · '+fmt(p.totalPoints*p.quantity)+'P 지급'));
 const qty=el('div');qty.className='np-quantity';const minus=button('−',fmt(p.paidPoints)+'P 수량 줄이기',()=>changeCart(p.id,-1));const count=el('output',String(p.quantity));count.setAttribute('aria-label',fmt(p.paidPoints)+'P 수량');const plus=button('+',fmt(p.paidPoints)+'P 수량 늘리기',()=>changeCart(p.id,1));plus.disabled=busy||p.quantity>=10;qty.append(minus,count,plus);
 const remove=button('삭제',fmt(p.paidPoints)+'P 카트에서 삭제',()=>changeCart(p.id,-p.quantity));remove.className='np-remove';copy.append(qty);row.append(art(p),copy,remove);holder.append(row);}
 const t=totals();$('points-cart-count').textContent=t.quantity;$('points-cart-lines').textContent=t.quantity+'개';summary();
}

function notice(text,speak=true){$('points-notice').textContent=text;if(speak)window.NoaVoice?.say?.(text,{key:'points-checkout'});}
async function post(action,body){return requestJSON('/noa-bridge/toss.php?action='+action,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Noa-CSRF':state.csrf},body:JSON.stringify(body)});}
function summary(){
 if(!state)return;const t=totals(),dl=$('points-summary');dl.replaceChildren();
 for(const[k,v]of [['결제 금액',fmt(t.priceWon)+'원'],['기본 포인트',fmt(t.paidPoints)+'P'],['추가 포인트','+'+fmt(t.bonusPoints)+'P'],['총 지급 포인트',fmt(t.totalPoints)+'P']])dl.append(el('dt',k),el('dd',v));
 const unresolved=!!pending&&!pending.failed,buy=$('points-buy');buy.disabled=busy||unresolved||!t.quantity||!state.member||!state.payment.ready||!$('points-consent').checked;
 buy.textContent=!t.quantity?'카트에 상품을 담아주세요':!state.member?'로그인 후 결제할 수 있어요':!state.payment.ready?'결제 준비 중':unresolved?'이전 결제 결과를 확인해 주세요':busy?'결제 확인 중':(state.payment.mode==='test'?'테스트 ':'')+fmt(t.priceWon)+'원 결제하기';
}
function render(){
 $('points-login').hidden=state.member;$('points-balance').textContent=state.member?'내 포인트 '+fmt(state.balance)+'P':'NOA STUDIO POINT STORE';
 const ids=new Set();cart=cart.filter(c=>state.products.some(p=>p.id===c.productId)&&!ids.has(c.productId)&&ids.add(c.productId));saveCart();
 const products=$('points-products');products.replaceChildren();for(const [i,p] of state.products.entries()){
 const card=el('article');card.className='noa-point-pack';card.dataset.productId=p.id;const image=el('div');image.className='np-pack-art';image.append(art(p,i<2?'eager':'lazy'));
 if(p.bonusPoints){const badge=el('span','+10%');badge.className='np-bonus-badge';image.append(badge);}
 const copy=el('div');copy.className='np-pack-copy';const edition=el('p',editions[p.id]||'NOA POINTS');edition.className='np-edition';const name=el('h3',fmt(p.paidPoints)+'P');const bonus=el('p',p.bonusPoints?'추가 '+fmt(p.bonusPoints)+'P · 총 '+fmt(p.totalPoints)+'P':'총 '+fmt(p.totalPoints)+'P 지급');bonus.className='np-pack-bonus';const price=el('p',fmt(p.priceWon)+'원');price.className='np-pack-price';const add=button('카트에 담기',fmt(p.paidPoints)+'P 카트에 담기',()=>changeCart(p.id,1));add.dataset.addProduct=p.id;const gift=el('a','선물하기');gift.className='noa-button';gift.href='/noa-gifts.php?product='+encodeURIComponent(p.id);copy.append(edition,name,bonus,price,add,gift);card.append(image,copy);products.append(card);}
 const orders=$('points-orders');orders.replaceChildren();for(const o of state.orders){const row=el('article');row.className='noa-point-order';const status={created:'승인 확인 전',paid:o.giftRecipient?'선물 결제 완료':'충전 완료',partially_canceled:'부분 취소',canceled:'결제 취소'}[o.state]||'확인 중';const copy=el('div');copy.append(el('strong',fmt(o.priceWon)+'원 · '+(o.mode==='test'?'테스트 · ':'')+status),el('p',o.state==='created'?'지급 예정 '+fmt(o.totalPoints)+'P · 아직 지급되지 않았어요.':o.mode==='test'?'운영 지급 0P · 테스트 내역':fmt(o.totalPoints-o.paidReversed-o.bonusReversed)+'P · 취소 반영 후 지급 포인트'));if(o.items?.length)copy.append(el('small',o.items.map(p=>fmt(p.paidPoints)+'P × '+p.quantity).join(' / ')));row.append(copy);if(o.resumeGift&&o.mode==='live'&&o.state==='paid'){const link=el('a','선물 확인');link.href='/noa-gifts.php?resume='+encodeURIComponent(o.id);row.append(link);}if(o.state!=='canceled'){const b=button('상태 확인','구매 상태 확인',()=>run(async()=>{await post('refresh',{id:o.id});await load(false);notice('구매 상태를 다시 확인했어요.');}));row.append(b);}orders.append(row);}if(!state.orders.length)orders.append(el('p',state.member?'구매한 포인트권이 아직 없어요. 첫 번째 음악의 시간을 골라보세요.':'로그인하면 구매 내역을 확인할 수 있어요.'));renderCart();
}
async function load(show=true){state=await requestJSON('/noa-bridge/toss.php',{credentials:'same-origin',cache:'no-store'});render();if(show)notice(!state.member?errors.login_required:!state.payment.ready?errors.payment_not_ready:state.payment.mode==='test'?'테스트 결제입니다. 실제 청구와 운영 포인트 지급은 없어요.':'10,000P 이상 금액권마다 10%를 더 드려요.',false);}
function controls(){summary();document.querySelectorAll('.noa-points-page input,.noa-point-pack button,#points-cart-items button,#points-orders button').forEach(e=>e.disabled=busy);retryButton.disabled=busy;if(!busy)renderCart();pendingRetry();}
async function run(fn){if(busy)return;busy=true;controls();try{await fn();}catch(e){notice(errors[e.message]||'결제를 완료하지 못했어요. 구매 내역에서 상태를 확인해 주세요.');}finally{busy=false;controls();}}
function sdk(){if(window.TossPayments)return Promise.resolve();if(!sdkPromise)sdkPromise=new Promise((resolve,reject)=>{const s=el('script');s.src='https://js.tosspayments.com/v2/standard';const fail=()=>{clearTimeout(timer);sdkPromise=null;s.remove();reject(Error('payment_not_ready'));};const timer=setTimeout(fail,15000);s.onload=()=>{clearTimeout(timer);window.TossPayments?resolve():fail();};s.onerror=fail;document.head.append(s);});return sdkPromise;}
const pendingKey='noa-toss-pending';let pending;
try{const q=new URLSearchParams(location.search);if(q.get('result')==='success'){pending={id:q.get('id'),paymentKey:q.get('paymentKey'),orderId:q.get('orderId'),amount:Number(q.get('amount'))};sessionStorage.setItem(pendingKey,JSON.stringify(pending));history.replaceState(null,'','/noa-points.php');}else if(q.get('result')==='fail'){sessionStorage.removeItem(pendingKey);history.replaceState(null,'','/noa-points.php');pending={failed:true};}else pending=JSON.parse(sessionStorage.getItem(pendingKey)||'null');}catch{}
async function resume(){if(!pending)return;if(pending.failed){notice('결제가 완료되지 않았어요. 포인트는 지급되지 않았습니다.');return;}if(!state.member)return;if(pending.orderId!=='NOA_'+String(pending.id).replaceAll('-','')||!Number.isSafeInteger(pending.amount))throw Error('payment_amount_mismatch');const r=await post('confirm',pending);sessionStorage.removeItem(pendingKey);pending=null;try{const intent=JSON.parse(sessionStorage.getItem(intentKey)||'null');if(r.order.state==='paid'&&intent?.id===r.order.id&&intent.signature===cartSignature()){cart=[];saveCart();}sessionStorage.removeItem(intentKey);}catch{}clearRequest();await load(false);const o=r.order;if(o.resumeGift&&o.mode==='live'&&o.state==='paid'){location.assign('/noa-gifts.php?resume='+encodeURIComponent(o.id));return;}notice(o.state==='paid'?(o.mode==='test'?'테스트 승인이 완료됐어요. 운영 포인트는 지급하지 않았어요.':o.giftRecipient?'선물을 보냈어요. MY의 보낸 선물함에서 확인하세요.':fmt(o.totalPoints)+'P가 충전됐어요. 좋은 음악과 함께해요.'):'구매 내역에서 최신 결제 상태를 확인해 주세요.');}
const retryButton=el('button','결제 결과 다시 확인');retryButton.type='button';retryButton.hidden=true;retryButton.onclick=()=>run(resume);$('points-notice').after(retryButton);
function pendingRetry(){retryButton.hidden=!pending||pending.failed||!state?.member;}
const form=$('points-form');form.onsubmit=e=>{e.preventDefault();run(async()=>{
 if(!state.member||!state.payment.ready||!$('points-consent').checked||!totals().quantity||(pending&&!pending.failed))return;
 const signature=cartSignature(),items=cart.map(p=>({productId:p.productId,quantity:p.quantity}));await sdk();
 if(!retry||retry.signature!==signature)retry={requestId:crypto.randomUUID(),items,confirmed:true,signature};
 try{sessionStorage.setItem(requestKey,JSON.stringify(retry));}catch{}
 const d=await post('create',{requestId:retry.requestId,items:retry.items,confirmed:true});
 if(d.order.state!=='created'){await load(false);notice('이미 처리된 주문이에요. 구매 내역을 확인해 주세요.');clearRequest();return;}
 sessionStorage.setItem(intentKey,JSON.stringify({id:d.order.id,signature}));
 const method=form.querySelector('input[name=method]:checked')?.value,origin=location.origin;
 await window.TossPayments(d.clientKey).payment({customerKey:d.customerKey}).requestPayment({method:'CARD',amount:{currency:'KRW',value:d.order.priceWon},orderId:d.order.orderId,orderName:'NOA 포인트권 '+items.reduce((n,p)=>n+p.quantity,0)+'개',successUrl:origin+'/noa-points.php?result=success&id='+d.order.id,failUrl:origin+'/noa-points.php?result=fail',card:method==='KAKAOPAY'?{flowMode:'DIRECT',easyPay:'KAKAOPAY'}:{flowMode:'DEFAULT'}});
 });};
 $('points-consent').onchange=summary;
 load().then(()=>run(resume)).then(pendingRetry).catch(e=>notice(errors[e.message]||'포인트권을 불러오지 못했어요. 잠시 후 다시 확인해 주세요.'));
})();

