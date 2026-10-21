<?php
// Local rendering only. No database, auth or production writes; never deploy this harness.
declare(strict_types=1);define('_GNUBOARD_',true);$root=dirname(__DIR__,2);$kind=$argv[1]??'home';
$is_member=($argv[2]??'')==='admin';$is_admin=$is_member?'super':'';$member=['mb_nick'=>'Local UI verification'];
if($kind==='home'){include $root.'/deploy/noa-app/home.php';}
elseif($kind==='my'){eval('?>'.str_replace(["declare(strict_types=1);","require_once __DIR__.'/common.php';"],'',file_get_contents($root.'/deploy/noa-my.php')));}
else{
 require $root.'/bridge/world-core.php';require $root.'/bridge/world-mv.php';require $root.'/bridge/world-story.php';
 $src=json_decode(file_get_contents('/tmp/noa-world-source.json'),true,512,JSON_THROW_ON_ERROR);$world=nwm_build($src['playlist'],$src['items'],$src['videos']);$world['collectedAt']='local render of public observed source';
 $acts=[];$selected=null;$tracks=[];$error=false;$mvError=false;$missing=false;$genre='kpop-original';$id='';$story=1;$episode=null;include $root.'/deploy/noa-app/world-view.php';
}
