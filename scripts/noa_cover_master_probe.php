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
$db->beginTransaction();
foreach(['SELECT doc_key FROM noa_documents WHERE doc_key=? FOR UPDATE','SELECT song_key FROM noa_jukebox_assets WHERE song_key=? FOR UPDATE'] as $sql){
 $q=$db->prepare($sql);$q->execute([$key]);if(!$q->fetchColumn())throw new RuntimeException('missing_target');
}
$doc=nj_document($db,$key);
$asset=nj_find($db,$key);
$source=noa_sound_suno($doc['body']??[]);
$stored=$asset?nj_asset_source($asset,'audio'):'';
if($stored==='' && $source!=='' && ($doc['genreId']??'')==='cover-reborn' && nj_verified($asset,'audio')){
 $sha=json_decode($asset['source_analysis']??'',true)['sha256']??'';
 $q=$db->prepare("SELECT COUNT(*) FROM noa_jukebox_uploads WHERE song_key=? AND sha256=? AND status='ready'");
 $q->execute([$key,$sha]);
 if(!preg_match('/^[a-f0-9]{64}$/D',$sha)||!$q->fetchColumn())throw new RuntimeException('missing_upload_proof');
 $q=$db->prepare("UPDATE noa_jukebox_assets SET source_url=? WHERE song_key=? AND source_url='' AND audio_sha256=?");
 $q->execute([$source,$key,$asset['audio_sha256']]);
 if($q->rowCount()!==1)throw new RuntimeException('source_changed');
}
$rows=[];
foreach(nj_assets($db) as $id=>$r){
 if($id!==$key && !str_contains(preg_replace('/\s+/u','',(string)$r['title']),'미워도사랑하니까'))continue;
 $rows[]=['key'=>$id,'status'=>$r['status'],'verified'=>nj_verified($r,'audio'),'sourceMatch'=>nj_asset_source($r,'audio')===$source,'catalogURL'=>noa_music_asset_url([$id=>$r],$id,$source,'audio')!==''];
}
$receipt=['doc'=>!!$doc,'assets'=>$rows,'docSourceHost'=>parse_url($source,PHP_URL_HOST),'assetSourceHost'=>parse_url($stored,PHP_URL_HOST),'samePath'=>parse_url($source,PHP_URL_PATH)===parse_url($stored,PHP_URL_PATH),'bodyAudio'=>noa_sound_audio($doc['body']??[],dirname(__DIR__))!==''];
if(count($rows)!==1 || !$rows[0]['verified'] || !$rows[0]['catalogURL'])throw new RuntimeException('catalog_readback_failed');
$db->commit();
ob_end_clean();header('Content-Type: application/json');echo json_encode($receipt,JSON_THROW_ON_ERROR);
