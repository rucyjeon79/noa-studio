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
$admin=!empty($is_member)&&($is_admin??'')==='super';$songs=[];$genres=[];$error=false;
try {
    $db=noa_bridge_pdo();
    $rows=$db->query("SELECT doc_key,kind,payload FROM noa_documents WHERE kind IN ('single','playlist','story') ORDER BY doc_key");
    while($r=$rows->fetch(PDO::FETCH_ASSOC)) {
        $p=json_decode($r['payload'],true);if(!is_array($p))continue;
        $b=$p['body']??[];$video=noa_music_video($b['youtubeUrl']??'');
        if(!$admin && (empty($p['confirmed'])||!$video))continue;
        $title=(string)($b['confirmedTitle']??$p['title']??'');if(trim($title)==='')$title=(string)($p['title']??$r['doc_key']);
        $genre=(string)($p['genreId']??'other');$genres[$genre]=($genres[$genre]??0)+1;
        $songs[]=['key'=>$r['doc_key'],'title'=>$title,'genre'=>$genre,'video'=>$video,'confirmed'=>!empty($p['confirmed']),'ep'=>(string)($p['ep']??'')];
    }
} catch(Throwable $e){$error=true;error_log('[noa-music] '.get_class($e));}
?><!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Music Library | NOA STUDIO</title>
<style>
:root{color-scheme:dark;--bg:#090a0e;--panel:#14151a;--line:#303036;--gold:#d7ad62;--text:#f4f0e9;--muted:#a6a5a8;--radius:12px}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.6 system-ui,"Malgun Gothic",sans-serif}a{color:var(--gold);text-decoration:none}main{max-width:1280px;margin:auto;padding:32px 24px}header{display:flex;align-items:center;justify-content:space-between;gap:16px}.brand{font:700 24px Georgia,serif;letter-spacing:2px}nav{display:flex;gap:20px;align-items:center}h1{font:normal clamp(32px,5vw,56px) Georgia,serif;margin:32px 0 8px}.muted{color:var(--muted)}.player{margin:24px 0;background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;display:grid;grid-template-columns:minmax(0,1.4fr) minmax(240px,1fr)}.screen{aspect-ratio:16/9;background:var(--bg);display:grid;place-items:center}iframe{width:100%;height:100%;border:0}.playing{padding:32px;display:flex;justify-content:center;flex-direction:column}.playing h2{font-size:24px;margin:8px 0}.filters{display:flex;gap:12px;margin:24px 0}input,select{min-height:48px;background:var(--panel);color:var(--text);border:1px solid var(--line);border-radius:8px;font:inherit;padding:12px;min-width:0}input{flex:1}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}.song{padding:0;text-align:left;border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;background:var(--panel);color:var(--text);font:inherit;cursor:pointer;min-width:0}.song:hover,.song.selected{border-color:var(--gold)}.song img{width:100%;aspect-ratio:16/9;object-fit:cover;display:block}.song .cover{aspect-ratio:16/9;display:grid;place-items:center;font:24px Georgia,serif;color:var(--gold)}.info{padding:16px}.info strong{display:block;overflow-wrap:anywhere}.info small{display:block;color:var(--muted);margin-top:8px}.song[hidden]{display:none}.song:disabled{cursor:default}.badge{color:var(--gold);font-size:12px}.empty{padding:24px;border:1px solid var(--line);border-radius:var(--radius)}@media(max-width:960px){.grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:760px){main{padding:20px 16px}.player{grid-template-columns:1fr}.playing{padding:20px}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.filters{flex-direction:column}header{align-items:flex-start;flex-direction:column}nav{flex-wrap:wrap;gap:16px}nav a{min-height:44px;display:flex;align-items:center}.info{padding:12px}}
</style></head><body><main><header><a class="brand" href="/">NOA STUDIO</a><nav><a href="/">홈</a><a href="https://noa-studio.grok.me/" rel="noopener noreferrer">음악 만들기 ↗</a><?php if($admin):?><a href="/noa-library.php">라이브러리 관리</a><?php else:?><a href="/bbs/login.php?url=%2Fnoa-music.php">로그인</a><?php endif;?></nav></header>
<h1>Music Library</h1><p class="muted"><?=$admin?'관리자 보기 · 작업 중인 문서 포함':'확정된 음악과 이야기를 만나보세요.'?> · <?=count($songs)?>개 문서</p>
<section class="player" aria-label="음악 플레이어"><div class="screen" id="screen"><span class="muted">감상할 음악을 선택해 주세요.</span></div><div class="playing"><span class="badge">AI ARTIST NOA</span><h2 id="now-title">나만의 속도로, 노아의 음악</h2><p class="muted" id="now-genre">공식 YouTube 플레이어로 재생합니다.</p><a id="watch" hidden target="_blank" rel="noopener noreferrer">YouTube에서 보기 ↗</a></div></section>
<div class="filters"><input id="search" type="search" aria-label="음악 검색" placeholder="곡 제목으로 검색"><select id="genre" aria-label="장르 선택"><option value="">전체 장르</option><?php foreach($genres as $g=>$count):?><option value="<?=noa_music_e($g)?>"><?=noa_music_e(str_replace('-',' ',strtoupper($g)))?> · <?=$count?></option><?php endforeach;?></select></div><p class="muted" id="result-count"></p>
<?php if($error):?><p class="empty">음악 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p><?php elseif(!$songs):?><p class="empty">아직 이관된 음악이 없습니다.</p><?php endif;?>
<div class="grid" id="songs"><?php foreach($songs as $song):?><button class="song" type="button" data-title="<?=noa_music_e($song['title'])?>" data-genre="<?=noa_music_e($song['genre'])?>" data-video="<?=noa_music_e($song['video'])?>" <?=$song['video']===''?'disabled':''?>><?php if($song['video']):?><img src="https://i.ytimg.com/vi/<?=noa_music_e($song['video'])?>/hqdefault.jpg" alt="" loading="lazy" onerror="this.onerror=null;this.src='/noa-bridge/noa-face.jpg';"><?php else:?><span class="cover">NOA</span><?php endif;?><div class="info"><strong><?=noa_music_e(($song['ep']?'EP.'.$song['ep'].' · ':'').$song['title'])?></strong><small><?=noa_music_e(str_replace('-',' ',strtoupper($song['genre'])))?></small><?php if($admin):?><span class="badge"><?=$song['confirmed']?'확정':'작업 중'?><?=$song['video']?'':' · 영상 링크 없음'?></span><?php endif;?></div></button><?php endforeach;?></div>
<p class="muted">저장소 원본 스냅샷 기준입니다. 최신 제작·생성 작업은 기존 음악 스튜디오에서 이어갈 수 있습니다.</p>
<script>
const buttons=[...document.querySelectorAll('.song')],search=document.getElementById('search'),genre=document.getElementById('genre');
function filter(){let count=0;const q=search.value.trim().toLocaleLowerCase();buttons.forEach(b=>{b.hidden=!!((genre.value&&b.dataset.genre!==genre.value)||(q&&!b.dataset.title.toLocaleLowerCase().includes(q)));if(!b.hidden)count++});document.getElementById('result-count').textContent=count+'개 문서'}
search.addEventListener('input',filter);genre.addEventListener('change',filter);filter();
function play(b,autoplay){const id=b.dataset.video;if(!/^[A-Za-z0-9_-]{11}$/.test(id))return;buttons.forEach(x=>x.classList.toggle('selected',x===b));const frame=document.createElement('iframe');frame.src='https://www.youtube-nocookie.com/embed/'+id+'?autoplay='+(autoplay?'1':'0')+'&rel=0';frame.title=b.dataset.title;frame.allow='autoplay; encrypted-media; picture-in-picture';frame.allowFullscreen=true;document.getElementById('screen').replaceChildren(frame);document.getElementById('now-title').textContent=b.dataset.title;document.getElementById('now-genre').textContent=b.dataset.genre.replaceAll('-',' ').toUpperCase();const watch=document.getElementById('watch');watch.href='https://www.youtube.com/watch?v='+id;watch.hidden=false;}
buttons.forEach(b=>b.addEventListener('click',()=>play(b,true)));const first=buttons.find(b=>b.dataset.video);if(first)play(first,false);
</script></main></body></html>
