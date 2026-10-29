<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/common.php';
require_once __DIR__.'/google-play-core.php';
require_once __DIR__.'/member-access.php';
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: private, no-store');header('X-Content-Type-Options: nosniff');
function ngp_reply(int $code,array $data): never {http_response_code($code);echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);exit;}
try {
    $access=nam_access((array)($member??[]),(string)($is_admin??''));
    if (!$access['member']) ngp_reply(401,['ok'=>false,'error'=>'login_required']);
    $owner=(string)$member['mb_id'];$c=ngp_config();$method=$_SERVER['REQUEST_METHOD']??'GET';
    if ($method==='GET') {
        $_SESSION['noa_play_csrf']??=bin2hex(random_bytes(32));
        $ready=ngp_ready($c);
        ngp_reply(200,['ok'=>true,'ready'=>$ready,'csrf'=>$_SESSION['noa_play_csrf'],'accountId'=>$ready?ngp_account($owner,$c['accountSecret']):null,'products'=>$ready?array_keys(ngp_products()):[]]);
    }
    if ($method!=='POST') ngp_reply(405,['ok'=>false,'error'=>'method_not_allowed']);
    if (($_SERVER['HTTP_ORIGIN']??'')!=='https://noastudio.ai.kr'||empty($_SESSION['noa_play_csrf'])||!hash_equals($_SESSION['noa_play_csrf'],$_SERVER['HTTP_X_NOA_CSRF']??'')||strtolower(trim(explode(';',$_SERVER['CONTENT_TYPE']??'')[0]))!=='application/json') ngp_reply(403,['ok'=>false,'error'=>'csrf_required']);
    $raw=file_get_contents('php://input',false,null,0,8193);
    if (strlen($raw)>8192) throw new InvalidArgumentException('invalid_request');
    $body=json_decode($raw,true,16,JSON_THROW_ON_ERROR);
    if (!is_array($body)||!is_string($body['productId']??null)||!is_string($body['purchaseToken']??null)) throw new InvalidArgumentException('invalid_request');
    if(session_status()===PHP_SESSION_ACTIVE)session_write_close();
    ngp_reply(200,['ok'=>true,'purchase'=>ngp_confirm($owner,$body['productId'],$body['purchaseToken'],$c)]);
} catch (InvalidArgumentException|JsonException $e) {ngp_reply(400,['ok'=>false,'error'=>'invalid_request']);}
catch (DomainException $e) {ngp_reply(409,['ok'=>false,'error'=>in_array($e->getMessage(),['play_not_configured','purchase_not_completed','purchase_owner_mismatch','purchase_product_mismatch','purchase_quantity_mismatch','purchase_mode_mismatch','purchase_already_consumed','purchase_refunded'],true)?$e->getMessage():'play_verification_pending']);}
catch (Throwable $e) {ngp_reply(503,['ok'=>false,'error'=>'play_verification_pending']);}
