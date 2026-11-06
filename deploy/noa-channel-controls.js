(()=>{'use strict';
document.addEventListener('click',event=>{const button=event.target.closest('[data-creator-ai-locked]');if(!button)return;const status=button.parentElement.querySelector('[role=status]');status.hidden=false;status.textContent='AI 생성은 8레벨 크레이터 VIP회원 또는 최고 관리자만 이용할 수 있습니다. 기능에 따라 포인트가 소모될 수 있어요.';});
})();

// The workspace menu is usable even when its optional profile is slow or unavailable.
(async () => {
 const title=document.getElementById('workspace-title');
 if(!title)return;
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),6000);
 try{
  const response=await fetch('/noa-bridge/creator.php?action=workspaceHeader',{credentials:'same-origin',cache:'no-store',signal:controller.signal});
  if(!response.ok)return;
  const {channel}=await response.json();
  if(!channel)return;
  if(channel.title)title.textContent=channel.title+' 작업실';
  const board=document.getElementById('workspace-board');
  if(channel.boardId){board.href='/bbs/board.php?bo_table='+encodeURIComponent(channel.boardId);board.hidden=false;}
  document.getElementById('workspace-shortcuts').hidden=false;
 }catch{/* Channel tools remain available in the menu. */}
 finally{clearTimeout(timer);}
})();
