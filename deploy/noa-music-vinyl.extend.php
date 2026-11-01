<?php
if(!defined('_GNUBOARD_'))exit;
if(parse_url($_SERVER['REQUEST_URI']??'',PHP_URL_PATH)==='/noa-music.php' && ($_SERVER['REQUEST_METHOD']??'GET')==='GET'){
 ob_start(static function($html){
  if(strpos($html,'id="sound-player"')===false || strpos($html,'/noa-music-vinyl.js')!==false)return $html;
  $base=dirname(__DIR__);
  $assets='<link rel="stylesheet" href="/noa-music-vinyl.css?v='.hash_file('sha256',$base.'/noa-music-vinyl.css').'"><script defer src="/noa-music-vinyl.js?v='.hash_file('sha256',$base.'/noa-music-vinyl.js').'"></script>';
  $counts=[];
  $visible=array_fill_keys(array_column($GLOBALS['songs']??[],'key'),true);
  foreach(['plays'=>'SELECT s.song_key,COUNT(*) AS total FROM noa_valid_plays p JOIN noa_play_sessions s ON s.token=p.token GROUP BY s.song_key','downloads'=>'SELECT song_key,COUNT(*) AS total FROM noa_jukebox_downloads GROUP BY song_key'] as $metric=>$query){
   try{
    $counts[$metric]=[];
    foreach(noa_bridge_pdo()->query($query) as $row){
     if(isset($visible[$row['song_key']]))$counts[$metric][$row['song_key']]=(int)$row['total'];
    }
   }catch(Throwable $error){$counts[$metric]=null;error_log('[noa-track-counts] '.$metric.' unavailable');}
  }
  $assets.='<script type="application/json" id="noa-track-counts">'.json_encode($counts,JSON_HEX_TAG|JSON_THROW_ON_ERROR).'</script>';
  return str_ireplace('</head>',$assets.'</head>',$html);
 });
}
