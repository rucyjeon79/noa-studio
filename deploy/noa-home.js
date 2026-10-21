(()=>{'use strict';
const number=value=>Number(value).toLocaleString(document.documentElement.lang||'ko');
function card(row,playlist=false){
 const a=document.createElement('a');a.className='noa-music-card';a.href=row.href;a.dataset.video=row.videoId;if(playlist&&row.contentType==='youtube_playlist')a.dataset.playlist=row.playlistId;else a.dataset.views=String(row.views);
 const art=document.createElement('div');art.className='noa-art';const image=document.createElement('img');image.loading='lazy';image.src=row.thumbnail;image.alt='';art.append(image);
 image.onerror=()=>{image.hidden=true;art.dataset.unavailable='true';};
 const title=document.createElement('strong');title.textContent=row.title;const note=document.createElement('small');note.textContent=playlist?(row.scoreKind==='video_view_count'?'연속듣기 영상 조회 '+number(row.views):'수록 영상 조회수 합계 '+number(row.score)+' · 집계 '+row.countedVideos+'개'+(row.excludedVideos?' · 제외 '+row.excludedVideos+'개':'')):'조회 '+number(row.views)+(row.genre?' · '+(window.NoaBrowse.names[row.genre]||row.genre):'');
 a.append(art,title,note);return a;
}
function fill(id,rows,playlist=false){const host=document.getElementById(id);host.replaceChildren();if(!rows.length){const empty=document.createElement('p');empty.className='noa-empty';empty.textContent=playlist?'조건에 맞는 공개 연속듣기 목록이 없습니다.':'현재 순위 조건을 충족하는 공개 영상이 없습니다.';host.append(empty);return;}for(const row of rows)host.append(card(row,playlist));}
(async()=>{try{
 const response=await fetch('/noa-bridge/home.php',{credentials:'same-origin',cache:'no-store'});if(!response.ok)throw Error();const data=await response.json();if(!data.ok)throw Error();
 for(const [id,key]of [['noa-featured','featured'],['noa-ep','ep'],['noa-stories','stories'],['noa-covers','covers']])fill(id,data[key]);fill('noa-acts',data.playlists,true);
 document.getElementById('noa-playlist-basis').textContent=data.playlistBasis;
 const date=new Date(data.collectedAt);document.getElementById('noa-ranking-status').textContent='YouTube 수집 시점의 누적 조회수 · '+(Number.isFinite(date.getTime())?date.toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})+' (한국시간)':data.collectedAt)+' · 공개·곡 연결 확인 '+data.counts.rankableVideos+'개 영상 기준(인기곡·EP). '+data.categoryBasis;
 const host=document.getElementById('noa-genres');for(const [id,title,genres]of window.NoaBrowse.groups){const a=document.createElement('a');a.className='noa-genre';a.href='/noa-music.php?group='+encodeURIComponent(id);const name=document.createElement('strong');name.textContent=window.NoaUI?.translate(title)||title;const small=document.createElement('small');small.textContent=genres.map(g=>window.NoaBrowse.names[g]).join(' · ');a.append(name,small);host.append(a);}
 document.body.dataset.noaHomeReady='true';
 }catch{for(const id of ['noa-featured','noa-ep','noa-stories','noa-covers','noa-acts']){const host=document.getElementById(id);host.replaceChildren();const p=document.createElement('p');p.className='noa-empty';p.textContent='공개 영상 순위를 불러오지 못했습니다. 잠시 후 다시 열어 주세요.';host.append(p);}document.getElementById('noa-ranking-status').textContent='채널 집계 자료 연결을 확인해 주세요.';document.body.dataset.noaHomeReady='error';}
})();})();
