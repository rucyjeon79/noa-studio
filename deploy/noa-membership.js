(()=>{'use strict';const $=id=>document.getElementById(id),el=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};let state,busy=false,purchaseId=null,topupRetry=null;
const messages={aide_limit_reached:'이미 보좌관 2명이 임명되어 있습니다. 회장님 한 분당 정원은 2명입니다.',gift_not_allowed:'2~4레벨 회원에게 선물할 수 있습니다.',member_unavailable:'활동 중인 회원 아이디를 확인해 주세요.',appointment_denied:'이 등급을 임명할 권한이 없습니다.',appointment_target_invalid:'이 회원은 해당 직책으로 임명할 수 없습니다.',insufficient_points:'포인트가 부족합니다. 잔액과 차감 내역을 확인하세요.',policy_changed:'이용권 정책이 바뀌었습니다. 새로고침 후 다시 확인하세요.',revision_conflict:'설정이 바뀌었습니다. 최신 상태를 불러오세요.',purchase_busy_retry:'다른 요청을 처리 중입니다. 잠시 후 다시 확인하세요.',points_storage_not_ready:'포인트 저장소를 준비 중입니다. 차감하지 않았습니다.',membership_not_ready:'회원 정책을 준비 중입니다.',payment_purchase_disabled:'추가 구매의 결제 안내를 준비 중입니다.',csrf_required:'로그인 상태를 새로 확인해 주세요.',payment_reference_already_used:'이미 확인한 거래 번호입니다.',payment_amount_mismatch:'실제 결제 금액과 신청 금액이 다릅니다.',regular_or_creator_required:'이 이용권은 일반 회원용입니다. 현재 등급을 확인하세요.'};
function notice(t){$('membership-notice').textContent=t;}
async function read(){const r=await fetch('/noa-bridge/membership.php?action=admin',{credentials:'same-origin',cache:'no-store'}),d=await r.json();if(!r.ok||!d.ok||!d.member)throw Error('로그인 상태를 확인해 주세요.');return d;}
async function post(action,b){const c=new AbortController(),t=setTimeout(()=>c.abort(),20000);try{const r=await fetch('/noa-bridge/membership.php?action='+action,{method:'POST',credentials:'same-origin',cache:'no-store',signal:c.signal,headers:{'Content-Type':'application/json','X-NOA-CSRF':state.csrf},body:JSON.stringify(b)}),d=await r.json();if(!r.ok||!d.ok)throw Error(messages[d.error]||'처리 결과를 확인하지 못했습니다. 내역을 확인한 뒤 다시 시도하세요.');return d;}finally{clearTimeout(t);}}
function render(){if(!state)return;const normal=[2,3,4].includes(state.level),active=state.grant?.status==='active'&&state.remainingDays>0;
 $('membership-summary').textContent=state.name+' · '+state.balance.toLocaleString('ko-KR')+'P';$('membership-pending').textContent=state.pendingLogin?'로그인 100P 대기 · 첫 적립 활동 후 함께 지급':'오늘 로그인 보너스는 지급됐거나 대기 중이 아닙니다.';
 $('membership-until').textContent=active?'구독 중 · '+state.remainingDays+'일 남음 · '+new Date(state.grant.until*1000).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})+' 만료':'현재 활성 이용권이 없습니다.';
 $('membership-buy').disabled=busy||!normal||!state.enabled||!$('membership-confirm').checked;$('membership-auto').disabled=busy||!normal||!state.enabled;if(!busy)$('membership-auto').checked=!!state.autoRenew.values.enabled;
 $('membership-balance').textContent=state.balance.toLocaleString('ko-KR')+'P';const ledger=$('membership-ledger');ledger.replaceChildren();for(const row of state.ledger){const li=el('li',''),label=el('span',row.po_content);label.append(el('small',row.po_datetime));li.append(label,el('strong',(Number(row.po_point)>0?'+':'')+Number(row.po_point).toLocaleString('ko-KR')+'P'));ledger.append(li);}if(!state.ledger.length)ledger.append(el('li','포인트 내역이 없습니다.'));
 $('membership-payment-guide').textContent=state.payment.enabled?state.payment.provider+' · '+state.payment.instructions:'결제 수단을 준비 중입니다. 현재 추가 구매 신청은 사용할 수 없습니다.';$('membership-topup-submit').disabled=busy||!state.enabled||!state.payment.enabled;
 const orders=$('membership-topup-orders');orders.replaceChildren();for(const o of state.topups){const item=el('div',o.points.toLocaleString('ko-KR')+'P · '+o.priceWon.toLocaleString('ko-KR')+'원 · '+(o.state==='paid'?'충전 완료':'결제 확인 대기'));item.className='noa-membership-order';
  if(state.admin&&o.state==='awaiting_payment'){item.append(el('p','신청 회원: '+o.ownerId));const reference=el('input','');reference.placeholder='확인한 실제 거래 번호';reference.setAttribute('aria-label','실제 거래 번호');const label=el('label','실제 결제 원장과 금액을 확인했습니다.');const check=el('input','');check.type='checkbox';label.prepend(check);const confirm=el('button','결제 확인 · 포인트 지급');confirm.type='button';confirm.disabled=busy;confirm.onclick=async()=>{if(!check.checked||!reference.value.trim()){notice('실제 결제와 거래 번호를 확인한 후 체크하세요.');return;}await act(async()=>{await post('admin_confirm',{ownerId:o.ownerId,id:o.id,reference:reference.value.trim(),amountWon:o.priceWon,paymentConfirmed:true});notice('결제 확인 및 충전을 기록했습니다.');});};item.append(reference,label,confirm);}orders.append(item);
 }
}
async function refresh(){state=await read();render();window.dispatchEvent(new Event('noa-membership-change'));}
async function act(fn){if(busy)return;busy=true;render();try{await fn();await refresh();}catch(e){notice(e.name==='AbortError'?'응답 확인이 늦어지고 있습니다. 내역을 확인하세요. 같은 요청으로 재확인할 수 있습니다.':e.message);}finally{busy=false;render();}}
$('membership-confirm').onchange=()=>render();$('membership-buy').onclick=()=>act(async()=>{purchaseId??=crypto.randomUUID();await post('vip',{requestId:purchaseId,policyRevision:state.policyRevision,quotedPoints:3000,durationDays:30,confirmed:$('membership-confirm').checked});purchaseId=null;$('membership-confirm').checked=false;notice('VIP 30일 이용권을 적용했습니다.');});
$('membership-auto').onchange=()=>{const enabled=$('membership-auto').checked;act(async()=>{await post('auto',{enabled,revision:state.autoRenew.revision});notice(enabled?'자동연장을 켰습니다. 만료 시 잔액이 충분하면 3,000P로 30일 연장합니다.':'자동연장을 해제했습니다.');});};
$('membership-topup').onsubmit=e=>{e.preventDefault();const points=Number($('membership-topup-points').value);act(async()=>{if(!topupRetry||topupRetry.points!==points)topupRetry={requestId:crypto.randomUUID(),points};await post('topup',topupRetry);topupRetry=null;notice('구매 신청을 보관했습니다. 안내된 실제 결제 확인 후 충전됩니다.');});};
let pendingGift;
const praise=$('fan-praise');
if(praise)praise.onsubmit=e=>{e.preventDefault();if(!state||busy)return;
 const recipient=praise.elements.recipient.value.trim(),points=Number(praise.elements.points.value);
 if(!Number.isSafeInteger(points)||points<1||points>state.balance){notice('보유 포인트 안에서 입력해 주세요.');return;}
 if(!confirm(recipient+' 회원에게 '+points.toLocaleString()+'P를 선물할까요?'))return;
 if(!pendingGift||pendingGift.recipient!==recipient||pendingGift.points!==points)pendingGift={recipient,points,requestId:crypto.randomUUID()};
 act(async()=>{const d=await post('praise',pendingGift);pendingGift=null;praise.reset();notice('선물했습니다.'+(d.gift.rebate?' '+d.gift.rebate+'P가 돌아왔습니다.':''));});};
const appoint=$('fan-appoint');
if(appoint)appoint.onsubmit=e=>{e.preventDefault();if(!state||busy)return;
 const recipient=appoint.elements.recipient.value.trim(),level=Number(appoint.dataset.level);
 if(confirm(recipient+' 회원을 '+level+'레벨로 임명할까요?'))act(async()=>{await post('appoint',{recipient,level});appoint.reset();notice('임명했습니다.');});};
refresh().then(()=>notice(state.enabled?'잔액과 이용 기간을 확인하세요.':'회원 정책 적용을 준비 중입니다.')).catch(e=>notice(e.message));
})();
