<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/common.php';
require_once __DIR__.'/member-access.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: private, no-store');
header('X-Content-Type-Options: nosniff');
$access=nam_access((array)($member??[]),(string)($is_admin??''));
if(empty($is_member)){http_response_code(401);echo '{"error":"login_required"}';exit;}
if(!$access['weatherVip']){http_response_code(403);echo '{"error":"vip_required"}';exit;}
if(($_SERVER['REQUEST_METHOD']??'')!=='GET'){http_response_code(405);header('Allow: GET');exit;}
if(session_status()===PHP_SESSION_ACTIVE)session_write_close();
// Editorial sequences prepared by AInoa. These are published music choices, never a live chat reply.
require_once __DIR__.'/listening-weather-editions.php';
echo json_encode(['source'=>'studio-edition','weather'=>noa_weather_editions()],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
