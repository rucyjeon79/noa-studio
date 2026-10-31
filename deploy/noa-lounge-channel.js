(()=>{
 const content=document.querySelector('#ec-content');
 if(!content)return;
 const base='https://www.youtube.com/channel/UCwYy9xsAqDFat6AV5UKrfgA';
 const titles={diary:'노아의 일기',music:'오늘의 노래',event:'진행 중인 별무리 이벤트'};
 const events=[
  ['친구 초대하고 각각 500P','내 초대 링크로 친구가 가입하면 두 사람 모두 500P를 받아요.','초대 링크 공유','/?invite_share=1'],
  ['매월 첫 활동은 포인트 10배','첫 로그인·글·댓글·좋아요마다 한 번씩 받을 수 있어요.','이번 달 적립 혜택','/#noa-monthly-heading'],
  ['오픈 기념 · 사연곡 신청 무료','별무리의 이야기를 남기면 창작자가 완성곡으로 답할 수 있어요.','무료로 사연 남기기','/noa-lounge.php?category=story&view=list#noa-song-requests']
 ];
 const el=(tag,value)=>{const n=document.createElement(tag);if(value)n.textContent=value;return n;};
 function link(label,url){const a=el('a',label);a.href=url;a.className='ec-link';if(url.startsWith('https:')){a.target='_blank';a.rel='noopener noreferrer';}return a;}
 let current='',timer;
 function refresh(){
  const q=new URLSearchParams(location.search);
  const kind=q.get('category');
  const show=titles[kind]&&!['post','board','nativePost','q','mine','saved'].some(k=>!!q.get(k))&&Number(q.get('page')||1)===1;
  if(current===(show?kind:''))return;
  current=show?kind:'';clearTimeout(timer);document.querySelector('#noa-channel-shelf')?.remove();
  if(!show)return;
  const section=el('section');section.id='noa-channel-shelf';section.className='ec-posts';content.before(section);
  section.append(el('h2',titles[kind]));
  if(kind==='event'){for(const [title,body,cta,url] of events){const row=el('article');row.className='ec-card';row.append(el('h3',title),el('p',body),link(cta,url));section.append(row);}return;}
  const list=el('div');section.append(list,link(kind==='diary'?'유튜브 커뮤니티 원문 보기':'채널 영상 보기',base+(kind==='diary'?'/posts':'/videos')));
  async function load(){
   try{const r=await fetch('/noa-bridge/lounge-channel.php?kind='+kind);const d=await r.json();if(!section.isConnected)return;
    list.replaceChildren();for(const item of d.items){if(kind==='music'&&(item.at*1000<=Date.now()-86400000||item.at*1000>Date.now()))continue;
     const row=el('article');row.className='ec-card';row.append(link(item.title,item.url));list.append(row);}
    if(!list.childElementCount)list.append(el('p',!d.ok?'유튜브에서 최신 소식을 확인해 주세요.':kind==='music'?'최근 24시간 안에 공개된 영상이 없습니다.':'아직 공개된 유튜브 커뮤니티 글이 없습니다.'));
   }catch{list.textContent='유튜브에서 최신 소식을 확인해 주세요.';}
   if(section.isConnected)timer=setTimeout(load,60000);
  }
  load();
 }
 new MutationObserver(refresh).observe(content,{childList:true});refresh();
})();
