(()=>{'use strict';
document.addEventListener('click',event=>{const button=event.target.closest('[data-creator-ai-locked]');if(!button)return;const status=button.parentElement.querySelector('[role=status]');status.hidden=false;status.textContent='AI 생성은 8레벨 크레이터 VIP회원 또는 최고 관리자만 이용할 수 있습니다. 기능에 따라 포인트가 소모될 수 있어요.';});
})();
