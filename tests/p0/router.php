<?php
// Isolated PHP-rendered fixture. Never uploaded to the operating site.
$root=dirname(__DIR__,2);$path=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH);
if($path==='/noa-bridge/ui-preferences.php'){header('Content-Type: application/json');echo json_encode(['revision'=>0,'member'=>false,'admin'=>false,'settings'=>null,'defaults'=>['enabled'=>['noa-studio','noa-ivory'],'theme'=>'noa-studio']]);return;}
if($path==='/noa-bridge/user-playlists.php'){http_response_code(401);header('Content-Type: application/json');echo '{}';return;}
if($path==='/noa-music-detail.php'){header('Content-Type: application/json');$key=$_GET['key']??'';if(!in_array($key,['one','two'],true)){http_response_code(404);echo '{}';return;}echo json_encode(['key'=>$key,'rawLyrics'=>"[Verse 1]\n원문 줄\n\n[Chorus]\n후렴",'description'=>$key==='one'?"곡 이야기\n둘째 줄":''],JSON_UNESCAPED_UNICODE);return;}
if($path==='/noa-creator.php'){
 $_SESSION=['noa_creator_csrf'=>'fixture'];$access=['ownDownload'=>true];define('NC_GENRES',['your-story','cover-reborn']);function nc_e(string $s):string{return htmlspecialchars($s,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');}
 $src=str_replace('__DIR__',var_export($root.'/deploy',true),file_get_contents($root.'/deploy/noa-creator.php'));eval(substr($src,strpos($src,'?><!doctype html>')));return;
}
if($path==='/noa-work-status.php'){
 $summary=['ok'=>true,'revision'=>5,'lastActivityAt'=>'2026-10-26T05:10:00Z','areas'=>[]];$labels=['pending'=>'대기','in_progress'=>'진행 중','needs_review'=>'확인 필요','error'=>'오류','complete'=>'완료'];$tasks=[];
 foreach(range(1,7)as $number)$tasks[]=['id'=>'NOA-20261026-P0-0'.$number,'text'=>'원본 보존 및 운영 검증 '.$number,'status'=>$number===6?'needs_review':'in_progress','currentStage'=>'운영 화면 확인 중','lastSuccessfulStage'=>'원본·SQL 대조 및 회귀 검사 통과','lastActivityAt'=>$summary['lastActivityAt'],'error'=>$number===6?'API 키·사용 한도 설정 필요':'','evidence'=>[]];
 $original=file_get_contents($root.'/docs/operations/requests/NOA_20261026_P0_ADDITIONS.md');function nws_e(mixed $v):string{return htmlspecialchars((string)$v,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');}
 $src=str_replace('__DIR__',var_export($root.'/deploy',true),file_get_contents($root.'/deploy/noa-work-status.php'));eval(substr($src,strpos($src,'?><!doctype html>')));return;
}
if($path==='/noa-sw.js'){http_response_code(404);return;}
if($path==='/fixture.wav'){header('Content-Type: audio/wav');$data='';for($i=0;$i<16000*90;$i++)$data.=pack('v',(int)(sin($i*440*2*pi()/16000)*8000)&65535);echo 'RIFF'.pack('V',36+strlen($data)).'WAVEfmt '.pack('VvvVVvv',16,1,1,16000,32000,2,16).'data'.pack('V',strlen($data)).$data;return;}
if(in_array($path,['/noa-music.php','/noa-youtube.php'])){
 define('_GNUBOARD_',true);$admin=false;$is_member=false;$is_admin='';$error=false;$playlistUnavailable=false;$run=null;$collections=[];$jukebox=[];$genres=[];$musicAccess=['music'=>true];
 function noa_music_asset_url($assets,$key,$url,$type){global $songs;foreach($songs as $song)if($song['key']===$key)return $type==='audio'?$song['audio']:$song['thumb'];return '';}
 function noa_music_e(string $v):string{return htmlspecialchars($v,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');}
 $songs=[];foreach(['one','two'] as $i=>$key)$songs[]=['key'=>$key,'title'=>$i?'A very long title repeated for marquee testing across small and large screens':'하루의 끝에','genre'=>'kpop-original','video'=>'','suno'=>'','audio'=>'/fixture.wav','audioStatus'=>'ready','audioSha'=>'','audioBytes'=>0,'confirmed'=>true,'ep'=>(string)($i+1),'act'=>'','kind'=>'single','lyrics'=>'display lyrics','rawLyrics'=>"[Verse 1]\n원문 줄\n\n[Chorus]\n후렴",'description'=>$i?'':"곡 이야기\n둘째 줄",'cast'=>'female','thumb'=>'','tracklist'=>'','originalArtist'=>''];
 $videos=[];$playlists=[];$browseRows=[];$mediaDetails=[];foreach(['AAAAAAAAAAA','BBBBBBBBBBB'] as $i=>$id){$videos[$id]=['id'=>$id,'snippet'=>['title'=>'영상 '.($i+1)],'status'=>['privacyStatus'=>'public','embeddable'=>true]];$browseRows[]=['key'=>$id,'title'=>'영상 '.($i+1),'genre'=>'kpop-original','ep'=>(string)($i+1),'act'=>'','kind'=>'video','video'=>$id];$mediaDetails[$id]=['videoId'=>$id,'description'=>'설명 '.($i+1),'lyrics'=>$i?'':"[Verse]\n공식 가사"] ;}
 $src=str_replace('__DIR__',var_export($root.'/deploy',true),file_get_contents($root.'/deploy'.$path));
 if($path==='/noa-youtube.php'&&array_key_exists('detail',$_GET)){
  header('Content-Type: application/json; charset=utf-8');header('Cache-Control: private, no-store');
  if(($_SERVER['REQUEST_METHOD']??'GET')!=='GET'){http_response_code(405);header('Allow: GET');echo '{"ok":false,"error":"method_not_allowed"}';return;}
  $id=$_GET['detail'];if(!is_string($id)||!preg_match('/^[A-Za-z0-9_-]{11}$/D',$id)||array_diff(array_keys($_GET),['detail'])){http_response_code(400);echo '{"ok":false,"error":"invalid_video_id"}';return;}
  if(!isset($videos[$id])){http_response_code(404);echo '{"ok":false,"error":"video_not_available"}';return;}
  require_once $root.'/bridge/sound-core.php';
  // Execute only the real pure projection, never the production bootstrap/SQL.
  $tokens=token_get_all($src);$code=null;
  for($i=0;$i<count($tokens);$i++){
   if(!is_array($tokens[$i])||$tokens[$i][0]!==T_FUNCTION)continue;
   $j=$i+1;while(isset($tokens[$j])&&is_array($tokens[$j])&&in_array($tokens[$j][0],[T_WHITESPACE,T_COMMENT,T_DOC_COMMENT],true))$j++;
   if(!isset($tokens[$j])||!is_array($tokens[$j])||$tokens[$j][0]!==T_STRING||!in_array($tokens[$j][1],['noa_video_display_lyrics','noa_video_detail'],true))continue;
   $text='';$depth=0;$body=false;
   for($k=$i;$k<count($tokens);$k++){
    $token=$tokens[$k];$text.=is_array($token)?$token[1]:$token;
    if($token==='{'){$depth++;$body=true;}
    elseif(is_array($token)&&in_array($token[0],[T_CURLY_OPEN,T_DOLLAR_OPEN_CURLY_BRACES],true))$depth++;
    elseif($token==='}'&&$body&&--$depth===0){$code=($code??'').$text;break;}
   }
  }
  if($code===null)throw new RuntimeException('missing_fixture_projection');eval($code);
  $video=$videos[$id];$video['snippet']['description']=$mediaDetails[$id]['description'];$video['match']=['status'=>'matched','songId'=>'fixture-song'];
  $fixtureSongs=['fixture-song'=>['public_verified'=>true,'fields'=>['lyricsBlock'=>$mediaDetails[$id]['lyrics']]]];
  $detail=noa_video_detail($id,$video,$fixtureSongs,[],false);
  if($detail===null)throw new RuntimeException('fixture_projection_rejected');
  echo json_encode(['ok'=>true]+$detail,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);return;
 }
 $offset=strpos($src,$path==='/noa-youtube.php'?'function nye(':'?><!doctype html>');eval(substr($src,$offset));return;
}
if(in_array($path,['/','/index.php','/noa-my.php','/noa-world.php','/noa-settings.php'])){echo '<!doctype html><html><head><title>App view</title><link rel="stylesheet" href="/noa-ui.css"></head><body class="noa-page"><main><h1>App view</h1><a href="/noa-music.php">음원 돌아가기</a><a href="/noa-youtube.php">영상으로</a></main></body></html>';return;}
$file=$root.'/deploy'.$path;if(is_file($file)){header('Content-Type: '.match(pathinfo($file,PATHINFO_EXTENSION)){'js'=>'text/javascript','css'=>'text/css','json'=>'application/json',default=>'application/octet-stream'});readfile($file);return;}http_response_code(404);

