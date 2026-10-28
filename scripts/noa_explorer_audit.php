<?php
declare(strict_types=1);ini_set('display_errors','0');header('Content-Type: application/json');header('Cache-Control: no-store');
if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||time()>NOA_CREATOR_EXPIRY||!hash_equals('NOA_CREATOR_TOKEN_SHA',hash('sha256',(string)($_SERVER['HTTP_X_NOA_CONTROL']??'')))){http_response_code(404);exit;}
$buffer=ob_get_level();ob_start();require_once dirname(__DIR__).'/common.php';
try{
 require_once __DIR__.'/storage.php';require_once __DIR__.'/creator-core.php';require_once __DIR__.'/sound-core.php';require_once __DIR__.'/music-readmodel.php';require_once dirname(__DIR__).'/noa-app/jukebox/core.php';
 $db=noa_bridge_pdo();$owner=(string)$config['cf_admin'];$channel=nc_row($db,nc_channel_key($owner));if(!$channel||!nam_owner($channel['document'],['mb_id'=>$owner]))throw new RuntimeException('channel_owner');
 $records=nc_owned_records($db,$owner);$assets=nj_assets($db);$counts=['records'=>0,'songs'=>0,'collections'=>0,'verifiedCovers'=>0,'acquiredCovers'=>0,'channelFallback'=>0,'emptyCovers'=>0];
 foreach($records as $r){$d=json_decode($r['payload'],true);if(!empty($d['_noaTrash']))continue;$counts['records']++;if($r['kind']==='playlist'){$counts['collections']++;continue;}$counts['songs']++;$b=$d['body']??[];$s=noa_sound_suno($b);if(noa_music_asset_url($assets,$r['doc_key'],$s,'cover'))$counts['verifiedCovers']++;elseif(noa_sound_cover($b))$counts['acquiredCovers']++;else $counts['channelFallback']++;if(function_exists('noa_music_cover')&&noa_music_cover($assets,$r['doc_key'],$s,$b,$owner)==='')$counts['emptyCovers']++;}
 $result=['ok'=>true,'channelOwned'=>true,'counts'=>$counts,'databaseWrites'=>0,'memberRowsChanged'=>0,'pointDebits'=>0];
}catch(Throwable $e){http_response_code(500);$result=['ok'=>false,'error'=>'explorer_audit_failed','class'=>get_class($e)];}
while(ob_get_level()>$buffer)ob_end_clean();echo json_encode($result,JSON_THROW_ON_ERROR);
