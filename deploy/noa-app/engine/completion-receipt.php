<?php
declare(strict_types=1);
require_once __DIR__.'/durable-store.php';
/** Current-task operating evidence only. Never dispatch, ACK a consumer or call SQL. */
function n80_completion_keys(array $value,array $keys): bool {
    return !array_diff(array_keys($value),$keys)&&!array_diff($keys,array_keys($value));
}
function n80_completion_hex($value,int $length): bool {
    return is_string($value)&&preg_match('/^[a-f0-9]{'.$length.'}$/D',$value)===1;
}
function n80_completion_path($value): bool {
    if($value==='extend/noa.design.php')return true;
    if(!is_string($value)||strlen($value)>240||str_contains($value,'..')||str_contains($value,'//'))return false;
    return preg_match('~^noa-[a-z0-9-]+[.](?:php|js|css|json)$|^noa-(?:app|bridge)/[A-Za-z0-9_/-]+[.](?:php|js|css|json)$~D',$value)===1;
}
function n80_completion_http_url($value): bool {
    if(!is_string($value)||strlen($value)>1000)return false;
    $p=parse_url($value);
    if(!$p||($p['scheme']??'')!=='https'||($p['host']??'')!=='noastudio.ai.kr'
       ||isset($p['user'])||isset($p['pass'])||isset($p['port'])||isset($p['fragment']))return false;
    $path=$p['path']??'/';
    if(!preg_match('~^/(?:|index[.]php|noa-[a-z0-9-]+[.]php|noa-app/(?:jukebox|database|taxonomy)/|noa-app/jukebox/stream[.]php|bbs/(?:login|register|board)[.]php)$~D',$path))return false;
    parse_str($p['query']??'',$query);
    if(array_diff(array_keys($query),['view','group','genre','act','track','story','detail','key','type','bo_table']))return false;
    foreach($query as $v)if(!is_string($v)||strlen($v)>190||preg_match('/[\x00-\x1f]/',$v))return false;
    return true;
}
function n80_completion_expected_id(array $event): string {
    $e=$event['evidence'];
    return 'n80-completion-'.hash('sha256',implode('|',[$event['type'],$event['subjectId'],$e['taskId'],$e['commit'],
        $e['deployment']['runId'],$e['verification']['runId'],$e['verification']['artifactSha256']]));
}
function n80_completion_validate(array $event,int $now): array {
    $bad=static fn(string $code):array=>['ok'=>false,'error'=>$code];
    if(!n80_completion_keys($event,['id','type','source','subjectId','occurredAt','schemaVersion','correlationId','evidence']))return $bad('invalid_envelope');
    $base=noa_engine_validate_event($event);if(!$base['ok'])return $base;
    if(!in_array($event['type'],['deploy.verified','work.completed'],true)||$event['source']!=='deployment')return $bad('unsupported_completion');
    if(!isset(noa_engine_modules()[$event['subjectId']]))return $bad('unknown_module');
    if(!preg_match('/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:Z|\+00:00)$/D',$event['occurredAt'])
       ||strtotime($event['occurredAt'])>$now+180||strtotime($event['occurredAt'])<$now-86400)return $bad('stale_or_invalid_evidence_time');
    $e=$event['evidence'];
    if(!is_array($e)||!n80_completion_keys($e,['repository','taskId','owner','commit','deployment','verification','files','http','scope']))return $bad('invalid_evidence');
    if($e['repository']!=='rucyjeon79/noa-studio'||$e['scope']!=='task_runtime_evidence_only')return $bad('invalid_scope');
    if(!is_string($e['taskId'])||!preg_match('/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/D',$e['taskId'])
       ||!is_string($e['owner'])||$e['owner']===''||strlen($e['owner'])>160||preg_match('/[\x00-\x1f]/',$e['owner'])
       ||!n80_completion_hex($e['commit'],40))return $bad('invalid_task_identity');
    foreach(['deployment','verification'] as $kind){
        $r=$e[$kind];$keys=['runId','headSha','status','conclusion','url','updatedAt'];
        if($kind==='verification')$keys=array_merge($keys,['artifactId','artifactSha256','reportMember','reportSha256','passedCases']);
        if(!is_array($r)||!n80_completion_keys($r,$keys)||!is_string($r['runId'])||!preg_match('/^[1-9][0-9]{0,19}$/D',$r['runId'])
           ||!n80_completion_hex($r['headSha'],40)||$r['status']!=='completed'||$r['conclusion']!=='success'
           ||$r['url']!=='https://github.com/rucyjeon79/noa-studio/actions/runs/'.$r['runId'])return $bad('actions_not_verified');
        if(!is_string($r['updatedAt'])||strtotime($r['updatedAt'])===false||strtotime($r['updatedAt'])>$now+180)return $bad('invalid_run_time');
    }
    if($e['deployment']['headSha']!==$e['commit']||$e['verification']['headSha']!==$e['commit'])return $bad('deployment_commit_mismatch');
    $v=$e['verification'];
    if($event['occurredAt']!==$v['updatedAt']||!is_string($v['artifactId'])||!preg_match('/^[1-9][0-9]{0,19}$/D',$v['artifactId'])
       ||!n80_completion_hex($v['artifactSha256'],64)||!n80_completion_hex($v['reportSha256'],64)
       ||!is_int($v['passedCases'])||$v['passedCases']<1||$v['passedCases']>100000
       ||!is_string($v['reportMember'])||strlen($v['reportMember'])>240||str_starts_with($v['reportMember'],'/')||str_contains($v['reportMember'],'..')
       ||!preg_match('~^[A-Za-z0-9_/-]+[.]json$~D',$v['reportMember']))return $bad('verification_artifact_invalid');
    if(!is_array($e['files'])||!array_is_list($e['files'])||count($e['files'])<1||count($e['files'])>100)return $bad('source_evidence_missing');
    $seen=[];foreach($e['files'] as $f){
        if(!is_array($f)||!n80_completion_keys($f,['path','sha256','bytes','readbackVerified'])||!n80_completion_path($f['path'])
           ||isset($seen[$f['path']])||!n80_completion_hex($f['sha256'],64)||!is_int($f['bytes'])||$f['bytes']<1
           ||$f['bytes']>4194304||$f['readbackVerified']!==true)return $bad('source_evidence_invalid');
        $seen[$f['path']]=true;
    }
    if(!is_array($e['http'])||!array_is_list($e['http'])||count($e['http'])<1||count($e['http'])>32)return $bad('live_http_missing');
    foreach($e['http'] as $h){
        if(!is_array($h)||!n80_completion_keys($h,['url','status','expectedStatus'])||!n80_completion_http_url($h['url'])
           ||!is_int($h['status'])||!in_array($h['status'],[200,206,401,403],true)||$h['status']!==$h['expectedStatus'])return $bad('live_http_failed');
    }
    if($event['id']!==n80_completion_expected_id($event)||$event['correlationId']!==$event['id'])return $bad('completion_identity_mismatch');
    return ['ok'=>true,'effect'=>'task_runtime_evidence_only'];
}
function n80_completion_authenticate(string $method,string $raw,string $timestamp,string $nonce,string $signature,string $key,int $now): bool {
    if($method!=='POST'||strlen($raw)>65536||!ctype_digit($timestamp)||abs($now-(int)$timestamp)>180
       ||!n80_completion_hex($nonce,32)||!n80_completion_hex($signature,64)||strlen($key)!==64)return false;
    $message="N80-COMPLETION-1\n".hash('sha256',$raw)."\n".$timestamp."\n".$nonce;
    return hash_equals(hash_hmac('sha256',$message,$key),$signature);
}
function n80_completion_directory_safe(string $directory,string $webRoot): bool {
    $dir=realpath($directory);$web=realpath($webRoot);
    return $dir!==false&&$web!==false&&$dir===rtrim($directory,'/')&&is_dir($dir)&&!is_link($directory)&&is_writable($dir)
        &&$dir!==$web&&!str_starts_with($dir,$web.DIRECTORY_SEPARATOR)&&((fileperms($dir)&0077)===0);
}
function n80_completion_record(string $directory,string $webRoot,array $event,int $now): array {
    $valid=n80_completion_validate($event,$now);if(!$valid['ok'])return $valid;
    if(!n80_completion_directory_safe($directory,$webRoot))return ['ok'=>false,'error'=>'unsafe_completion_store'];
    $stored=noa_engine_store_event($directory,$event);if(!$stored['ok'])return $stored;
    $path=rtrim($directory,'/').'/'.hash('sha256',$event['id']).'.json';
    $readback=json_decode((string)file_get_contents($path),true,64,JSON_THROW_ON_ERROR);
    if(($readback['event']??null)!==$event||($readback['plan']['steps']??null)!==[])return ['ok'=>false,'error'=>'completion_readback_mismatch'];
    return ['ok'=>true,'status'=>$stored['status'],'eventId'=>$event['id'],
        'eventSha256'=>hash('sha256',json_encode($event,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR)),
        'effect'=>'task_runtime_evidence_recorded','automaticDispatch'=>false,'businessAck'=>false,
        'queueMutation'=>false,'databaseWrites'=>0,'workerExecuted'=>false,'readbackVerified'=>true];
}
