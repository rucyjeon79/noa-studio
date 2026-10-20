<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';
require_once __DIR__.'/noa-bridge/storage.php';
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: private, no-store');
header('X-Content-Type-Options: nosniff');
function noa_music_e(string $v): string { return htmlspecialchars($v,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8'); }
function noa_music_video($url): string {
    if (!is_string($url)) return '';
    $u=parse_url($url); $host=strtolower($u['host']??''); $id='';
    if (in_array($host,['youtu.be','www.youtu.be'],true)) $id=trim($u['path']??'','/');
    elseif (in_array($host,['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com'],true)) {
        parse_str($u['query']??'',$q); $id=is_string($q['v']??null)?$q['v']:'';
        if (!$id && preg_match('~^/(?:embed|shorts)/([A-Za-z0-9_-]{11})(?:/|$)~',$u['path']??'',$m)) $id=$m[1];
    }
    return preg_match('/^[A-Za-z0-9_-]{11}$/D',$id)?$id:'';
}
$admin=!empty($is_member)&&($is_admin??'')==='super';$songs=[];$genres=array_fill_keys(['kpop-original','jpop-original','pop-original','thai-original','joseon-ballad','echoes-of-joseon','groovy-airy-pop','narrative-piano-indie','dreamy-deep-house','fantasy-ambient-edm','edm-kpop-club','latin-afrobeats-edm','panpop','your-story','cover-reborn'],0);$error=false;
try {
    $db=noa_bridge_pdo();
    $rows=$db->query("SELECT doc_key,kind,payload FROM noa_documents WHERE kind IN ('single','playlist','story') ORDER BY doc_key");
    while($r=$rows->fetch(PDO::FETCH_ASSOC)) {
        $p=json_decode($r['payload'],true);if(!is_array($p))continue;
        $b=$p['body']??[];$thumb=$b['thumbUrl']??'';if(!is_string($thumb)||!filter_var($thumb,FILTER_VALIDATE_URL)||parse_url($thumb,PHP_URL_SCHEME)!=='https')$thumb='';$video=noa_music_video($b['youtubeUrl']??'');
        if(!$admin && (empty($p['confirmed'])||!$video))continue;
        $title=(string)($b['confirmedTitle']??$p['title']??'');if(trim($title)==='')$title=(string)($p['title']??$r['doc_key']);
        $genre=(string)($p['genreId']??'other');$genres[$genre]=($genres[$genre]??0)+1;
        $songs[]=['key'=>$r['doc_key'],'title'=>$title,'genre'=>$genre,'video'=>$video,'confirmed'=>!empty($p['confirmed']),'ep'=>(string)($p['ep']??''),'act'=>(string)($p['act']??''),'kind'=>$r['kind'],'lyrics'=>(string)($b['lyricsBlock']??''),'cast'=>(string)($b['thumbCast']??''),'thumb'=>$thumb];
    }
} catch(Throwable $e){$error=true;error_log('[noa-music] '.get_class($e));}
?><!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Music Library | NOA STUDIO</title><link rel="manifest" href="/noa-manifest.json"><meta name="theme-color" content="#090a0e">
<style>
:root{color-scheme:dark;--bg:#090a0e;--panel:#14151a;--line:#303036;--gold:#d7ad62;--text:#f4f0e9;--muted:#a6a5a8;--radius:12px}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.6 system-ui,"Malgun Gothic",sans-serif}a{color:var(--gold);text-decoration:none}main{max-width:1280px;margin:auto;padding:32px 24px}header{display:flex;align-items:center;justify-content:space-between;gap:16px}.brand{font:700 24px Georgia,serif;letter-spacing:2px}nav{display:flex;gap:20px;align-items:center}h1{font:normal clamp(32px,5vw,56px) Georgia,serif;margin:32px 0 8px}.muted{color:var(--muted)}.player{margin:24px 0;background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;display:grid;grid-template-columns:minmax(0,1.4fr) minmax(240px,1fr)}.screen{aspect-ratio:16/9;background:var(--bg);display:grid;place-items:center}iframe{width:100%;height:100%;border:0}.playing{padding:32px;display:flex;justify-content:center;flex-direction:column}.playing h2{font-size:24px;margin:8px 0}.filters{display:flex;gap:12px;margin:24px 0}input,select{min-height:48px;background:var(--panel);color:var(--text);border:1px solid var(--line);border-radius:8px;font:inherit;padding:12px;min-width:0}input{flex:1}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}.song{padding:0;text-align:left;border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;background:var(--panel);color:var(--text);font:inherit;cursor:pointer;min-width:0}.song:hover,.song.selected{border-color:var(--gold)}.song img{width:100%;aspect-ratio:16/9;object-fit:cover;display:block}.song .cover{aspect-ratio:16/9;display:grid;place-items:center;font:24px Georgia,serif;color:var(--gold)}.info{padding:16px}.info strong{display:block;overflow-wrap:anywhere}.info small{display:block;color:var(--muted);margin-top:8px}.song[hidden]{display:none}.song:disabled{cursor:default}.badge{color:var(--gold);font-size:12px}.empty{padding:24px;border:1px solid var(--line);border-radius:var(--radius)}@media(max-width:960px){.grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:760px){main{padding:20px 16px}.player{grid-template-columns:1fr}.playing{padding:20px}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.filters{flex-direction:column}header{align-items:flex-start;flex-direction:column}nav{flex-wrap:wrap;gap:16px}nav a{min-height:44px;display:flex;align-items:center}.info{padding:12px}}
.controls{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.controls button{min-height:44px;padding:10px 16px;border:1px solid var(--line);border-radius:8px;background:var(--panel);color:var(--text);font:inherit;cursor:pointer}.controls button[aria-pressed="true"]{border-color:var(--gold);color:var(--gold)}.lyrics{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;max-height:540px;overflow:auto}.detail{padding:24px;border:1px solid var(--line);border-radius:var(--radius);margin:24px 0}.screen{min-height:200px}</style></head><body><main><header><a class="brand" href="/">NOA STUDIO</a><nav><a href="/">홈</a><button id="install" hidden type="button">앱 설치</button><?php if($admin):?><a href="/noa-library.php">라이브러리 관리</a><?php else:?><a href="/bbs/login.php?url=%2Fnoa-music.php">로그인</a><?php endif;?></nav></header>
<h1>Music Library</h1><p class="muted"><?=$admin?'관리자 보기 · 작업 중인 문서 포함':'확정된 음악과 이야기를 만나보세요.'?> · <?=count($songs)?>개 문서</p>
<section class="player" aria-label="음악 플레이어"><div class="screen" id="screen"><span class="muted">감상할 음악을 선택해 주세요.</span></div><div class="playing"><span class="badge">AI ARTIST NOA</span><h2 id="now-title">나만의 속도로, 노아의 음악</h2><p class="muted" id="now-genre">공식 YouTube 플레이어로 재생합니다.</p><a id="watch" hidden target="_blank" rel="noopener noreferrer">YouTube에서 보기 ↗</a></div></section>
<div class="controls"><button id="previous" type="button">이전 곡</button><button id="next" type="button">다음 곡</button><button id="repeat" type="button" aria-pressed="false">한 곡 반복</button><button id="shuffle" type="button" aria-pressed="false">셔플</button></div><p id="player-status" class="muted" role="status"></p><section class="detail" aria-label="곡 상세"><h2 id="detail-title">곡 정보</h2><p id="detail-cast" class="muted"></p><div id="cast-portraits"><img id="cast-noa" src="/noa-bridge/characters/noa-face.jpg" alt="노아" hidden width="80" height="100"><img id="cast-noel" src="/noa-bridge/characters/noel-face.jpg" alt="노엘" hidden width="80" height="100"></div><pre id="lyrics" class="lyrics">음악을 선택하면 가사를 표시합니다.</pre></section><div class="filters"><input id="search" type="search" aria-label="음악 검색" placeholder="곡 제목으로 검색"><select id="genre" aria-label="장르 선택"><option value="">전체 장르</option><?php foreach($genres as $g=>$count):?><option value="<?=noa_music_e($g)?>"><?=noa_music_e(str_replace('-',' ',strtoupper($g)))?> · <?=$count?></option><?php endforeach;?></select></div><p class="muted" id="result-count"></p>
<?php if($error):?><p class="empty">음악 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p><?php elseif(!$songs):?><p class="empty">아직 이관된 음악이 없습니다.</p><?php endif;?>
<div class="grid" id="songs"><?php foreach($songs as $song):?><button class="song" type="button" data-key="<?=noa_music_e($song['key'])?>" data-title="<?=noa_music_e($song['title'])?>" data-genre="<?=noa_music_e($song['genre'])?>" data-video="<?=noa_music_e($song['video'])?>"><?php if($song['video']||$song['thumb']):?><img src="<?=noa_music_e($song['thumb']?:'https://i.ytimg.com/vi/'.$song['video'].'/hqdefault.jpg')?>" alt="" loading="lazy" onerror="this.onerror=null;this.src='/noa-bridge/noa-face.jpg';"><?php else:?><span class="cover">NOA</span><?php endif;?><div class="info"><strong><?=noa_music_e(($song['ep']?'EP.'.$song['ep'].' · ':($song['act']?'ACT.'.$song['act'].' · ':'')).$song['title'])?></strong><small><?=noa_music_e(str_replace('-',' ',strtoupper($song['genre'])))?></small><?php if($admin):?><span class="badge"><?=$song['confirmed']?'확정':'작업 중'?><?=$song['video']?'':' · 영상 링크 없음'?></span><?php endif;?></div></button><?php endforeach;?></div>
<p class="muted">AI Artist Noa · NOA STUDIO</p>
<script>
const records=<?=json_encode($songs,JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT|JSON_THROW_ON_ERROR)?>;
const buttons=[...document.querySelectorAll('.song')],search=document.getElementById('search'),genre=document.getElementById('genre');
const lookup=new Map(records.map(r=>[r.key,r]));let selected=null,player=null,ready=false,repeat=false,shuffle=false,pendingAutoplay=false;
const status=document.getElementById('player-status');
function queue(){return buttons.filter(b=>!b.hidden&&b.dataset.video)}
function filter(){let count=0;const q=search.value.trim().toLocaleLowerCase();buttons.forEach(b=>{const r=lookup.get(b.dataset.key);b.hidden=!!((genre.value&&r.genre!==genre.value)||(q&&!(r.title+' EP.'+r.ep+' ACT.'+r.act).toLocaleLowerCase().includes(q)));if(!b.hidden)count++});document.getElementById('result-count').textContent=count+'개 문서 · 재생 대기열 '+queue().length+'개'}
search.addEventListener('input',filter);genre.addEventListener('change',filter);filter();
function select(b,autoplay){
 selected=b;pendingAutoplay=autoplay;const r=lookup.get(b.dataset.key);buttons.forEach(x=>x.classList.toggle('selected',x===b));
 document.getElementById('now-title').textContent=r.title;document.getElementById('now-genre').textContent=r.genre.replaceAll('-',' ').toUpperCase();
 document.getElementById('detail-title').textContent=(r.ep?'EP.'+r.ep+' · ':r.act?'ACT.'+r.act+' · ':'')+r.title;
 document.getElementById('detail-cast').textContent=({female:'노아 · 여성 솔로',male:'노엘 · 남성 솔로',duet:'노아 & 노엘 · 남녀 듀엣'})[r.cast]||'캐릭터 정보 미등록';
 document.getElementById('cast-noa').hidden=!['female','duet'].includes(r.cast);document.getElementById('cast-noel').hidden=!['male','duet'].includes(r.cast);
 document.getElementById('lyrics').textContent=r.lyrics||'등록된 가사가 없습니다.';
 const watch=document.getElementById('watch');watch.hidden=!r.video;if(r.video)watch.href='https://www.youtube.com/watch?v='+r.video;
 status.textContent=r.video?'':'등록된 재생 주소가 없습니다. 곡 정보와 가사를 확인할 수 있습니다.';
 if(!r.video){if(ready)player.stopVideo();return;}
 try{sessionStorage.setItem('noa-last-song',r.key)}catch{}
 if(ready){const command=autoplay?'loadVideoById':'cueVideoById';player[command](r.video)}else if(window.YT?.Player)createPlayer();
}
function move(direction,ended=false){const q=queue();if(!q.length)return;let i=q.indexOf(selected);if(ended&&repeat&&selected?.dataset.video){select(selected,true);return}if(shuffle&&q.length>1){const other=q.filter(b=>b!==selected);select(other[Math.floor(Math.random()*other.length)],true);return}if(i<0)i=direction>0?-1:0;let n=i+direction;if(ended&&n>=q.length)return;select(q[(n+q.length)%q.length],true)}
function createPlayer(){if(player||!selected?.dataset.video)return;const mount=document.createElement('div');mount.id='youtube-player';document.getElementById('screen').replaceChildren(mount);player=new YT.Player('youtube-player',{host:'https://www.youtube-nocookie.com',videoId:selected.dataset.video,playerVars:{playsinline:1,origin:location.origin,rel:0},events:{onReady:e=>{ready=true;if(selected?.dataset.video){e.target[pendingAutoplay?'loadVideoById':'cueVideoById'](selected.dataset.video)}else e.target.stopVideo()},onStateChange:e=>{if(e.data===YT.PlayerState.ENDED)move(1,true);if(e.data===YT.PlayerState.PLAYING)status.textContent='재생 중';},onError:()=>{status.textContent='이 영상은 현재 재생할 수 없습니다. 공개 상태 또는 YouTube 재생 제한을 확인해 주세요.'},onAutoplayBlocked:()=>{status.textContent='플레이어의 재생 버튼을 눌러 주세요.'}}});}
window.onYouTubeIframeAPIReady=createPlayer;
buttons.forEach(b=>b.addEventListener('click',()=>select(b,true)));document.getElementById('previous').onclick=()=>move(-1);document.getElementById('next').onclick=()=>move(1);
for(const id of ['repeat','shuffle'])document.getElementById(id).onclick=e=>{if(id==='repeat')repeat=!repeat;else shuffle=!shuffle;e.currentTarget.setAttribute('aria-pressed',String(id==='repeat'?repeat:shuffle))};
let saved='';try{saved=sessionStorage.getItem('noa-last-song')||''}catch{}const first=buttons.find(b=>b.dataset.key===new URLSearchParams(location.search).get('track'))||buttons.find(b=>b.dataset.key===saved)||buttons.find(b=>b.dataset.video);if(first)select(first,false);
const api=document.createElement('script');api.src='https://www.youtube.com/iframe_api';api.onerror=()=>{status.textContent='플레이어를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'};document.head.append(api);
if('serviceWorker' in navigator)navigator.serviceWorker.register('/noa-sw.js').catch(()=>{});
let installPrompt;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;document.getElementById('install').hidden=false});document.getElementById('install').onclick=async()=>{if(installPrompt){await installPrompt.prompt();installPrompt=null;document.getElementById('install').hidden=true}};
</script></main></body></html>
