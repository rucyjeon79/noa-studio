<?php
// Isolated PHP-rendered fixture. Never uploaded to the operating site.
$root=dirname(__DIR__,2);$path=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH);
if($path==='/noa-bridge/ui-preferences.php'){header('Content-Type: application/json');echo json_encode(['revision'=>0,'member'=>false,'admin'=>false,'settings'=>null,'defaults'=>['enabled'=>['noa-studio','noa-ivory'],'theme'=>'noa-studio']]);return;}
if($path==='/noa-bridge/user-playlists.php'){http_response_code(401);header('Content-Type: application/json');echo '{}';return;}
if($path==='/noa-sw.js'){http_response_code(404);return;}
if($path==='/fixture.wav'){header('Content-Type: audio/wav');$data='';for($i=0;$i<16000*90;$i++)$data.=pack('v',(int)(sin($i*440*2*pi()/16000)*8000)&65535);echo 'RIFF'.pack('V',36+strlen($data)).'WAVEfmt '.pack('VvvVVvv',16,1,1,16000,32000,2,16).'data'.pack('V',strlen($data)).$data;return;}
if(in_array($path,['/noa-music.php','/noa-youtube.php'])){
 define('_GNUBOARD_',true);$admin=false;$is_member=false;$is_admin='';$error=false;$playlistUnavailable=false;$run=null;$collections=[];$jukebox=[];$genres=[];
 function noa_music_e(string $v):string{return htmlspecialchars($v,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');}
 $songs=[];foreach(['one','two'] as $i=>$key)$songs[]=['key'=>$key,'title'=>$i?'A very long title repeated for marquee testing across small and large screens':'하루의 끝에','genre'=>'kpop-original','video'=>'','suno'=>'','audio'=>'/fixture.wav','audioStatus'=>'ready','audioSha'=>'','audioBytes'=>0,'confirmed'=>true,'ep'=>(string)($i+1),'act'=>'','kind'=>'single','lyrics'=>'display lyrics','rawLyrics'=>"[Verse 1]\n원문 줄\n\n[Chorus]\n후렴",'description'=>$i?'':"곡 이야기\n둘째 줄",'cast'=>'female','thumb'=>'','tracklist'=>'','originalArtist'=>''];
 $videos=[];$playlists=[];$browseRows=[];$mediaDetails=[];foreach(['AAAAAAAAAAA','BBBBBBBBBBB'] as $i=>$id){$videos[$id]=['id'=>$id,'snippet'=>['title'=>'영상 '.($i+1)],'status'=>['privacyStatus'=>'public','embeddable'=>true]];$browseRows[]=['key'=>$id,'title'=>'영상 '.($i+1),'genre'=>'kpop-original','ep'=>(string)($i+1),'act'=>'','kind'=>'video','video'=>$id];$mediaDetails[$id]=['videoId'=>$id,'description'=>'설명 '.($i+1),'lyrics'=>$i?'':"[Verse]\n공식 가사"] ;}
 $src=file_get_contents($root.'/deploy'.$path);$offset=strpos($src,$path==='/noa-youtube.php'?'function nye(':'?><!doctype html>');eval(substr($src,$offset));return;
}
if(in_array($path,['/','/index.php','/noa-my.php','/noa-world.php','/noa-settings.php'])){echo '<!doctype html><html><head><title>App view</title><link rel="stylesheet" href="/noa-ui.css"></head><body class="noa-page"><main><h1>App view</h1><a href="/noa-music.php">음원 돌아가기</a><a href="/noa-youtube.php">영상으로</a></main></body></html>';return;}
$file=$root.'/deploy'.$path;if(is_file($file)){header('Content-Type: '.match(pathinfo($file,PATHINFO_EXTENSION)){'js'=>'text/javascript','css'=>'text/css','json'=>'application/json',default=>'application/octet-stream'});readfile($file);return;}http_response_code(404);
