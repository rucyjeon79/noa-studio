<?php
declare(strict_types=1);
require_once __DIR__.'/../../deploy/noa-app/engine/completion-receipt.php';
$count=0;
function check(bool $value,string $label):void {global $count;$count++;if(!$value)throw new RuntimeException($label);}
check(n80_completion_path('extend/noa.design.php'),'exact cache loader permitted');
foreach(['extend/other.php','extend/../config.php','extend/noa.design.php/extra','extend/noa.design.php?x'] as $path)check(!n80_completion_path($path),'other extension paths denied');
$now=1792836000;$when=gmdate('Y-m-d\TH:i:s\Z',$now);
$run=static fn(string $id):array=>['runId'=>$id,'headSha'=>str_repeat('a',40),'status'=>'completed','conclusion'=>'success',
    'url'=>'https://github.com/rucyjeon79/noa-studio/actions/runs/'.$id,'updatedAt'=>$when];
$event=['id'=>'pending','type'=>'work.completed','source'=>'deployment','subjectId'=>'music','occurredAt'=>$when,'schemaVersion'=>1,'correlationId'=>'pending',
    'evidence'=>['repository'=>'rucyjeon79/noa-studio','taskId'=>'music-verification','owner'=>'Work','commit'=>str_repeat('a',40),
      'deployment'=>$run('1'),'verification'=>array_merge($run('2'),['artifactId'=>'3','artifactSha256'=>str_repeat('b',64),
         'reportMember'=>'verified.json','reportSha256'=>str_repeat('c',64),'passedCases'=>2]),
      'files'=>[['path'=>'noa-music.php','sha256'=>str_repeat('d',64),'bytes'=>10,'readbackVerified'=>true]],
      'http'=>[['url'=>'https://noastudio.ai.kr/noa-music.php','status'=>200,'expectedStatus'=>200]],'scope'=>'task_runtime_evidence_only']];
$event['id']=n80_completion_expected_id($event);$event['correlationId']=$event['id'];
check(n80_completion_validate($event,$now)['ok'],'valid evidence');
foreach(['in_progress','queued'] as $status){$bad=$event;$bad['evidence']['deployment']['status']=$status;check(!n80_completion_validate($bad,$now)['ok'],'unfinished run');}
$bad=$event;$bad['evidence']['deployment']['conclusion']='failure';check(!n80_completion_validate($bad,$now)['ok'],'failed run');
$bad=$event;$bad['evidence']['verification']['headSha']=str_repeat('f',40);check(!n80_completion_validate($bad,$now)['ok'],'verification wrong commit');
$bad=$event;$bad['evidence']['files'][0]['readbackVerified']=false;check(!n80_completion_validate($bad,$now)['ok'],'readback required');
$bad=$event;$bad['evidence']['http'][0]['url']='https://evil.example/';check(!n80_completion_validate($bad,$now)['ok'],'fixed origin');
$bad=$event;$bad['evidence']['http'][0]['url']='https://noastudio.ai.kr/noa-music.php?token=secret';check(!n80_completion_validate($bad,$now)['ok'],'credential query rejected');
$bad=$event;$bad['evidence']['files'][0]['path']='../common.php';check(!n80_completion_validate($bad,$now)['ok'],'protected path');
check(!n80_completion_validate($event,$now+86401)['ok'],'stale rejected');
$raw=json_encode(['action'=>'record','event'=>$event]);$ts=(string)$now;$nonce=str_repeat('1',32);$key=str_repeat('a',64);
$sig=hash_hmac('sha256',"N80-COMPLETION-1\n".hash('sha256',$raw)."\n".$ts."\n".$nonce,$key);
check(n80_completion_authenticate('POST',$raw,$ts,$nonce,$sig,$key,$now),'correct signature');
check(!n80_completion_authenticate('POST',$raw.' ',$ts,$nonce,$sig,$key,$now),'tamper rejected');
check(!n80_completion_authenticate('POST',$raw,$ts,$nonce,$sig,$key,$now+181),'expired signature');
check(!n80_completion_authenticate('GET',$raw,$ts,$nonce,$sig,$key,$now),'post only');
$base=sys_get_temp_dir().'/n80-completion-'.bin2hex(random_bytes(8));mkdir($base,0700);mkdir($base.'/web',0700);mkdir($base.'/store',0700);
try{
    $first=n80_completion_record($base.'/store',$base.'/web',$event,$now);
    check($first['ok']&&$first['status']==='stored'&&$first['readbackVerified'],'durable record readback');
    check(!$first['automaticDispatch']&&!$first['businessAck']&&!$first['queueMutation']&&$first['databaseWrites']===0,'no business execution');
    check(n80_completion_record($base.'/store',$base.'/web',$event,$now)['status']==='already_stored','idempotent');
    $bad=$event;$bad['evidence']['owner']='Other';check(n80_completion_record($base.'/store',$base.'/web',$bad,$now)['error']==='id_conflict','conflict preserved');
    check(!n80_completion_directory_safe($base.'/web',$base.'/web'),'public store rejected');
    check(glob($base.'/store/.engine-*')===[],'temporary stage removed');
    $saved=json_decode(file_get_contents($base.'/store/'.hash('sha256',$event['id']).'.json'),true);
    check($saved['plan']['steps']===[],'no downstream plan');
}finally{foreach(glob($base.'/store/*') as $f)unlink($f);@unlink($base.'/store/.engine.lock');rmdir($base.'/store');rmdir($base.'/web');rmdir($base);}
echo json_encode(['ok'=>true,'assertions'=>$count]).PHP_EOL;
