<?php
declare(strict_types=1);require_once __DIR__.'/common.php';require_once __DIR__.'/noa-bridge/storage.php';require_once __DIR__.'/noa-bridge/youtube-store.php';require_once __DIR__.'/noa-bridge/sound-core.php';require_once __DIR__.'/noa-bridge/world-mv.php';
$detailRequested=array_key_exists('detail',$_GET);$detailId=$detailRequested?$_GET['detail']:null;
if($detailRequested){
 header('Content-Type: application/json; charset=utf-8');header('Cache-Control: private, no-store');header('X-Content-Type-Options: nosniff');
 if(($_SERVER['REQUEST_METHOD']??'GET')!=='GET'){header('Allow: GET');http_response_code(405);echo '{"ok":false,"error":"method_not_allowed"}';exit;}
 if(!is_string($detailId)||!preg_match('/^[A-Za-z0-9_-]{11}$/D',$detailId)||array_diff(array_keys($_GET),['detail'])){http_response_code(400);echo '{"ok":false,"error":"invalid_video_id"}';exit;}
}
$admin=!empty($is_member)&&($is_admin??'')==='super';header('Cache-Control: private, no-store');header('X-Content-Type-Options: nosniff');$videos=[];$playlists=[];$run=null;$error=false;$songIndex=[];
if(isset($_GET['world'])||in_array($_GET['playlist']??null,[NWM_PLAYLIST,NWM_ACT_PLAYLIST],true)){header('Location: /noa-world.php',true,302);exit;}
try{$db=noa_bridge_pdo();$run=ny_latest($db);if($run){$songIndex=ny_songs($db,ny_batch($db));$videos=ny_videos($db,$run,true,$songIndex);$q=$db->prepare('SELECT playlist_id,payload FROM noa_youtube_playlists WHERE run_id=?');$q->execute([$run['run_id']]);foreach($q as $p){$value=json_decode($p['payload'],true);if(($value['status']['privacyStatus']??'')==='public')$playlists[$p['playlist_id']]=$value;}}else{
 // Until owner authorization, show existing public music URLs without claiming channel collection.
 $batch=ny_batch($db);foreach(ny_songs($db,$batch) as $s){if(!$s['public_verified'])continue;$id=ny_video_id((string)($s['fields']['youtubeUrl']??''));if(!$id)continue;$videos[$id]=['id'=>$id,'snippet'=>['title'=>$s['fields']['title']??'NOA Music'],'status'=>['privacyStatus'=>'public','embeddable'=>true],'classification'=>'music','legacy'=>true];}
 }}catch(Throwable $e){$error=true;error_log('[noa-youtube-view] '.get_class($e));}
$playlistUnavailable=false;
if(isset($_GET['playlist'])){
 $pid=(string)$_GET['playlist'];
 if(!$run||!isset($playlists[$pid])){$videos=[];$playlistUnavailable=true;http_response_code(404);}
 else{$ordered=[];$q=$db->prepare('SELECT video_id FROM noa_youtube_items WHERE run_id=? AND playlist_id=? ORDER BY position,item_id');$q->execute([$run['run_id'],$pid]);foreach($q as $item){$id=$item['video_id'];$v=$videos[$id]??null;if($v)$ordered[$id]=$v;}$videos=$ordered;}
}

// Keep source rows and administrator decisions intact; filter only this public read model.
if($run){try{$actCollection=nwm_act_load($db,$run,$videos);$videos=array_diff_key($videos,ny_official_members($db,$run),array_fill_keys(array_column($actCollection['videos'],'videoId'),true));unset($playlists[NWM_PLAYLIST],$playlists[NWM_ACT_PLAYLIST]);}
 catch(Throwable $e){$videos=[];$error=true;error_log('[noa-youtube-official-membership] '.get_class($e));}}
