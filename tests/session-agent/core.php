<?php
declare(strict_types=1);
$fixtures=$argv[1]??'/tmp/n80-session-fixture';$root=sys_get_temp_dir().'/n80-session-'.bin2hex(random_bytes(6));
mkdir($root,0700);mkdir($root.'/html',0700);mkdir($root.'/noa-ai-lab',0700);mkdir($root.'/noa-ai-lab/jobs',0700);
define('_GNUBOARD_',true);define('G5_PATH',$root.'/html');require __DIR__.'/../../bridge/session-agent.php';
set_error_handler(function($level,$message){throw new ErrorException($message,0,$level);});
function check(bool $ok,string $why):void{if(!$ok)throw new RuntimeException($why);}
function refuses(callable $fn,string $expected):void{try{$fn();}catch(Throwable $e){check($e->getMessage()===$expected,'Expected '.$expected.', got '.$e->getMessage());return;}throw new RuntimeException('Did not refuse '.$expected);}
$source=['key'=>'story:original:test','revision'=>7,'title'=>'Current title','lyrics'=>'Current lyrics','description'=>'Test song','cast'=>'female','genre'=>'test','imageGuidance'=>'A test image','duration'=>5,'audioPath'=>$fixtures.'/audio.wav','audioSha256'=>hash_file('sha256',$fixtures.'/audio.wav')];
$reader=function($key)use(&$source){if($source===null)throw new DomainException('song_unavailable');return $source;};
$call=function($op,$b=[])use($reader){return sa_dispatch($op,$b,'owner',$reader);};$id=fn()=>bin2hex(random_bytes(16));
try{
 $pre=$call('agentRead',['trackKey'=>$source['key']]);check(!isset($pre['source']['audioPath']),'Private source path exposed');
 $start=['trackKey'=>$source['key'],'sourceRevision'=>7,'requestId'=>$id(),'goal'=>'Create a test music video.','format'=>'landscape'];
 $result=$call('agentStart',$start);$job=$result['job'];$jobId=$job['id'];check($call('agentStart',$start)['replayed'],'Start replay');
 check($job['agent']['sceneCount']===1,'Nominal scene count');
 refuses(fn()=>sa_dispatch('agentRead',['id'=>$jobId],'other',$reader),'agent_job_unavailable');
 $claim=$call('agentStep',['id'=>$jobId,'action'=>'claim','sessionId'=>$id()]);$lease=$claim['lease'];$job=$claim['job'];
 refuses(fn()=>$call('agentStep',['id'=>$jobId,'action'=>'claim','sessionId'=>$id()]),'agent_already_claimed');
 $step=function($action,$extra=[])use($call,$id,$jobId,&$lease,&$job){$b=['id'=>$jobId,'action'=>$action,'lease'=>$lease,'requestId'=>$id(),'expectedRevision'=>$job['revision']]+$extra;$r=$call('agentStep',$b);$job=$r['job'];return [$b,$r];};
 $scene=fn($n)=>['n'=>$n,'summary'=>'Test scene '.$n,'imagePrompt'=>'Test image '.$n,'videoPrompt'=>'Test motion '.$n];
 $step('plan',['scenes'=>[$scene(1)]]);
 $step('begin',['kind'=>'image','scene'=>1]);check($call('agentRead',['id'=>$jobId])['job']['next']['action']==='reconcile','Ambiguous request must reconcile');
 $operation=$job['next']['operation']['requestId'];
 refuses(fn()=>$step('not_created',['operationId'=>$operation,'note'=>'unchecked']),'provider_reconciliation_required');
 $step('not_created',['operationId'=>$operation,'note'=>'Provider history checked: no generation.','providerHistoryChecked'=>true]);
 $upload=function($kind,$n,$path,$verification=[])use($call,$step,$jobId,&$lease,&$job){
  [$begin]=$step('begin',['kind'=>$kind,'scene'=>$n]);$op=$begin['requestId'];$data=file_get_contents($path);$base=['id'=>$jobId,'mode'=>'write','lease'=>$lease,'operationId'=>$op,'sha256'=>hash('sha256',$data),'bytes'=>strlen($data),'sourceUrl'=>$kind==='final'?'':($kind==='image'?'https://gemini.google.com/app/test':'https://flow.google.com/project/test'),'verification'=>$verification];
  $first=null;$last=null;
  for($off=0;$off<strlen($data);$off+=1024){$chunk=$base+['offset'=>$off,'data'=>base64_encode(substr($data,$off,1024))];$r=$call('agentFile',$chunk);$first??=$chunk;$last=$chunk;
   if($off===0&&strlen($data)>1024){check($call('agentFile',$chunk)['nextOffset']===1024,'Chunk replay');refuses(fn()=>$call('agentFile',array_replace($chunk,['data'=>base64_encode(str_repeat('X',1024))])),'asset_chunk_conflict');}
  }
  check($r['done']===true,'Upload completion');check($call('agentFile',$last)['replayed']===true,'Receipt replay');
  $job=$call('agentRead',['id'=>$jobId])['job'];
  refuses(fn()=>$step('review',['operationId'=>$op,'accepted'=>true,'note'=>'Not checked yet.']),'visual_review_required');
  [$review]=$step('review',['operationId'=>$op,'accepted'=>true,'visualChecked'=>true,'audioChecked'=>true,'note'=>'Synthetic fixture decoded and inspected.']);
  check($call('agentStep',$review)['replayed']===true,'Review replay, including final completion');
  check(!is_file(lab_job_dir($jobId).'/transfer-'.$op.'.part'),'Transfer duplicate retained');
 };
 $upload('image',1,$fixtures.'/image.png');$upload('video',1,$fixtures.'/clip-1.mp4');
 check($job['next']['action']==='extend_plan','Short actual clip must extend plan');$step('plan',['scenes'=>[$scene(2)]]);
 $upload('image',2,$fixtures.'/image.png');$upload('video',2,$fixtures.'/clip-2.mp4');check($job['next']['action']==='assemble','Ready for assembly');
 $receipt=json_decode(file_get_contents($fixtures.'/receipt.json'),true,32,JSON_THROW_ON_ERROR);$upload('final',0,$fixtures.'/final.mp4',$receipt['verification']);
 check($job['state']==='saved'&&count($job['outputs'])===1,'Final stored');check($call('agentFile',['id'=>$jobId,'mode'=>'read','kind'=>'final','offset'=>0])['sha256']===$receipt['sha256'],'Final readback');
 $source['duration']=240;$source['title']='Four minute song';$start['requestId']=$id();$long=$call('agentStart',$start)['job'];check($long['agent']['sceneCount']===35,'No 30-cut cap');
 $shortStart=array_replace($start,['format'=>'shorts','requestId'=>$id(),'selection'=>['start'=>40,'end'=>95]]);
 $short=$call('agentStart',$shortStart)['job'];check($short['agent']['duration']===55.0&&$short['source']['duration']===240,'Selected length preserves full source');
 check($short['agent']['sceneCount']===8&&$short['assemblyTool']['manifest']['selection']['start']===40.0,'Selected scene plan and manifest');
 check($call('agentStart',$shortStart)['replayed'],'Selected start replay');
 foreach([['start'=>0,'end'=>48],['start'=>0,'end'=>60],['start'=>-1,'end'=>54],['start'=>220,'end'=>275]] as $bad)refuses(fn()=>$call('agentStart',array_replace($shortStart,['requestId'=>$id(),'selection'=>$bad])),'invalid_short_selection');
 refuses(fn()=>$call('agentStart',array_replace($shortStart,['format'=>'landscape'])),'invalid_short_selection');
 $chunk=$call('agentSourceFile',['trackKey'=>$source['key'],'sourceRevision'=>7,'offset'=>0]);check($chunk['sha256']===$source['audioSha256']&&!isset($chunk['audioPath']),'Source audio read before job');
 refuses(fn()=>$call('agentSourceFile',['trackKey'=>$source['key'],'sourceRevision'=>6,'offset'=>0]),'source_revision_conflict');
 refuses(fn()=>$call('agentSourceFile',['trackKey'=>$source['key'],'sourceRevision'=>7,'offset'=>-1]),'invalid_file_offset');
 $longId=$long['id'];$lc=$call('agentStep',['id'=>$longId,'action'=>'claim','sessionId'=>$id()]);
 $pl=$call('agentStep',['id'=>$longId,'action'=>'plan','lease'=>$lc['lease'],'expectedRevision'=>$lc['job']['revision'],'requestId'=>$id(),'scenes'=>[$scene(1)]]);
 $revise=['id'=>$longId,'action'=>'revise','lease'=>$lc['lease'],'expectedRevision'=>$pl['job']['revision'],'requestId'=>$id(),'scene'=>1,'changes'=>['videoPrompt'=>'Move the camera more slowly.']];
 $revised=$call('agentStep',$revise);check($revised['job']['scenes'][0]['videoPrompt']==='Move the camera more slowly.','Adaptive prompt correction');
 check($call('agentStep',array_reverse($revise,true))['replayed']===true,'Semantic request ordering');
 $beg=$call('agentStep',['id'=>$longId,'action'=>'pause','expectedRevision'=>$revised['job']['revision']]);
 $resumed=$call('agentStep',['id'=>$longId,'action'=>'resume','expectedRevision'=>$beg['job']['revision']]);
 refuses(fn()=>$call('agentStep',['id'=>$longId,'action'=>'plan','lease'=>$lc['lease'],'expectedRevision'=>$resumed['job']['revision'],'requestId'=>$id(),'scenes'=>[$scene(2)]]),'agent_lease_expired');
 $long=$resumed['job'];
 $source['title']='Changed after plan';check($call('agentRead',['id'=>$long['id']])['sourceCurrent']===false,'Current title fence');
 refuses(fn()=>$call('agentStep',['id'=>$long['id'],'action'=>'claim','sessionId'=>$id()]),'source_changed_replan_required');
 $source=null;$paused=$call('agentStep',['id'=>$long['id'],'action'=>'pause','expectedRevision'=>$long['revision'],'reason'=>'Original unavailable']);check($paused['job']['state']==='agent_paused','Pause when original disappears');
 check(count($call('agentTasks')['jobs'])===3,'Durable tasks');
 echo "Session agent: ownership, current source, leases, replay, reconcile, upload integrity, review, actual duration, original audio, final receipt and pause passed.\n";
}finally{restore_error_handler();foreach(new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root,FilesystemIterator::SKIP_DOTS),RecursiveIteratorIterator::CHILD_FIRST)as$f){$f->isDir()?rmdir($f->getPathname()):unlink($f->getPathname());}rmdir($root);}
