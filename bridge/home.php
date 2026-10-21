<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/common.php';require_once __DIR__.'/storage.php';require_once __DIR__.'/youtube-store.php';require_once __DIR__.'/home-store.php';
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: private, no-store');header('X-Content-Type-Options: nosniff');
try{
 $db=noa_bridge_pdo();$run=ny_latest($db);if(!$run||$run['channel_id']!=='UCwYy9xsAqDFat6AV5UKrfgA')throw new DomainException('verified_channel_collection_required');
 $data=nh_load($db,$run);$report=json_decode($run['report'],true,512,JSON_THROW_ON_ERROR);$data['collectedAt']=$report['completedAt']??$run['created_at'];$data['runId']=$run['run_id'];$data['ok']=true;echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
}catch(Throwable $e){http_response_code(503);error_log('[noa-home-read] '.get_class($e));echo json_encode(['ok'=>false,'stories'=>[],'covers'=>[],'playlists'=>[],'diagnostics'=>['error'=>'api_or_database_error'],'error'=>'공개 영상의 집계 자료를 불러오지 못했습니다. 기존 음악 데이터는 보존되어 있습니다.']);}
