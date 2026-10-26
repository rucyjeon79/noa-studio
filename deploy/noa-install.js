/* Browsers own installation; Apple devices receive the actual Safari steps. */
(()=>{'use strict';if(window.NoaInstall)return;
 const ua=navigator.userAgent||'',ios=/iPad|iPhone|iPod/.test(ua)||(/Macintosh/.test(ua)&&navigator.maxTouchPoints>1),platform=ios?'ios':/Android/.test(ua)?'android':/Macintosh|Mac OS X/.test(ua)?'mac':'desktop';
 const installed=()=>window.matchMedia?.('(display-mode: standalone)').matches||navigator.standalone===true;
 let deferred=null,busy=false;
 const status=text=>document.querySelectorAll('[data-noa-install-status]').forEach(el=>el.textContent=text);
 const refresh=()=>{document.querySelectorAll('[data-noa-install-prompt]').forEach(el=>el.hidden=!deferred||installed());if(installed())status('이미 NOA STUDIO 앱으로 실행 중입니다.');};
 window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferred=event;refresh();});
 window.addEventListener('appinstalled',()=>{deferred=null;status('설치가 완료되었습니다. 홈 화면에서 NOA STUDIO를 열어 보세요.');refresh();});
 document.addEventListener('click',async event=>{const button=event.target.closest?.('[data-noa-install-prompt]');if(!button||!deferred||busy)return;busy=true;button.disabled=true;const prompt=deferred;deferred=null;try{await prompt.prompt();const result=await prompt.userChoice;status(result.outcome==='accepted'?'설치 요청을 완료했습니다. 브라우저의 설치 안내를 확인해 주세요.':'설치를 취소했습니다. 브라우저 메뉴에서 다시 설치할 수 있습니다.');}catch{status('브라우저 메뉴의 앱 설치 또는 홈 화면에 추가를 이용해 주세요.');}finally{busy=false;button.disabled=false;refresh();}});
 function ready(){
  const legacy=document.querySelector('button#install');if(legacy){const link=document.createElement('a');link.id='install';link.className='noa-button';link.href='/noa-install.php';link.textContent='앱 설치';legacy.replaceWith(link);}
  const page=document.querySelector('[data-noa-install-page]'),current=document.querySelector('[data-install-platform="'+platform+'"]');
  if(page&&current){current.dataset.current='true';const first=page.querySelector('.noa-install-platform');if(first!==current)page.insertBefore(current,first);}
  if(page&&!installed())status(ios?'Safari에서 홈 화면에 추가할 수 있습니다.':platform==='mac'?'Safari에서 Dock에 추가할 수 있습니다.':'브라우저의 앱 설치 또는 홈 화면에 추가를 이용하세요.');
  const requested=new URLSearchParams(location.search).get('install');
  if(['/','/index.php'].includes(location.pathname)&&['1','ios','android','mac','desktop'].includes(requested)){
   const type=requested==='1'?platform:requested,dialog=document.createElement('dialog');dialog.className='noa-install-guide';dialog.id='noa-install-guide';dialog.setAttribute('aria-labelledby','noa-install-title');
   const copy=type==='ios'?['홈 화면에 NOA STUDIO 추가','Safari에서 아래 순서대로 추가하세요.',['공유 메뉴를 엽니다.','홈 화면에 추가를 선택합니다.','웹 앱으로 열기가 보이면 켜고 추가를 누릅니다.'],'카카오톡 등 앱 안에서는 Safari로 열어 주세요. 항목이 없으면 공유 메뉴의 동작 편집을 확인하세요.']:type==='mac'?['Dock에 NOA STUDIO 추가','Safari에서 홈을 앱으로 추가하세요.',['메뉴 막대에서 파일 → Dock에 추가를 선택합니다.','이름을 확인하고 추가를 누릅니다.'],'macOS Sonoma 14 이상에서 사용할 수 있습니다.']:['NOA STUDIO 앱 설치','설치 버튼 또는 브라우저 메뉴를 이용하세요.',['앱 설치 또는 홈 화면에 추가를 선택합니다.','이름을 확인하고 설치를 완료합니다.'],'설치한 아이콘은 NOA STUDIO 홈으로 연결됩니다.'];
   const h=document.createElement('h2');h.id='noa-install-title';h.textContent=copy[0];const lead=document.createElement('p');lead.textContent=copy[1];const list=document.createElement('ol');for(const step of copy[2]){const li=document.createElement('li');li.textContent=step;list.append(li);}const note=document.createElement('p');note.className='noa-muted';note.textContent=copy[3];const result=document.createElement('p');result.setAttribute('data-noa-install-status','');result.setAttribute('role','status');const actions=document.createElement('div');actions.className='noa-install-actions';const install=document.createElement('button');install.type='button';install.className='noa-button primary';install.dataset.noaInstallPrompt='';install.textContent='앱 설치';install.hidden=true;actions.append(install);const form=document.createElement('form');form.method='dialog';const close=document.createElement('button');close.className='noa-button';close.textContent='안내 닫기';form.append(close);dialog.append(h,lead,list,note,result,actions,form);document.body.append(dialog);dialog.showModal();
   // Keep the home address clean even when a browser ignores manifest start_url.
   const clean=new URL(location.href);clean.searchParams.delete('install');history.replaceState(history.state,'',clean.pathname+clean.search+clean.hash);
  }
  refresh();
 }
 window.NoaInstall={platform};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