$inlineEdits=[];$inlineActLabels=[];
if(!$error&&isset($db)&&is_file(__DIR__.'/noa-bridge/inline-edit.php')){require_once __DIR__.'/noa-bridge/inline-edit.php';$inlineEdits=nie_overrides($db);foreach($videos as $id=>&$v){$f=nie_fields($inlineEdits,['key'=>$id,'video'=>$id,'orderKey'=>$v['match']['songId']??'']);if(isset($f['title']))$v['snippet']['title']=$f['title'];}unset($v);}
$browseRows=[];
foreach($videos as $id=>$v){if(($v['status']['privacyStatus']??'')!=='public'||empty($v['status']['embeddable'])||isset($_GET['world'])&&($v['classification']??'')!=='official_mv')continue;$song=$songIndex[$v['match']['songId']??'']??null;$canonicalUrl=(string)($song['fields']['youtubeUrl']??'');if(function_exists('nie_fields')){$canonical=nie_fields($inlineEdits,['key'=>$id,'video'=>$id,'orderKey'=>$v['match']['songId']??'']);$canonicalUrl=(string)($canonical['youtubeUrl']??$canonicalUrl);}$browseRows[]=['key'=>$id,'orderKey'=>$v['match']['songId']??'','title'=>$v['snippet']['title']??'NOA Music','genre'=>$song['genre_id']??'unclassified','ep'=>$song['ep']??'','act'=>'','kind'=>'video','video'=>$id,'preferredVideo'=>ny_video_id($canonicalUrl)===$id];}
if($inlineEdits)$inlineActLabels=nie_act_labels($inlineEdits,$browseRows);
// Explicit legacy document URLs are authoritative even when an older catalog
// availability snapshot has not marked that imported version public_verified.
function noa_video_legacy_lyrics(iterable $documents,bool $admin):array{
 $byVideo=[];
 foreach($documents as $row){
  $doc=json_decode((string)$row['payload'],true);if(!is_array($doc)||!noa_sound_visible($doc,$admin))continue;
  $body=$doc['body']??[];if(!is_array($body))continue;$id=ny_video_id((string)($body['youtubeUrl']??''));$lyrics=$body['lyricsBlock']??'';
  if(!$id||!is_string($lyrics)||trim($lyrics)==='')continue;
  $byVideo[$id][(string)$row['doc_key']]=$lyrics;
 }
 return $byVideo;
}
/** Listener display only: Suno bracket directives are not sung lyrics. Stored source stays intact. */
function noa_video_display_lyrics(string $raw):string{
 $text=preg_replace('/\[[^\]]*\]/u','',$raw)??$raw;
 $text=preg_replace('/^\h*```[^\r\n]*\h*$/mu','',$text)??$text;
 return trim(preg_replace('/(?:\r?\n){3,}/u',"\n\n",$text)??$text);
}
/** Pure projection shared by the endpoint and mapping regression tests. */
function noa_video_detail(string $id,array $video,array $songIndex,array $legacyLyrics,bool $admin,array $siteFields=[]):?array{
 if(($video['status']['privacyStatus']??'')!=='public'||empty($video['status']['embeddable']))return null;
 $match=$video['match']??[];$song=$songIndex[$match['songId']??'']??null;
 $allowed=$song&&in_array($match['status']??'',['matched','approved'],true)&&($admin||!empty($song['public_verified']))&&noa_sound_visible($song['fields']??[],$admin);
 $lyrics=$allowed?(string)($song['fields']['lyricsBlock']??''):'';
 // Never override an explicit rejection/conflict, or choose among duplicate URLs.
 if($lyrics===''&&!in_array($match['status']??'',['rejected','conflict'],true)&&count($legacyLyrics[$id]??[])===1)$lyrics=array_values($legacyLyrics[$id])[0];
 return ['videoId'=>$id,'description'=>(string)($siteFields['description']??$video['snippet']['description']??''),'lyrics'=>noa_video_display_lyrics(array_key_exists('lyrics',$siteFields)?$siteFields['lyrics']:$lyrics)];
}
// Full text is read only for an exact selected public, embeddable, non-world video.
if($detailRequested){
 if($error){http_response_code(503);echo '{"ok":false,"error":"detail_unavailable"}';exit;}
 $detailVideo=$videos[$detailId]??null;
 if(!$detailVideo||($detailVideo['status']['privacyStatus']??'')!=='public'||empty($detailVideo['status']['embeddable'])){http_response_code(404);echo '{"ok":false,"error":"video_not_available"}';exit;}
$legacyLyrics=[];
try{$legacyLyrics=noa_video_legacy_lyrics($db->query("SELECT doc_key,payload FROM noa_documents WHERE kind IN ('single','story') ORDER BY doc_key"),$admin);}catch(Throwable $e){error_log('[noa-youtube-lyrics] '.get_class($e));http_response_code(503);echo '{"ok":false,"error":"detail_unavailable"}';exit;}
$detail=noa_video_detail($detailId,$detailVideo,$songIndex,$legacyLyrics,$admin,$inlineEdits?nie_fields($inlineEdits,['key'=>$detailId,'video'=>$detailId,'orderKey'=>$detailVideo['match']['songId']??'']):[]);
 header('Vary: Cookie',false);
 echo json_encode(['ok'=>true]+$detail,JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT|JSON_THROW_ON_ERROR);exit;
}
// Private YouTube availability never removes an otherwise visible MUSIC song.
if(!$error&&!$playlistUnavailable&&isset($db)&&is_file(__DIR__.'/noa-bridge/youtube-catalog.php')){
 require_once __DIR__.'/noa-bridge/youtube-catalog.php';
 $listenerCatalog=ny_listener_catalog($db,$admin,$inlineEdits);
 if(isset($_GET['playlist'])){$ids=array_fill_keys(array_keys($videos),true);$members=array_fill_keys(array_filter(array_map(fn($v)=>$v['match']['songId']??null,$videos)),true);$listenerCatalog=array_filter($listenerCatalog,fn($r)=>isset($members[$r['orderKey']])||isset($ids[$r['canonicalVideo']??'']));}
 $browseRows=ny_complete_catalog_rows($browseRows,$videos,$listenerCatalog);
 if($inlineEdits)$inlineActLabels=nie_act_labels($inlineEdits,$browseRows);
}
$comingRows=array_values(array_filter($browseRows,fn($r)=>!empty($r['comingSoon'])));
function nye(string $s):string{return htmlspecialchars($s,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');}
?><!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>YouTube | NOA STUDIO</title><link rel="stylesheet" href="/noa-ui.css?v=20261024-category-final"><link rel="stylesheet" href="/noa-ai-lab.css"><link rel="stylesheet" href="/noa-app/p0-media.css?v=20261022-p0a"><link rel="stylesheet" href="/noa-youtube.css?v=<?=hash_file('sha256',__DIR__.'/noa-youtube.css')?>"><script src="/noa-brand.js?v=20261021-brand1" defer></script><script src="/noa-ui.js?v=20261022-recovery1" defer></script><script src="/noa-browse.js?v=<?=hash_file('sha256',__DIR__.'/noa-browse.js')?>" defer></script><script src="/noa-youtube.js?v=<?=hash_file('sha256',__DIR__.'/noa-youtube.js')?>" defer></script><script src="/noa-history.js?v=20261021-history1" defer></script><style>#songs[hidden],#yt-videos[hidden]{display:none!important}</style><noscript><style>#songs[hidden],#yt-videos[hidden]{display:grid!important}</style></noscript><script data-noa-browse-watchdog>(function(){window.setTimeout(function(){var host=document.querySelector('[data-noa-browse-boot]');if(!host||host.dataset.browseReady==='true')return;var status=host.querySelector('[role="status"]');if(!status){status=document.createElement('p');status.setAttribute('role','status');host.append(status);}status.textContent='목록을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.';var retry=document.createElement('button');retry.type='button';retry.textContent='다시 불러오기';retry.onclick=function(){location.reload();};host.append(retry);},8000);})();</script></head><body class="noa-page"><main><p class="noa-eyebrow">NOA STUDIO / WATCH & GROW</p><h1>YouTube</h1><p class="noa-muted">음악에 장면을 더하고, 다음 이야기를 발견하세요.</p><nav class="yt-toolbar"><a data-noa-icon="music" href="/noa-music.php">음악</a><a data-noa-icon="library" href="/noa-catalog.php">통합 라이브러리</a><a data-noa-icon="youtube" href="/noa-youtube.php">음악 영상</a><a data-noa-icon="book" href="/noa-world.php">NOA WORLD · 공식 MV</a><?php if($admin):?><a data-noa-icon="settings" href="/noa-youtube-admin.php">채널·성장 관리</a><?php endif;?></nav><section id="yt-player" class="lab-panel" hidden><h2 id="yt-playing"></h2><iframe id="yt-frame" title="NOA STUDIO 공식 YouTube 플레이어" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe><div id="yt-coming-preview" hidden><img id="yt-coming-art" alt="Coming soon"><p class="noa-muted">공개 준비 중입니다. 영상이 공개되면 이 자리에서 재생할 수 있습니다.</p></div><div class="noa-media-details"><details id="youtube-description"><summary>설명 펼치기</summary><pre id="youtube-description-text">등록된 설명이 없습니다.</pre><a id="youtube-original" target="_blank" rel="noopener noreferrer" class="noa-button">YouTube 원본</a></details><details id="youtube-lyrics"><summary>가사 펼치기</summary><pre id="youtube-lyrics-text">등록된 가사가 없습니다.</pre></details></div></section><?php if($playlistUnavailable):?><p role="status">이 재생목록은 공개 확인되지 않았습니다.</p><?php elseif($error):?><p role="status">음악 영상 정보를 읽지 못했습니다. 잠시 후 다시 열어 주세요.</p><?php elseif(!$run):?><p class="noa-muted">공개된 음악 영상을 만나보세요.</p><?php endif;?><section id="youtube-browse" class="noa-browse" data-noa-browse-boot aria-label="YouTube 탐색"><p role="status">카테고리를 불러오는 중입니다.</p></section><label class="noa-video-search">전체 영상 검색<input id="youtube-search" type="search" placeholder="제목으로 검색"></label><div class="yt-grid" id="yt-videos" hidden><?php $shown=0;foreach($videos as $id=>$v):if(($v['status']['privacyStatus']??'')!=='public'||empty($v['status']['embeddable']))continue;if(isset($_GET['world'])&&($v['classification']??'')!=='official_mv')continue;$shown++;?><article class="yt-card" data-browse-key="<?=nye($id)?>"><button class="yt-watch" data-video="<?=nye($id)?>" data-title="<?=nye($v['snippet']['title']??'NOA Music')?>" aria-label="<?=nye(($v['snippet']['title']??'NOA Music').' 재생')?>"><img loading="lazy" src="/noa-bridge/youtube-thumbnail.php?id=<?=nye($id)?>" alt=""><span class="yt-play" aria-hidden="true">▶</span></button><h2><?=nye($v['snippet']['title']??'NOA Music')?></h2><p class="noa-muted">음악 영상<?php if(isset($v['statistics']['viewCount'])):?> · 조회 <?=number_format((float)$v['statistics']['viewCount'])?><?php endif;?></p></article><?php endforeach;?><?php foreach($comingRows as $r):$shown++;?><article class="yt-card yt-coming-card" data-browse-key="<?=nye($r['key'])?>" data-availability="coming-soon"><button class="yt-watch yt-coming" type="button" data-coming-key="<?=nye($r['key'])?>" data-title="<?=nye($r['title'])?>" data-coming-art="<?=nye($r['thumb'])?>" data-coming-overlay="<?=$r['comingOverlay']?'true':'false'?>" aria-label="<?=nye($r['title'].' 공개 준비 미리보기')?>"><img loading="lazy" src="<?=nye($r['thumb'])?>" alt="Coming soon"><?php if($r['comingOverlay']):?><span class="yt-coming-label">Coming Soon</span><?php endif;?></button><h2><?=nye($r['title'])?></h2><p class="noa-muted">Coming soon · 공개 준비 중</p></article><?php endforeach;?></div><?php if(!$shown):?><p>표시할 영상이 없습니다. 공식 MV는 관리자가 확인한 영상부터 표시합니다.</p><?php endif;?><?php if($playlists):?><section id="youtube-playlists" class="lab-panel"><h2>YouTube 재생목록</h2><?php foreach($playlists as $pid=>$p):?><p><a data-noa-icon="playlists" href="?playlist=<?=nye($pid)?>"><span><?=nye($p['snippet']['title']??'재생목록')?></span><?php if(isset($p['contentDetails']['itemCount'])):?><small><?=(int)$p['contentDetails']['itemCount']?>개 영상</small><?php endif;?></a></p><?php endforeach;?></section><?php endif;?><?php if(isset($_GET['playlist'])&&isset($playlists[$_GET['playlist']])):$q=$db->prepare('SELECT video_id,position FROM noa_youtube_items WHERE run_id=? AND playlist_id=? ORDER BY position,item_id');$q->execute([$run['run_id'],$_GET['playlist']]);?><section class="lab-panel"><h2><?=nye($playlists[$_GET['playlist']]['snippet']['title'])?> · 원본 순서</h2><?php foreach($q as $item):$v=$videos[$item['video_id']]??null;if(!$v||($v['status']['privacyStatus']??'')!=='public')continue;?><p><?=1+(int)$item['position']?>. <button class="yt-text-play" data-video="<?=nye($v['id'])?>" data-title="<?=nye($v['snippet']['title'])?>"><?=nye($v['snippet']['title'])?></button></p><?php endforeach;?></section><?php endif;?></main><script type="application/json" id="noa-act-labels" data-edit-revision="<?=is_file(__DIR__.'/noa-browse-edit.js')?hash_file('sha256',__DIR__.'/noa-browse-edit.js'):'20261025-inline-edit-2'?>"><?=json_encode($inlineActLabels,JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT|JSON_THROW_ON_ERROR)?></script><script>
window.NoaVideoDetails={};window.NoaVideoDetailEndpoint='/noa-youtube.php';
window.addEventListener('DOMContentLoaded',()=>{const rows=<?=json_encode($browseRows,JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT|JSON_THROW_ON_ERROR)?>,search=document.getElementById('youtube-search'),cards=[...document.querySelectorAll('[data-browse-key]')];let browse;const render=()=>{if(!browse)return;const q=search.value.trim().toLowerCase(),base=rows.filter(r=>!q||r.title.toLowerCase().includes(q)),view=browse.apply(base),keys=new Set(view.visible.map(r=>r.key));for(const c of cards)c.hidden=!keys.has(c.dataset.browseKey);document.getElementById('yt-videos').append(...view.visible.map(r=>cards.find(c=>c.dataset.browseKey===r.key)).filter(Boolean));document.getElementById('yt-videos').hidden=view.stage!=='songs';};browse=window.NoaBrowse.mount({host:document.getElementById('youtube-browse'),rows,onChange:render,search,kind:'영상'});const focus=rows.find(r=>r.key===new URLSearchParams(location.search).get('track'));if(focus)search.value=focus.title;render();if(focus&&new URLSearchParams(location.search).get('play')==='1'){document.querySelector('.yt-watch[data-video="'+focus.key+'"]')?.click();}});
</script></body></html>
