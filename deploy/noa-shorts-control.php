<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';
header('Cache-Control: private, no-store');
if(empty($is_member)||($is_admin??'')!=='super'){http_response_code(403);exit('관리자 로그인이 필요합니다.');}
if(($_SERVER['REQUEST_METHOD']??'GET')==='POST'){
 http_response_code(410);header('Content-Type: application/json; charset=utf-8');
 echo json_encode(['ok'=>false,'error'=>'automatic_shorts_retired','executionAllowed'=>false],JSON_THROW_ON_ERROR);exit;
}
header('Location: /noa-ai-lab.php?tool=create',true,303);exit;
