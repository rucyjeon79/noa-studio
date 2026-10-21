<?php
// CI-only rendering harness. Never deploy this file or its public-source snapshot.
$root=dirname(__DIR__,2);$path=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH);
if(str_starts_with($path,'/noa-assets/')||str_starts_with($path,'/noa-bridge/youtube-thumbnail.php')){header('Location: https://noastudio.ai.kr'.$_SERVER['REQUEST_URI'],true,302);exit;}
if($path!=='/noa-world.php')return false;
require $root.'/bridge/world-core.php';require $root.'/bridge/world-mv.php';require $root.'/bridge/world-story.php';
$source=json_decode(file_get_contents(getenv('NOA_WORLD_SOURCE')),true,512,JSON_THROW_ON_ERROR);$world=nwm_build($source['playlist'],$source['items'],$source['videos']);$world['collectedAt']='CI public-source verification · production collection timestamp not asserted';
$acts=[];$selected=null;$tracks=[];$error=false;$mvError=false;$missing=false;$genre='kpop-original';$id='';$story=filter_var($_GET['story']??null,FILTER_VALIDATE_INT,['options'=>['min_range'=>1,'max_range'=>4]])?:null;$episode=filter_var($_GET['ep']??null,FILTER_VALIDATE_INT,['options'=>['min_range'=>1,'max_range'=>40]])?:null;
header('X-NOA-Test-Environment: isolated-ci-not-production');require $root.'/deploy/noa-app/world-view.php';
