<?php
declare(strict_types=1);
ini_set('display_errors','0');header('Content-Type: application/json');header('Cache-Control: no-store');
if(time()>__EXPIRY__||!hash_equals('__TOKEN_SHA__',hash('sha256',$_SERVER['HTTP_X_NOA_DIAGNOSTIC']??''))){http_response_code(403);exit;}
ob_start();require dirname(__DIR__).'/common.php';ob_end_clean();if(session_status()===PHP_SESSION_ACTIVE)session_write_close();
require_once __DIR__.'/storage.php';$db=noa_bridge_pdo();
$cols=$db->query('SHOW COLUMNS FROM g5_write_song_request')->fetchAll(PDO::FETCH_ASSOC);
$recent=$db->query("SELECT wr_id,wr_parent,wr_is_comment,LENGTH(wr_9) attachedKeyLength,wr_datetime FROM g5_write_song_request ORDER BY wr_id DESC LIMIT 6")->fetchAll(PDO::FETCH_ASSOC);
$limits=$db->query("SHOW TABLES LIKE 'noa_request_limits'")->fetchColumn();
echo json_encode(['ok'=>true,'databaseWrites'=>0,'columns'=>$cols,'recent'=>$recent,'limitsExist'=>(bool)$limits],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
