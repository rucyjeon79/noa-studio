<?php
declare(strict_types=1);
ini_set('display_errors','0');
require_once dirname(__DIR__).'/common.php';
require_once __DIR__.'/storage.php';
require_once __DIR__.'/creator-core.php';
require_once __DIR__.'/sound-core.php';
require_once dirname(__DIR__).'/noa-app/jukebox/upload-core.php';
require_once __DIR__.'/channel-batch-audio.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: private, no-store');
header('X-Content-Type-Options: nosniff');
function ncb_reply(int $code,array $data): never {
    http_response_code($code);
    echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
    exit;
}
$access=nam_access((array)($member??[]),(string)($is_admin??''));
if (!$access['creator']) ncb_reply(403,['error'=>'creator_required']);
if (($_SERVER['REQUEST_METHOD']??'')!=='POST') ncb_reply(405,['error'=>'method_not_allowed']);
$token=$_SESSION['noa_creator_csrf']??'';
if (!$token || !hash_equals($token,(string)($_SERVER['HTTP_X_NOA_CSRF']??'')) ||
    ($_SERVER['HTTP_ORIGIN']??'')!=='https://noastudio.ai.kr') ncb_reply(403,['error'=>'csrf_required']);
if (session_status()===PHP_SESSION_ACTIVE) session_write_close();
try {
    $owner=(string)$member['mb_id']; $admin=$access['admin']; $db=noa_bridge_pdo(); $action=$_GET['action']??'';
    if ($action==='uploadChunk') {
        if (strtolower(trim(explode(';',$_SERVER['CONTENT_TYPE']??'')[0]))!=='application/octet-stream') ncb_reply(415,['error'=>'chunk_body_required']);
        $id=ncb_id($_GET['id']??null); $u=ncb_authorized_upload($db,$id,$owner,$admin);
        $index=filter_var($_GET['index']??null,FILTER_VALIDATE_INT);
        if ($index===false) throw new InvalidArgumentException('invalid_chunk');
        $bytes=file_get_contents('php://input',false,null,0,(nd_is($u)?ND_CHUNK:NU_CHUNK)+1);
        ncb_reply(200,['ok'=>true]+nu_chunk($db,$id,$index,$bytes));
    }
    if (strtolower(trim(explode(';',$_SERVER['CONTENT_TYPE']??'')[0]))!=='application/json') ncb_reply(415,['error'=>'json_required']);
    $raw=file_get_contents('php://input',false,null,0,400001);
    if (strlen($raw)>400000) ncb_reply(413,['error'=>'selection_too_large']);
    $b=json_decode($raw,true,16,JSON_THROW_ON_ERROR);
    if (!is_array($b)) throw new InvalidArgumentException('invalid_request');
    $out=match($action) {
        'preview'=>ncb_preview($db,ncb_keys($b['keys']??null),$owner,$admin),
        'start','uploadStart','retry'=>['batch'=>ncb_start($db,$b,$owner,$admin,
            ['start'=>'audio','uploadStart'=>'upload','retry'=>'retry'][$action])],
        'status'=>['batch'=>ncb_snapshot($db,ncb_receipt($db,$owner,isset($b['id'])?ncb_id($b['id']):null))],
        'uploadInit'=>ncb_upload_init($db,$b,$owner,$admin),
        'uploadFinish'=>(function()use($db,$b,$owner,$admin){
            $u=ncb_authorized_upload($db,ncb_id($b['id']??null),$owner,$admin);
            $out=nu_finish($db,$u['id']);
            if ($out['status']==='ready') {
                try { nu_cleanup_verified($db,$u['id']); } catch (Throwable $e) { /* existing maintenance verifies and retries */ }
            }
            return ['status'=>$out['status']];
        })(),
        default=>throw new InvalidArgumentException('unknown_action'),
    };
    ncb_reply(200,['ok'=>true]+$out);
} catch (DomainException $e) {
    ncb_reply(409,['error'=>$e->getMessage()]);
} catch (InvalidArgumentException|JsonException $e) {
    ncb_reply(400,['error'=>$e instanceof JsonException?'invalid_json':$e->getMessage()]);
} catch (Throwable $e) {
    error_log('[channel-batch-audio] '.get_class($e).' '.$e->getCode());
    ncb_reply(503,['error'=>'batch_service_unavailable']);
}
