<?php
/** Opt-in service-authenticated availability verification; no general dispatcher. */
declare(strict_types=1);
ini_set('display_errors','0');
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');
function n80_consume_music_error(int $status,string $code,?array $diagnostic=null):never {
    http_response_code($status);$body=['ok'=>false,'error'=>$code];
    if($diagnostic!==null)$body['diagnostic']=$diagnostic;
    if(($GLOBALS['n80_music_authenticated']??false)===true)$body['nonce']=$GLOBALS['n80_music_nonce'];
    $raw=json_encode($body,JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
    if(($GLOBALS['n80_music_authenticated']??false)===true)
        header('X-N80-Signature: '.hash_hmac('sha256',"N80-MUSIC-CONSUME-RESPONSE-1\n".$GLOBALS['n80_music_nonce']."\n".hash('sha256',$raw),$GLOBALS['n80_music_key']));
    echo $raw;exit;
}
$GLOBALS['n80_music_phase']='bootstrap';
try{
    $raw=file_get_contents('php://input',false,null,0,1025);
    $ts=$_SERVER['HTTP_X_N80_TIMESTAMP']??'';$nonce=$_SERVER['HTTP_X_N80_NONCE']??'';$sig=$_SERVER['HTTP_X_N80_SIGNATURE']??'';
    if($raw===false||($_SERVER['REQUEST_METHOD']??'')!=='POST'||strlen($raw)>1024||!ctype_digit($ts)
        ||abs(time()-(int)$ts)>180||!preg_match('/^[a-f0-9]{32}$/D',$nonce)||!preg_match('/^[a-f0-9]{64}$/D',$sig))
        n80_consume_music_error(401,'authentication_required');
    $key=trim((string)@file_get_contents('/hosting/noastudio/noa-ai-lab/worker.key'));
    $message="N80-MUSIC-CONSUME-1\n".hash('sha256',$raw)."\n".$ts."\n".$nonce;
    if(strlen($key)!==64||!hash_equals(hash_hmac('sha256',$message,$key),$sig))n80_consume_music_error(401,'authentication_required');
    $GLOBALS['n80_music_authenticated']=true;$GLOBALS['n80_music_nonce']=$nonce;$GLOBALS['n80_music_key']=$key;
    set_time_limit(120);$GLOBALS['n80_music_phase']='load_runtime';
    define('_GNUBOARD_',true);require_once __DIR__.'/music-consumer.php';
    $input=json_decode($raw,true,8,JSON_THROW_ON_ERROR);
    if(!is_array($input)||array_diff(array_keys($input),['action','jobId'])||count($input)!==2
       ||!in_array($input['action']??null,['verify_availability','diagnose_availability'],true)||!is_int($input['jobId']??null)||$input['jobId']<1)
        n80_consume_music_error(400,'invalid_request');
    $GLOBALS['n80_music_phase']='policy';
    if($input['action']==='verify_availability'&&(getenv('N80_MUSIC_CONSUMER_DISABLED')==='1'
       ||(getenv('N80_MUSIC_CONSUMER_ENABLED')!=='1'&&!n80_music_policy_enabled())))
        n80_consume_music_error(503,'music_consumer_disabled');
    if($input['action']==='diagnose_availability'&&getenv('N80_OBSERVER_DISABLED')==='1')n80_consume_music_error(503,'observer_disabled');
    $web=dirname(__DIR__,2);
    $GLOBALS['n80_music_phase']='db_config';
    require $web.'/data/dbconfig.php';require $web.'/noa-bridge/storage.php';
    $GLOBALS['n80_music_phase']='db_connect';$db=noa_bridge_pdo();$GLOBALS['n80_music_phase']='db_readonly';$db->exec('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
    $db->exec('SET TRANSACTION READ ONLY');$db->beginTransaction();
    try{
        $GLOBALS['n80_music_phase']='consumer';
        if($input['action']==='diagnose_availability')$result=n80_music_diagnose($db,$input['jobId']);
        else{
            $base='/hosting/noastudio/noa-ai-lab/n80-music-consumer';
            $result=n80_music_consume($db,['events'=>$base.'/events','leases'=>$base.'/leases'],$input['jobId'],
                ['enabled'=>true,'authenticatedByServer'=>true,'principal'=>'n80_music_consumer','permission'=>'music:verify']);
        }
        $db->commit();
    }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
    if(!$result['ok'])n80_consume_music_error(422,$result['error'],$result['diagnostic']??null);
    $response=json_encode(['ok'=>true,'nonce'=>$nonce,'result'=>$result],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
    header('X-N80-Signature: '.hash_hmac('sha256',"N80-MUSIC-CONSUME-RESPONSE-1\n".$nonce."\n".hash('sha256',$response),$key));echo $response;
}catch(Throwable $e){
    $phase=$GLOBALS['n80_music_phase']??'bootstrap';
    $allowed=['bootstrap','load_runtime','policy','db_config','db_connect','db_readonly','consumer','ready_identity','local_media','public_catalog','public_detail','public_audio','public_readmodel','final_source'];
    $diagnostic=['phase'=>in_array($phase,$allowed,true)?$phase:'unknown',
        'exceptionClass'=>in_array(get_class($e),['PDOException','RuntimeException','TypeError','Error','JsonException'],true)?get_class($e):'other'];
    if($e instanceof PDOException&&preg_match('/^[A-Z0-9]{5}$/D',(string)$e->getCode()))$diagnostic['sqlState']=(string)$e->getCode();
    n80_consume_music_error(503,'music_consumer_unavailable',$diagnostic);
}
