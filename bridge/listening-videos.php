<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/common.php';
require_once __DIR__.'/member-access.php';
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: private, no-store');header('X-Content-Type-Options: nosniff');
if(($_SERVER['REQUEST_METHOD']??'')!=='GET'){http_response_code(405);header('Allow: GET');exit;}
if(empty($is_member)||!nam_access((array)$member,(string)($is_admin??''))['member']){http_response_code(401);echo '{"error":"login_required"}';exit;}
if(session_status()===PHP_SESSION_ACTIVE)session_write_close();
require_once __DIR__.'/storage.php';
require_once dirname(__DIR__).'/noa-app/engine/personal-song-index.php';
require_once __DIR__.'/listening-video-catalog.php';
try{echo json_encode(['videos'=>n80_read_listening_videos(noa_bridge_pdo())],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);}
catch(Throwable $e){error_log('[n80-listening-videos] '.get_class($e));http_response_code(503);echo '{"error":"videos_unavailable"}';}
