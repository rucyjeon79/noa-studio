<?php
declare(strict_types=1);
ini_set('display_errors','0');header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');
if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||time()>NOA_COMMUNITY_EXPIRY||!hash_equals('NOA_COMMUNITY_TOKEN_SHA',hash('sha256',(string)($_SERVER['HTTP_X_NOA_CONTROL']??'')))){http_response_code(404);exit;}
$buffer=ob_get_level();ob_start();require_once dirname(__DIR__).'/common.php';require_once __DIR__.'/community-install.php';
try{$result=nc_install();while(ob_get_level()>$buffer)ob_end_clean();echo json_encode(['ok'=>true]+$result,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);}
catch(Throwable $e){while(ob_get_level()>$buffer)ob_end_clean();http_response_code(500);echo json_encode(['ok'=>false,'error'=>$e->getMessage()]);}
