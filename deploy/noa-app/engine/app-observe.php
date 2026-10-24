<?php
/** Finished runtime endpoint: authenticated, bounded, read-only; no nonce spool. */
declare(strict_types=1);
ini_set('display_errors','0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
function n80_app_error(int $status,string $code): never {
    http_response_code($status);echo json_encode(['ok'=>false,'error'=>$code]);exit;
}
try {
    $raw=file_get_contents('php://input',false,null,0,4097);
    $ts=$_SERVER['HTTP_X_N80_TIMESTAMP']??'';
    $nonce=$_SERVER['HTTP_X_N80_NONCE']??'';
    $sig=$_SERVER['HTTP_X_N80_SIGNATURE']??'';
    if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||strlen($raw)>4096
       ||!ctype_digit($ts)||abs(time()-(int)$ts)>180
       ||!preg_match('/^[a-f0-9]{32}$/D',$nonce))n80_app_error(401,'authentication_required');
    $key=trim((string)file_get_contents('/hosting/noastudio/noa-ai-lab/worker.key'));
    $message="N80-APP-DATA-1\n".hash('sha256',$raw)."\n".$ts."\n".$nonce;
    if(strlen($key)!==64||!hash_equals(hash_hmac('sha256',$message,$key),$sig))
        n80_app_error(401,'authentication_required');
    if(getenv('N80_OBSERVER_DISABLED')==='1')n80_app_error(503,'observer_disabled');
    $input=json_decode($raw,true,8,JSON_THROW_ON_ERROR);
    if(!is_array($input)||array_diff(array_keys($input),['action'])
       ||($input['action']??'')!=='audit')n80_app_error(400,'invalid_request');
    // Auth precedes database configuration/connection. No common.php/session or schema helpers.
    $web=dirname(__DIR__,2);define('_GNUBOARD_',true);
    require $web.'/data/dbconfig.php';require $web.'/noa-bridge/storage.php';
    require __DIR__.'/app-data.php';
    set_time_limit(120);
    $db=noa_bridge_pdo();
    $db->exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    $db->exec('SET TRANSACTION READ ONLY');
    $db->beginTransaction();
    try{$memberTable=(defined('G5_TABLE_PREFIX')?G5_TABLE_PREFIX:'g5_').'member';
        $result=n80_app_audit($db,$web,$memberTable);
        $result['modules']['media']=n80_app_media($db,n80_app_schema($db),$web);$db->commit();}
    catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
    $result['moduleLinks']=['music'=>['music','media','taxonomy'],'jukebox'=>['jukebox','media'],'playlist'=>['playlist','music'],'youtube'=>['youtube','taxonomy'],'world'=>['world','youtube'],'ai_lab'=>['ai_lab'],'admin'=>['admin','settings','members'],'community'=>['community','members'],'database'=>['database']];
    $result['modules']['ai_lab']=n80_app_ai_summary('/hosting/noastudio/noa-ai-lab/state.json');
    // Replay is harmless: this action has no writes, claims, ACKs or emitted events.
    $response=json_encode(['ok'=>true,'nonce'=>$nonce,'result'=>$result],JSON_THROW_ON_ERROR);
    header('X-N80-Signature: '.hash_hmac('sha256',"N80-APP-DATA-RESPONSE-1\n".$nonce."\n".hash('sha256',$response),$key));
    echo $response;
}catch(Throwable $e){n80_app_error(503,'observer_unavailable');}
