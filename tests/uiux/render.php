<?php
// Local rendering only. No database, auth or production writes; never deploy this harness.
declare(strict_types=1);define('_GNUBOARD_',true);$root=dirname(__DIR__,2);$kind=$argv[1]??'home';
$is_member=in_array($argv[2]??'',['admin','member'],true);$is_admin=($argv[2]??'')==='admin'?'super':'';$member=['mb_nick'=>'Local UI verification'];
if($kind==='home'){include $root.'/deploy/noa-app/home.php';}
elseif($kind==='youtube'){
 $data=json_decode(file_get_contents(getenv('NOA_YOUTUBE_SOURCE')),true,512,JSON_THROW_ON_ERROR);$videos=$data['videos'];$browseRows=$data['browseRows'];$playlists=$data['playlists'];$run=['run_id'=>'local-public-fixture'];$error=false;$playlistUnavailable=false;$admin=false;$_GET=[];
 $source=file_get_contents($root.'/deploy/noa-youtube.php');$offset=strpos($source,'function nye(');if($offset===false)throw new RuntimeException('YouTube view marker missing');eval(substr($source,$offset));
}
elseif($kind==='music'){
 $data=json_decode(file_get_contents(getenv('NOA_MUSIC_SOURCE')),true,512,JSON_THROW_ON_ERROR);$songs=$data['records'];$collections=$data['collections'];$genres=[];$error=false;$admin=$is_admin==='super';$_SESSION=['noa_jukebox_csrf'=>'isolated-ui-fixture'];
 function noa_music_e(string $v):string{return htmlspecialchars($v,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');}
 function nj_resolve($assets,$key,$url,$type){global $songs;foreach($songs as $song)if($song['key']===$key)return $type==='audio'?$song['audio']:$song['thumb'];return '';}
 $jukebox=[];foreach($songs as $song)$genres[$song['genre']]=($genres[$song['genre']]??0)+1;
 $source=file_get_contents($root.'/deploy/noa-music.php');$offset=strpos($source,'?><!doctype html>');if($offset===false)throw new RuntimeException('Music view marker missing');
 // Role presentation only: owner processing scripts must never issue requests from this fixture.
 $source=preg_replace('~<script src="/noa-app/jukebox/[^"]+" defer></script>~','',$source);eval(substr($source,$offset));
}
elseif($kind==='ailab'){$is_member=true;$is_admin='super';eval('?>'.str_replace(["declare(strict_types=1);","require_once __DIR__.'/common.php';"],'',file_get_contents($root.'/deploy/noa-ai-lab.php')));}
elseif($kind==='my'){eval('?>'.str_replace(["declare(strict_types=1);","require_once __DIR__.'/common.php';"],'',file_get_contents($root.'/deploy/noa-my.php')));}
else{
 require $root.'/bridge/world-core.php';require $root.'/bridge/world-mv.php';require $root.'/bridge/world-story.php';
 $src=json_decode(file_get_contents(getenv('NOA_WORLD_SOURCE')?:'/tmp/noa-world-source.json'),true,512,JSON_THROW_ON_ERROR);$world=nwm_build($src['playlist'],$src['items'],$src['videos']);foreach($world['videos'] as &$v){$m=$src['display'][$v['videoId']]??null;if($m){$v['songId']=$m['songId'];$v['description']=$m['description'];$v['catalogActs']=$m['catalogActs'];}}unset($v);$world['collectedAt']='local render of public observed source';
 $acts=[];$selected=null;$tracks=[];$error=false;$mvError=false;$missing=false;$genre='kpop-original';$id='';$story=$kind==='world-index'?null:(int)(substr($kind,6)?:1);$episode=null;if($story&&isset($src['stories'][$story])){$public=$src['stories'][$story];$selected=['fields'=>['title'=>$public['title']]];$tracks=$public['chapters'];}include $root.'/deploy/noa-app/world-view.php';
}
