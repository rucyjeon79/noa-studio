(()=>{
 const content=document.querySelector('#ec-content');
 if(!content)return;
 const base='https://www.youtube.com/channel/UCwYy9xsAqDFat6AV5UKrfgA';
 const titles={diary:'노아의 일기',music:'오늘의 노래',event:'진행 중인 별무리 이벤트'};
 const events=[
  {id:'invite',art:'fans-stars',title:'친구와 함께 별무리가 되어 주세요',sub:'초대자와 새 회원에게 각각 500P',body:['초대 링크 공유를 눌러 내 링크를 복사하거나 친구에게 보내 주세요. 친구가 그 링크로 가입을 마치면 두 사람에게 각각 500P가 지급됩니다.','신규 회원에게는 기본 가입 축하 1,000P도 있어요. 초대로 가입한 친구는 두 혜택을 합쳐 1,500P로 시작합니다.'],cta:'내 초대 링크 공유',url:'/?invite_share=1'},
  {id:'monthly',art:'starlight-studio',title:'이달의 첫 활동, 포인트 10배',sub:'매월 네 가지 활동으로 총 1,900P',body:['이번 달 첫 로그인으로 1,000P, 첫 글로 500P를 받아요. 마음에 남은 글에 첫 댓글을 쓰면 300P, 첫 좋아요를 누르면 100P가 적립됩니다.','한국 시간으로 매월 1일에 새로 시작해요. 활동마다 한 번씩 적용되며, 이미 누른 좋아요를 취소하고 다시 눌러도 중복 적립되지 않습니다.'],cta:'이달의 적립 혜택 보기',url:'/#noa-monthly-heading'},
  {id:'story',art:'home-story',title:'당신의 이야기, 우리의 음악',sub:'오픈 기념 사연곡 신청 무료',body:['가족에게 전하고 싶은 한마디, 아직 기억나는 어느 날의 풍경도 좋아요. 사연곡 게시판에서 제목과 이야기를 남겨 주세요. 오픈 기념으로 신청은 무료입니다.','사연은 기본 비공개예요. 창작자에게 공유하는 데 동의하면 창작자가 사연에 댓글과 완성곡을 붙일 수 있어요. 답변이 도착하면 내 사연의 곡 카드에서 바로 들어 보세요.'],cta:'무료로 사연 남기기',url:'/noa-lounge.php?category=story&view=list#noa-song-requests'}
 ];
 const el=(tag,value)=>{const n=document.createElement(tag);if(value)n.textContent=value;return n;};
 function link(label,url){const a=el('a',label);a.href=url;a.className='ec-link';if(url.startsWith('https:')){a.target='_blank';a.rel='noopener noreferrer';}return a;}
 function eventPost(event,expanded){
  const row=el('article');row.className='ec-card';
  const cover=el('img');cover.className='noa-event-photo';cover.alt='';cover.src='/noa-assets/editorial-'+event.art+'.webp';row.append(cover,el('h3',event.title),el('p',event.sub));
  if(!expanded){row.append(link('이벤트 자세히 보기','?category=event&event='+event.id));return row;}
  for(const paragraph of event.body)row.append(el('p',paragraph));
  row.append(link(event.cta,event.url),link('모든 이벤트 보기','?category=event'));return row;
 }
 function feedPost(item,kind){
  const row=el('article');row.className='ec-card';
  if(kind==='music'){
   const id=new URL(item.url).searchParams.get('v');if(!/^[\w-]{11}$/.test(id))return row;
   row.append(el('h3',item.title));
   const play=el('button');play.className='noa-video-cover';play.type='button';play.setAttribute('aria-label',item.title+' 재생');
   const thumb=el('img');thumb.alt='';thumb.onerror=()=>{thumb.onerror=null;thumb.src='/noa-assets/editorial-starlight-studio.webp';};thumb.src='https://i.ytimg.com/vi/'+id+'/hqdefault.jpg';play.append(thumb,el('span','▶ 영상 재생'));
   play.onclick=()=>{const frame=el('iframe');frame.title=item.title;frame.allow='autoplay; encrypted-media; picture-in-picture';frame.allowFullscreen=true;frame.referrerPolicy='strict-origin-when-cross-origin';frame.src='https://www.youtube.com/embed/'+id+'?autoplay=1&playsinline=1';play.replaceWith(frame);};
   row.append(play,link('유튜브에서 보기',item.url));return row;
  }
  const blocks=item.title.trim().split(/\n\s*\n/);const details=el('details');const lines=item.title.split(/\n/).map(s=>s.trim()).filter(Boolean);const preview=/^별무리에게[.,。]?$/u.test(lines[0])&&lines.length>1?lines.slice(1,3).join(' '):lines[0];const summary=el('summary',preview);details.append(summary);
  for(const block of blocks){const p=el('p',block);p.className='noa-diary-paragraph';details.append(p);}
  details.append(link('유튜브 원문 보기',item.url));row.append(details);return row;
 }
 let current='',timer;
 function refresh(){
  const q=new URLSearchParams(location.search),kind=q.get('category');
  const show=titles[kind]&&!['post','board','nativePost','q','mine','saved'].some(k=>!!q.get(k))&&Number(q.get('page')||1)===1;
  const key=show?kind+':'+(q.get('event')||''):'';
  if(current===key)return;current=key;clearTimeout(timer);document.querySelector('#noa-channel-shelf')?.remove();if(!show)return;
  const section=el('section');section.id='noa-channel-shelf';content.before(section);section.append(el('h2',titles[kind]));
  if(kind==='event'){const selected=events.find(e=>e.id===q.get('event'));for(const event of selected?[selected]:events)section.append(eventPost(event,!!selected));return;}
  const list=el('div');section.append(list,link(kind==='diary'?'유튜브 커뮤니티 원문 보기':'채널 영상 보기',base+(kind==='diary'?'/posts':'/videos')));
  async function load(){
   try{const r=await fetch('/noa-bridge/lounge-channel.php?kind='+kind);const d=await r.json();if(!section.isConnected)return;
    const items=d.items.filter(i=>kind!=='music'||(i.at*1000>Date.now()-86400000&&i.at*1000<=Date.now()));
    const known=new Map(Array.from(list.querySelectorAll('article'),n=>[n.dataset.url,n]));
    for(const item of items){const old=known.get(item.url);if(old){known.delete(item.url);continue;}const row=feedPost(item,kind);row.dataset.url=item.url;list.append(row);}
    for(const old of known.values())old.remove();
    list.querySelector(':scope>p')?.remove();
    if(!items.length)list.append(el('p',!d.ok?'유튜브에서 최신 소식을 확인해 주세요.':kind==='music'?'최근 24시간 안에 공개된 영상이 없습니다.':'아직 공개된 유튜브 커뮤니티 글이 없습니다.'));
   }catch{if(!list.childElementCount)list.textContent='유튜브에서 최신 소식을 확인해 주세요.';}
   if(section.isConnected)timer=setTimeout(load,60000);
  }
  load();
 }
 new MutationObserver(refresh).observe(content,{childList:true});refresh();
})();
