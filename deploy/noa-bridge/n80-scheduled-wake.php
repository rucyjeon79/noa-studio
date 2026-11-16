<?php
declare(strict_types=1);
/** Public, bounded, signed N80 wake endpoint. Not a job executor. */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
$reply=static function(int $code,string $reason): never {
    http_response_code($code);
    echo json_encode(['ok'=>false,'error'=>$reason,'executionAllowed'=>false],JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
    exit;
};
if (($_SERVER['REQUEST_METHOD']??'')!=='POST') {
    header('Allow: POST');$reply(405,'wake_method_not_allowed');
}
// The retired resident runner must not be restarted through this endpoint.
require_once dirname(__DIR__).'/noa-app/engine/hub.php';
require_once dirname(__DIR__).'/noa-app/engine/scheduled-wake.php';
$policy=n80_host_load_policy();
if (($policy['githubWakeActivated']??false)!==true
    || ($policy['requiresHostingApproval']??true)!==false
    || ($policy['n80BoundedExecutorVerified']??false)!==true) {
    header('Retry-After: 3600');$reply(503,'wake_not_activated');
}
if (!isset($_SERVER['CONTENT_LENGTH']) || !ctype_digit((string)$_SERVER['CONTENT_LENGTH'])
    || (int)$_SERVER['CONTENT_LENGTH']>512
    || stripos((string)($_SERVER['CONTENT_TYPE']??''),'application/json')!==0)
    $reply(400,'wake_request_invalid');
$raw=(string)file_get_contents('php://input',false,null,0,513);
if ($raw===''||strlen($raw)>512) $reply(400,'wake_request_invalid');
try {
    $root=n80_hub_root();n80_hub_directory($root);
    // Dedicated 0600 key outside webroot; never fall back to legacy worker.key.
    $keyPath=$root.'/scheduled-wake.key';
    if (is_link($keyPath)||!is_file($keyPath)||((fileperms($keyPath)&0077)!==0))
        $reply(503,'wake_key_not_configured');
    $key=trim((string)file_get_contents($keyPath,false,null,0,129));
    if (!preg_match('/^[a-f0-9]{64}$/D',$key)) $reply(503,'wake_key_not_configured');
    $headers=['time'=>$_SERVER['HTTP_X_N80_TIME']??'','nonce'=>$_SERVER['HTTP_X_N80_NONCE']??'',
        'signature'=>$_SERVER['HTTP_X_N80_SIGNATURE']??''];
    if (!n80_hub_auth($raw,$headers,$key,time(),512)) $reply(401,'wake_auth_required');
    try {$body=json_decode($raw,true,8,JSON_THROW_ON_ERROR);}
    catch (JsonException $e) {$reply(400,'wake_request_invalid');}
    if (!is_array($body)||array_is_list($body))$reply(400,'wake_request_invalid');
    $control=n80_hub_read($root,'control.json');
    $wakeControl=n80_hub_read($root,'scheduled-wake-control.json');
    $schedulePath=dirname(__DIR__).'/noa-app/engine/daily-shorts.json';
    if (is_link($schedulePath)||!is_file($schedulePath)||filesize($schedulePath)>32768)
        $reply(503,'wake_schedule_unavailable');
    $schedule=json_decode((string)file_get_contents($schedulePath),true,32,JSON_THROW_ON_ERROR);
    if (!is_array($schedule))$reply(503,'wake_schedule_unavailable');
    $admit=n80_scheduled_wake_contract($body,$schedule,$policy,$control,time(),$wakeControl);
    if (!$admit['ok'])$reply(409,$admit['reason']);
    $result=n80_scheduled_wake_admit($root,$admit,(string)$headers['nonce'],time());
    http_response_code($result['state']==='duplicate_signal'?200:202);
    echo json_encode($result,JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
} catch (DomainException $e) {
    // A signed replay or revoked stop gate is a conflict, not a server outage.
    $code=$e->getMessage();
    if ($code==='wake_replay' || $code==='wake_revoked_before_commit') $reply(409,$code);
    $reply(503,'wake_unavailable');
} catch (Throwable $e) {
    $reply(503,'wake_unavailable');
}
