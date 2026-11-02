<?php
declare(strict_types=1);
header('Content-Type: application/json');header('Cache-Control: no-store');
if(time()>__EXPIRY__||!hash_equals('__TOKEN_SHA__',hash('sha256',$_SERVER['HTTP_X_NOA_DIAGNOSTIC']??''))){http_response_code(403);exit;}
require dirname(__DIR__).'/common.php';
require_once __DIR__.'/storage.php';require_once __DIR__.'/notifications-sources.php';
if(session_status()===PHP_SESSION_ACTIVE)session_write_close();
$db=noa_bridge_pdo();$owner=(string)$config['cf_admin'];
if($owner===''){http_response_code(409);exit;}
$start=hrtime(true);
$rows=nnt_rows($db,'SELECT * FROM noa_notifications WHERE recipient=? AND cancelled_at IS NULL ORDER BY id DESC LIMIT 200',[$owner]);
foreach($rows as $r)nnt_source_alive($db,$r);
foreach(array_slice($rows,0,30) as $r)nnt_preview($db,$owner,$r);
$middle=hrtime(true);
nnt_one($db,'SELECT COUNT(*) AS unread FROM noa_notifications WHERE recipient=? AND read_at IS NULL AND cancelled_at IS NULL',[$owner]);
echo json_encode(['ok'=>true,'checked'=>count($rows),'previews'=>min(30,count($rows)),'oldReadMs'=>round(($middle-$start)/1e6,2),'newReadMs'=>round((hrtime(true)-$middle)/1e6,2)]);
