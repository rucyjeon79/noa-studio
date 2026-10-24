<?php
declare(strict_types=1);
require_once dirname(__DIR__,2).'/deploy/noa-app/engine/work-state.php';
$base=sys_get_temp_dir().'/n80-workstate-test-'.bin2hex(random_bytes(8));mkdir($base,0700);mkdir($base.'/work',0700);mkdir($base.'/proof',0700);
$assertions=0;
function ws_check(bool $condition,string $name):void{global $assertions;$assertions++;if(!$condition)throw new RuntimeException($name);}
function ws_remove(string $path):void{if(!is_dir($path)){unlink($path);return;}foreach(scandir($path) as $x)if($x!=='.'&&$x!=='..')ws_remove($path.'/'.$x);rmdir($path);}
function ws_request(string $id,int $revision,array $changes=[],array $instructions=[]):array{return ['requestId'=>$id,'expectedRevision'=>$revision,'changes'=>$changes,'appendInstructions'=>$instructions];}
function ws_change(string $status,array $ids=[]):array{return ['areaId'=>'P0-03','status'=>$status,'note'=>'Verified bounded MUSIC scope; other areas remain under review.','evidenceIds'=>$ids];}
try{
 $directory=$base.'/work';$proof=$base.'/proof';$now=1792836000;
 $empty=n80_work_read($directory);ws_check(!$empty['registered']&&count($empty['state']['areas'])===12,'fixed_parent_areas');
 ws_check(n80_work_summary($directory,$proof)['counts']['needs_review']===12,'unknown_scope_not_complete');
 $request=ws_request('register',0,[ws_change('in_progress')]);$one=n80_work_revise($directory,$proof,$request,$now);
 ws_check($one['ok']&&$one['state']['revision']===1&&$one['readbackVerified'],'register');
 $oldFile=$directory.'/'.hash('sha256',n80_work_event_id(1)).'.json';$original=file_get_contents($oldFile);
 ws_check(n80_work_revise($directory,$proof,$request,$now+1)['effect']==='work_state_already_recorded','lost_response_idempotent');
 ws_check(n80_work_revise($directory,$proof,ws_request('stale',0),$now)['error']==='revision_conflict','CAS');
 $changed=$request;$changed['changes'][0]['status']='error';ws_check(n80_work_revise($directory,$proof,$changed,$now)['error']==='request_identity_conflict','stable_request_binding');
 $a=['id'=>'instruction-a','text'=>'Continue current work','areaIds'=>['P0-03']];$b=['id'=>'instruction-b','text'=>'Additional scope','areaIds'=>['P0-10']];
 $two=n80_work_revise($directory,$proof,ws_request('append',1,[],[$a,$b]),$now);
 ws_check($two['ok']&&array_column($two['state']['instructions'],'id')===['instruction-a','instruction-b'],'FIFO');
 $three=n80_work_revise($directory,$proof,ws_request('same-instruction',2,[],[$a]),$now);
 ws_check($three['ok']&&count($three['state']['instructions'])===2,'deduplicate_instruction');
 $bad=$a;$bad['text']='different';ws_check(n80_work_revise($directory,$proof,ws_request('conflict',3,[],[$bad]),$now)['error']==='instruction_identity_conflict','instruction_conflict');
 ws_check(n80_work_revise($directory,$proof,ws_request('false-complete',3,[ws_change('complete')]),$now)['error']==='completion_requires_operating_evidence','no_unproven_complete');
 $when=gmdate('Y-m-d\TH:i:s\Z',$now);$run=static fn(string $id):array=>['runId'=>$id,'headSha'=>str_repeat('a',40),'status'=>'completed','conclusion'=>'success','url'=>'https://github.com/rucyjeon79/noa-studio/actions/runs/'.$id,'updatedAt'=>$when];
 $event=['id'=>'pending','type'=>'deploy.verified','source'=>'deployment','subjectId'=>'admin','occurredAt'=>$when,'schemaVersion'=>1,'correlationId'=>'pending',
  'evidence'=>['repository'=>'rucyjeon79/noa-studio','taskId'=>N80_WORK_PARENT,'owner'=>'Work','commit'=>str_repeat('a',40),'deployment'=>$run('1'),
   'verification'=>$run('2')+['artifactId'=>'3','artifactSha256'=>str_repeat('b',64),'reportMember'=>'verified.json','reportSha256'=>str_repeat('c',64),'passedCases'=>2],
   'files'=>[['path'=>'noa-music.php','sha256'=>str_repeat('d',64),'bytes'=>10,'readbackVerified'=>true]],
   'http'=>[['url'=>'https://noastudio.ai.kr/noa-music.php','status'=>200,'expectedStatus'=>200]],'scope'=>'task_runtime_evidence_only']];
 $event['id']=n80_completion_expected_id($event);$event['correlationId']=$event['id'];
 ws_check(noa_engine_store_event($proof,$event)['ok'],'existing_completed_proof');
 $four=n80_work_revise($directory,$proof,ws_request('reviewed-complete',3,[ws_change('complete',[$event['id']])]),$now+90000);
 ws_check($four['ok']&&$four['state']['revision']===4,'historical_verified_proof_preserved');
 $summary=n80_work_summary($directory,$proof);ws_check(!$summary['allAreasComplete']&&$summary['counts']['complete']===1&&!$summary['workCompletedEventEmitted'],'no_parent_complete_from_one_deploy');
 ws_check(file_get_contents($oldFile)===$original,'history_immutable');
 $head=file_get_contents($directory.'/head.json');unlink($directory.'/head.json');
 ws_check(n80_work_read($directory)['state']['revision']===4,'crash_head_cache_recovery');
 ws_check(!file_exists($directory.'/head.json'),'readonly_does_not_repair_or_write');
 file_put_contents($directory.'/head.json',$head);chmod($directory.'/head.json',0600);
 // Two real processes with the same revision: exactly one CAS may advance it.
 $children=[];foreach(['race-a','race-b'] as $id){
  $file=$base.'/'.$id.'.php';$r=ws_request($id,4);
  file_put_contents($file,'<?php require '.var_export(dirname(__DIR__,2).'/deploy/noa-app/engine/work-state.php',true).';echo json_encode(n80_work_revise('.var_export($directory,true).','.var_export($proof,true).','.var_export($r,true).','.$now.'));');
  $p=proc_open([PHP_BINARY,$file],[['pipe','r'],['pipe','w'],['pipe','w']],$pipes);fclose($pipes[0]);$children[]=[$p,$pipes];
 }
 $winners=0;foreach($children as [$p,$pipes]){$value=json_decode(stream_get_contents($pipes[1]),true);fclose($pipes[1]);stream_get_contents($pipes[2]);fclose($pipes[2]);ws_check(proc_close($p)===0,'CAS_process');if($value['ok'])$winners++;else ws_check($value['error']==='revision_conflict','CAS_loser');}
 ws_check($winners===1&&n80_work_read($directory)['state']['revision']===5,'concurrent_CAS');
 unlink($proof.'/'.hash('sha256',$event['id']).'.json');$summary=n80_work_summary($directory,$proof);
 ws_check(!$summary['allAreasComplete']&&$summary['counts']['complete']===0,'missing_proof_visible_as_review');
 ws_check(n80_work_read($directory)['state']['areas']['P0-03']['status']==='complete','readonly_preserves_historical_state');
 ws_check(glob($directory.'/.work-head-*')===[]&&glob($directory.'/.engine-*')===[],'no_staging_residue');
 echo json_encode(['ok'=>true,'assertions'=>$assertions,'databaseWrites'=>0,'automaticDispatch'=>false,'workCompletedEventEmitted'=>false]).PHP_EOL;
}finally{ws_remove($base);}
