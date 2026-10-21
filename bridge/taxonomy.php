<?php
declare(strict_types=1);require_once dirname(__DIR__).'/common.php';require_once __DIR__.'/storage.php';require_once __DIR__.'/taxonomy-store.php';
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: private, no-store');header('X-Content-Type-Options: nosniff');
try{echo nt_json(nt_public_data(noa_bridge_pdo()));}catch(Throwable $e){http_response_code(503);echo nt_json(['ok'=>false,'error'=>'분류 자료를 불러오지 못했습니다.','categories'=>[],'videos'=>[]]);error_log('[noa-taxonomy-public] '.get_class($e));}
