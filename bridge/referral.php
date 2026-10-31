<?php
declare(strict_types=1);
ini_set('display_errors','0');$buffer=ob_get_level();ob_start();require_once dirname(__DIR__).'/common.php';while(ob_get_level()>$buffer)ob_end_clean();require_once __DIR__.'/referral-core.php';
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: private, no-store');header('X-Content-Type-Options: nosniff');
try{
 if(($_SERVER['REQUEST_METHOD']??'GET')!=='GET'){http_response_code(405);echo json_encode(['ok'=>false]);exit;}
 if(empty($member['mb_id'])){echo json_encode(['ok'=>true,'member'=>false,'invited'=>nrf_session_invite($_SESSION,time())!==null]);exit;}
 echo json_encode(['ok'=>true,'member'=>true,'url'=>nrf_link((string)$member['mb_id']),'pointsEach'=>500],JSON_UNESCAPED_SLASHES);
}catch(Throwable $e){http_response_code(503);echo json_encode(['ok'=>false,'message'=>'초대 링크를 준비하지 못했어요. 잠시 후 다시 시도해 주세요.']);error_log('[noa-referral-link] '.get_class($e));}
