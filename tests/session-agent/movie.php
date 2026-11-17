<?php
declare(strict_types=1);
$root=sys_get_temp_dir().'/n80-movie-'.bin2hex(random_bytes(6));mkdir($root,0700);mkdir($root.'/html',0700);mkdir($root.'/noa-ai-lab',0700);mkdir($root.'/noa-ai-lab/jobs',0700);
define('_GNUBOARD_',true);define('G5_PATH',$root.'/html');require __DIR__.'/../../bridge/movie-execution.php';
function check(bool $ok,string $why):void{if(!$ok)throw new RuntimeException($why);}
function refuses(callable $fn,string $expected):void{try{$fn();}catch(Throwable $e){check($e->getMessage()===$expected,$e->getMessage().' != '.$expected);return;}throw new RuntimeException('Did not refuse '.$expected);}
$source=['key'=>'test','revision'=>1,'title'=>'Test','lyrics'=>'Test','description'=>'','cast'=>'female','genre'=>'test','imageGuidance'=>'','duration'=>4,'audioPath'=>'/unused','audioSha256'=>str_repeat('a',64)];
$reader=fn($key)=>$source;$owner='owner';$sid=bin2hex(random_bytes(16));$sent=0;
try{
 $create=fn($request)=>sa_dispatch('agentStart',['trackKey'=>'test','sourceRevision'=>1,'requestId'=>$request,'goal'=>'Test '.$request,'format'=>'landscape'],$owner,$reader);
 $j=$create(bin2hex(random_bytes(16)))['job'];$id=$j['id'];
 $sender=function($dispatch)use(&$sent){$sent++;check((bool)preg_match('/^[a-f0-9]{32}$/D',$dispatch),'Bounded dispatch');return 204;};
 $r=nm_dispatch($id,$owner,$sender);check($r['dispatchAccepted'],'Accepted');$dispatch=lab_read()['jobs'][$id]['agent']['worker']['id'];
 nm_dispatch($id,$owner,$sender);check($sent===1,'Duplicate UI request must not dispatch again');
 $body=['dispatchId'=>$dispatch,'sessionId'=>$sid];
 refuses(fn()=>nm_worker('read',$body,$owner,$reader),'movie_claim_required');
 refuses(fn()=>nm_worker('claim',$body,'other',$reader),'movie_dispatch_unavailable');
 $claim=nm_worker('claim',$body,$owner,$reader);check(strlen($claim['lease'])===48,'Existing lease');
 refuses(fn()=>nm_worker('claim',array_replace($body,['sessionId'=>bin2hex(random_bytes(16))]),$owner,$reader),'movie_worker_already_claimed');
 refuses(fn()=>nm_worker('step',$body+['action'=>'cancel'],$owner,$reader),'movie_worker_action_forbidden');
 $read=nm_worker('read',$body,$owner,$reader);check($read['job']['id']===$id,'Selected job only');check(!isset($read['job']['agent']['worker']['id']),'No dispatch token in public summary');
 sa_dispatch('agentStep',['id'=>$id,'action'=>'pause','expectedRevision'=>$read['job']['revision']],$owner,$reader);
 refuses(fn()=>nm_worker('read',$body,$owner,$reader),'movie_dispatch_inactive');
 $paused=sa_dispatch('agentRead',['id'=>$id],$owner,$reader)['job'];
 sa_dispatch('agentStep',['id'=>$id,'action'=>'resume','expectedRevision'=>$paused['revision']],$owner,$reader);
 nm_dispatch($id,$owner,$sender);check($sent===2,'Explicit resume dispatches a new bounded run');
 refuses(fn()=>nm_worker('claim',$body,$owner,$reader),'movie_dispatch_unavailable');
 $j=$create(bin2hex(random_bytes(16)))['job'];$ambiguous=nm_dispatch($j['id'],$owner,fn($id)=>0);check($ambiguous['job']['agent']['worker']['state']==='unconfirmed','Ambiguous transport preserved');
 nm_dispatch($j['id'],$owner,fn($id)=>throw new RuntimeException('must_not_retry'));
 $j=$create(bin2hex(random_bytes(16)))['job'];$failed=nm_dispatch($j['id'],$owner,fn($id)=>403);check($failed['job']['state']==='agent_paused','Definite failure is visible');
 echo "Movie dispatch: idempotency, scope, lease, pause/resume and uncertainty checks passed\n";
}finally{
 $files=new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root,FilesystemIterator::SKIP_DOTS),RecursiveIteratorIterator::CHILD_FIRST);foreach($files as $f){$f->isDir()?rmdir($f->getPathname()):unlink($f->getPathname());}rmdir($root);
}
