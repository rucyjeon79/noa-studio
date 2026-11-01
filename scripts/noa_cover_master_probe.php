<?php
declare(strict_types=1);
if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||time()>NOA_CREATOR_EXPIRY||!hash_equals('NOA_CREATOR_TOKEN_SHA',hash('sha256',$_SERVER['HTTP_X_NOA_CONTROL']??''))){http_response_code(404);exit;}
ob_start();
require_once dirname(__DIR__).'/common.php';
require_once __DIR__.'/storage.php';
require_once __DIR__.'/sound-core.php';
require_once __DIR__.'/music-readmodel.php';
require_once dirname(__DIR__).'/noa-app/jukebox/core.php';
$db=noa_bridge_pdo();
$key='story:cover-reborn:9ecbe3b1555c8ecfb713e71b';
$doc=nj_document($db,$key);
$asset=nj_find($db,$key);
$source=noa_sound_suno($doc['body']??[]);
$stored=$asset?nj_asset_source($asset,'audio'):'';
$rows=[];
foreach(nj_assets($db) as $id=>$r){
 if($id!==$key && !str_contains(preg_replace('/\s+/u','',(string)$r['title']),'미워도사랑하니까'))continue;
 $rows[]=['key'=>$id,'status'=>$r['status'],'verified'=>nj_verified($r,'audio'),'sourceMatch'=>nj_asset_source($r,'audio')===$source,'catalogURL'=>noa_music_asset_url([$id=>$r],$id,$source,'audio')!==''];
}
$receipt=['doc'=>!!$doc,'assets'=>$rows,'docSourceHost'=>parse_url($source,PHP_URL_HOST),'assetSourceHost'=>parse_url($stored,PHP_URL_HOST),'samePath'=>parse_url($source,PHP_URL_PATH)===parse_url($stored,PHP_URL_PATH),'bodyAudio'=>noa_sound_audio($doc['body']??[],dirname(__DIR__))!==''];
ob_end_clean();header('Content-Type: application/json');echo json_encode($receipt,JSON_THROW_ON_ERROR);
