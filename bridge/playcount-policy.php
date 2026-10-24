<?php
/** Service-authenticated, revision-bound one-field policy change. No session/spool. */
declare(strict_types=1);
function npp_policy_json(array $policy):string { ksort($policy,SORT_STRING);return json_encode($policy,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR); }
function npp_sources(string $web):array {
    $out=[];
    foreach(['noa-app/jukebox/stream.php','noa-app/jukebox/stream-popularity.php','noa-playcount.js','noa-music.php'] as $path){
        $file=$web.'/'.$path;$resolved=realpath($file);
        if(!$resolved||$resolved!==$file||!is_file($file)||!is_readable($file))throw new DomainException('source_unavailable');
        $hash=hash_file('sha256',$file);if(!is_string($hash)||!preg_match('/^[a-f0-9]{64}$/D',$hash))throw new DomainException('source_unavailable');$out[$path]=$hash;
    }
    ksort($out,SORT_STRING);return $out;
}
function npp_auth(string $raw,string $timestamp,string $nonce,string $signature,string $key,int $now):bool {
    return strlen($raw)<=4096&&ctype_digit($timestamp)&&strlen($timestamp)<=12&&abs($now-(int)$timestamp)<=180
        &&preg_match('/^[a-f0-9]{32}$/D',$nonce)===1&&preg_match('/^[a-f0-9]{64}$/D',$signature)===1
        &&preg_match('/^[a-f0-9]{64}$/Di',$key)===1
        &&hash_equals(hash_hmac('sha256',"N80-PLAYCOUNT-POLICY-1\n".hash('sha256',$raw)."\n".$timestamp."\n".$nonce,$key),$signature);
}
function npp_apply(PDO $db,string $web,array $input):array {
    $action=$input['action']??null;
    if(!in_array($action,['inspect','set'],true))throw new InvalidArgumentException('invalid_action');
    $allowed=$action==='inspect'?['action']:['action','expectedRevision','expectedPolicySha256','enabled','expectedSources'];
    if(array_diff(array_keys($input),$allowed)||array_diff($allowed,array_keys($input)))throw new InvalidArgumentException('invalid_request');
    if($action==='set'){
        if(!is_int($input['expectedRevision'])||$input['expectedRevision']<1||!is_bool($input['enabled'])||!is_string($input['expectedPolicySha256'])||!preg_match('/^[a-f0-9]{64}$/D',$input['expectedPolicySha256'])||!is_array($input['expectedSources']))throw new InvalidArgumentException('invalid_cas');
        $sources=npp_sources($web);$expected=$input['expectedSources'];foreach($expected as $value)if(!is_string($value)||!preg_match('/^[a-f0-9]{64}$/D',$value))throw new InvalidArgumentException('invalid_cas');ksort($expected,SORT_STRING);
        if($sources!==$expected)throw new DomainException('source_conflict');
    }
    if($action==='inspect')$db->exec('SET TRANSACTION READ ONLY');
    $db->beginTransaction();
    try{
        $row=$db->query('SELECT policy,revision FROM noa_popularity_settings WHERE id=1'.($action==='set'?' FOR UPDATE':''))->fetch(PDO::FETCH_ASSOC);
        if(!$row)throw new DomainException('policy_missing');
        $policy=json_decode($row['policy'],true,32,JSON_THROW_ON_ERROR);np_validate_policy($policy);
        $sha=hash('sha256',npp_policy_json($policy));$revision=(int)$row['revision'];$changed=false;
        if($action==='set'){
            if($revision!==$input['expectedRevision']||!hash_equals($sha,$input['expectedPolicySha256']))throw new DomainException('policy_conflict');
            if($sources!==npp_sources($web))throw new DomainException('source_conflict');
            $next=$policy;$next['playbackIntegrationEnabled']=$input['enabled'];np_validate_policy($next);
            if($next!==$policy){
                $q=$db->prepare("UPDATE noa_popularity_settings SET policy=?,revision=revision+1,updated_by='n80_deployment' WHERE id=1 AND revision=?");
                $q->execute([npp_policy_json($next),$revision]);if($q->rowCount()!==1)throw new DomainException('policy_conflict');
                $policy=$next;$revision++;$changed=true;
            }
            if($sources!==npp_sources($web))throw new DomainException('source_conflict');
        }else $sources=npp_sources($web);
        $db->commit();
        return ['policy'=>$policy,'revision'=>$revision,'policySha256'=>hash('sha256',npp_policy_json($policy)),'sources'=>$sources,'changed'=>$changed];
    }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
}
// CLI inclusion exposes only the library to isolated tests, never a web bypass.
if(PHP_SAPI==='cli')return;
ini_set('display_errors','0');header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');header('X-Content-Type-Options: nosniff');
$authenticated=false;$nonce='';$key='';$status=200;
try{
    $raw=(string)file_get_contents('php://input',false,null,0,4097);
    $timestamp=$_SERVER['HTTP_X_N80_TIMESTAMP']??'';$nonce=$_SERVER['HTTP_X_N80_NONCE']??'';$signature=$_SERVER['HTTP_X_N80_SIGNATURE']??'';
    $web=dirname(__DIR__);
    if(($_SERVER['REQUEST_METHOD']??'')!=='POST')throw new UnexpectedValueException('authentication_required');
    $key=trim((string)file_get_contents(dirname($web).'/noa-ai-lab/worker.key'));
    if(!npp_auth($raw,$timestamp,$nonce,$signature,$key,time()))throw new UnexpectedValueException('authentication_required');
    $authenticated=true;$input=json_decode($raw,true,16,JSON_THROW_ON_ERROR);
    if(!is_array($input))throw new InvalidArgumentException('invalid_request');
    define('_GNUBOARD_',true);require $web.'/data/dbconfig.php';require __DIR__.'/storage.php';require __DIR__.'/popularity-store.php';
    $result=npp_apply(noa_bridge_pdo(),$web,$input);$body=['ok'=>true,'nonce'=>$nonce,'result'=>$result];
}catch(UnexpectedValueException $e){$status=401;$body=['ok'=>false,'error'=>'authentication_required'];}
catch(InvalidArgumentException|JsonException $e){$status=400;$body=['ok'=>false,'error'=>'invalid_request'];}
catch(DomainException $e){$status=409;$body=['ok'=>false,'error'=>$e->getMessage()];}
catch(Throwable $e){$status=503;$body=['ok'=>false,'error'=>'policy_unavailable'];error_log('[noa-playcount-policy] '.get_class($e));}
$response=json_encode($body,JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);http_response_code($status);
if($authenticated)header('X-N80-Signature: '.hash_hmac('sha256',"N80-PLAYCOUNT-POLICY-RESPONSE-1\n".$nonce."\n".hash('sha256',$response),$key));
echo $response;
