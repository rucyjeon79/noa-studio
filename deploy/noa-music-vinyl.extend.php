<?php
if(!defined('_GNUBOARD_'))exit;
if(parse_url($_SERVER['REQUEST_URI']??'',PHP_URL_PATH)==='/noa-music.php' && ($_SERVER['REQUEST_METHOD']??'GET')==='GET'){
 ob_start(static function($html){
  if(strpos($html,'id="sound-player"')===false || strpos($html,'/noa-music-vinyl.js')!==false)return $html;
  $base=dirname(__DIR__);
  $assets='<link rel="stylesheet" href="/noa-music-vinyl.css?v='.hash_file('sha256',$base.'/noa-music-vinyl.css').'"><script defer src="/noa-music-vinyl.js?v='.hash_file('sha256',$base.'/noa-music-vinyl.js').'"></script>';
  $counts=[];
  $visible=array_fill_keys(array_column($GLOBALS['songs']??[],'key'),true);
  try{
   // Use the same canonical song and accepted events as the published ranking.
   $bySong=noa_bridge_pdo()->query('SELECT song_id,COUNT(*) FROM noa_valid_plays GROUP BY song_id')->fetchAll(PDO::FETCH_KEY_PAIR);
   $counts['plays']=[];
   foreach($GLOBALS['songs']??[] as $song){
    $sid=$song['catalogSongId']??null;
    if($sid!==null && isset($bySong[$sid]))$counts['plays'][$song['key']]=(int)$bySong[$sid];
   }
  }catch(Throwable $error){$counts['plays']=null;error_log('[noa-track-counts] plays unavailable');}
  foreach(['downloads'=>'SELECT song_key,COUNT(*) AS total FROM noa_jukebox_downloads GROUP BY song_key'] as $metric=>$query){
   try{
    $counts[$metric]=[];
    foreach(noa_bridge_pdo()->query($query) as $row){
     if(isset($visible[$row['song_key']]))$counts[$metric][$row['song_key']]=(int)$row['total'];
    }
   }catch(Throwable $error){$counts[$metric]=null;error_log('[noa-track-counts] '.$metric.' unavailable');}
  }
  if(($_SERVER['HTTP_X_NOA_TRACK_TOTALS']??'')==='1'){
   if(!headers_sent()){header('Content-Type: application/json; charset=utf-8');header('Cache-Control: private, no-store');}
   return json_encode($counts,JSON_THROW_ON_ERROR);
  }
  $assets.='<script type="application/json" id="noa-track-counts">'.json_encode($counts,JSON_HEX_TAG|JSON_THROW_ON_ERROR).'</script>';
  return str_ireplace('</head>',$assets.'</head>',$html);
 });
}
