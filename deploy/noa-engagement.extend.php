<?php
if(!defined('_GNUBOARD_'))exit;
(static function(){
 $path=parse_url($_SERVER['REQUEST_URI']??'',PHP_URL_PATH)??'';
 if(($_SERVER['REQUEST_METHOD']??'GET')!=='GET'||!(in_array($path,['/','/index.php','/noa-music.php','/noa-youtube.php','/noa-world.php','/noa-catalog.php','/noa-notifications.php','/noa-channel.php','/noa-creator.php','/noa-creator-ai.php','/noa-lab.php','/noa-support.php'],true)||str_starts_with($path,'/bbs/')))return;
 ob_start(static function($html){
  if(http_response_code()>=300||stripos($html,'</head>')===false||str_contains($html,'/noa-engagement.js'))return $html;
  $root=dirname(__DIR__);$assets='';foreach(['css','js']as $kind){$file=$root.'/noa-engagement.'.$kind;if(!is_file($file))return $html;$url='/noa-engagement.'.$kind.'?v='.hash_file('sha256',$file);$assets.=$kind==='css'?'<link rel="stylesheet" href="'.$url.'">':'<script src="'.$url.'" defer></script>';}
  foreach(['css','js']as $kind){$file=$root.'/noa-support.'.$kind;if(is_file($file)){$url='/noa-support.'.$kind.'?v='.hash_file('sha256',$file);$assets.=$kind==='css'?'<link rel="stylesheet" href="'.$url.'">':'<script src="'.$url.'" defer></script>';}}
  $native=null;$board=(string)($GLOBALS['bo_table']??'');$id=(int)($GLOBALS['wr_id']??0);
  if($id>0&&$board!=='song_request'&&preg_match('/^[A-Za-z0-9_]{1,20}$/D',$board))$native=['type'=>'board','key'=>$board.':'.$id];
  $assets.='<script type="application/json" id="noa-engagement-context">'.json_encode(['member'=>!empty($GLOBALS['member']['mb_id']),'native'=>$native],JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT).'</script>';
  return str_ireplace('</head>',$assets.'</head>',$html);
 });
})();
