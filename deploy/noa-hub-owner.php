<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');header('X-Content-Type-Options: nosniff');
require_once __DIR__.'/noa-app/engine/hub.php';
try{
 if(($_SERVER['REQUEST_METHOD']??'GET')!=='GET')throw new InvalidArgumentException('method');
 $op=(string)($_GET['operation']??'');if(!isset(n80_hub_operations()[$op]))throw new InvalidArgumentException('operation');
 echo json_encode(['ok'=>true,'operation'=>$op,'owner'=>n80_hub_owner($op)]);
}catch(Throwable $e){http_response_code(503);echo '{"ok":false,"error":"hub_ownership_unavailable"}';}
