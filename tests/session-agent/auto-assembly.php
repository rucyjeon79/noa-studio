<?php
declare(strict_types=1);
$fixtures=$argv[1]??'/tmp/n80-shorts-fixture';$root=sys_get_temp_dir().'/n80-auto-edit-'.bin2hex(random_bytes(6));
mkdir($root.'/html',0700,true);mkdir($root.'/noa-ai-lab/jobs',0700,true);
define('_GNUBOARD_',true);define('G5_PATH',$root.'/html');require __DIR__.'/../../bridge/session-shorts-assemble.php';
set_error_handler(function($level,$message){throw new ErrorException($message,0,$level);});
function check_edit(bool $ok,string $why):void{if(!$ok)throw new RuntimeException($why);}
function reject_edit(callable $fn,string $why):void{try{$fn();}catch(DomainException|InvalidArgumentException $e){return;}throw new RuntimeException($why);}
$now=strtotime('2026-11-09T08:00:00+09:00');$id=str_repeat('a',32);mkdir(lab_job_dir($id),0700);
$source=['key'=>'single:test:1','revision'=>7,'title'=>'Fixture','lyrics'=>'Test','description'=>'','imageGuidance'=>'','cast'=>'female','genre'=>'test','duration'=>70.0,'audioPath'=>$fixtures.'/source.wav','audioSha256'=>hash_file('sha256',$fixtures.'/source.wav')];
$read=function($key)use(&$source){check_edit($key===$source['key'],'Read exact source');return $source;};
$clip=sa_video_probe($fixtures.'/clip.mp4');copy($fixtures.'/clip.mp4',lab_job_dir($id).'/clip.mp4');$clip+=['accepted'=>true,'file'=>'clip.mp4'];
$scenes=[];for($n=1;$n<=8;$n++)$scenes[]=['n'=>$n,'image'=>['accepted'=>true],'video'=>$clip];
$job=['id'=>$id,'type'=>'agent_movie','trackKey'=>$source['key'],'title'=>'Fixture','cast'=>'female','genre'=>'test','sourceRevision'=>7,'source'=>$source,'audioSha256'=>$source['audioSha256'],'state'=>'agent_ready','revision'=>1,'outputs'=>[],
 'agent'=>['owner'=>'owner','sourceFingerprint'=>sa_fingerprint($source),'format'=>'shorts','selection'=>['start'=>10.0,'end'=>65.0],'timing'=>['overlapSeconds'=>1],'subtitles'=>['enabled'=>false],'target'=>8,'scenes'=>$scenes,'active'=>null,'lease'=>'','leaseUntil'=>0,'attempts'=>[]]];
$p=json_decode(file_get_contents(__DIR__.'/../../config/n80-daily-shorts.json'),true);
$s=['config'=>['workerEnabled'=>true],'jobs'=>[$id=>$job],'events'=>[]];nd_shorts_tick($s,$p,$now,['ready'=>false,'missing'=>['persistent_browser_executor_required']]);
$s['campaigns']['daily_shorts']['preparation']['report']['candidates']=[['trackKey'=>$source['key'],'sourceRevision'=>7,'audioSha256'=>$source['audioSha256'],'videoId'=>'AAAAAAAAAAA']];
$attach=['id'=>$id,'expectedRevision'=>1,'originalVideoId'=>'AAAAAAAAAAA'];
reject_edit(function()use(&$s,$attach,$read){nd_assembly_attach($s,$attach,'other',$read);},'Owner boundary');
reject_edit(function()use(&$s,$attach,$read){nd_assembly_attach($s,array_replace($attach,['originalVideoId'=>'BBBBBBBBBBB']),'owner',$read);},'Exact selected original');
check_edit(nd_assembly_attach($s,$attach,'owner',$read)['attached'],'Attach existing authorized job');
check_edit(nd_assembly_attach($s,$attach,'owner',$read)['replayed'],'Attachment is idempotent');
$baseline=$s;
$paused=$s;$paused['jobs'][$id]['state']='agent_paused';check_edit(nd_assembly_claim($paused,'owner',$now,$read)['state']==='agent_paused','Never resume provider policy or user pause');
$missing=$s;$missing['jobs'][$id]['agent']['scenes'][0]['video']['accepted']=false;check_edit(nd_assembly_claim($missing,'owner',$now,$read)['state']==='generate','No substitute for missing movie');
$subs=$s;$subs['jobs'][$id]['agent']['subtitles']=['enabled'=>true,'status'=>'needs_review'];check_edit(nd_assembly_claim($subs,'owner',$now,$read)['state']==='review_subtitles','Subtitle gate remains');
$first=nd_assembly_claim($s,'owner',$now,$read);check_edit($first['claimed']&&$first['manifest']['outputResolution']===1080,'Real automatic editing claim');
check_edit(nd_assembly_claim($s,'owner',$now+1,$read)['state']==='executor_busy','One executor');
$b=array_intersect_key($first,array_flip(['id','lease','operationId']));
reject_edit(fn()=>nd_assembly_authorize($s,array_replace($b,['lease'=>'stale']),'owner',$now+1),'Fence stale worker');
$changed=$source;$source['revision']=8;reject_edit(function()use(&$s,$b,$now,$read){nd_assembly_operation($s,$b+['command'=>'assembly_read','kind'=>'audio','offset'=>0],'owner',$now+1,$read);},'Recheck live source every operation');$source=$changed;
$chunk=nd_assembly_operation($s,$b+['command'=>'assembly_read','kind'=>'audio','offset'=>0],'owner',$now+1,$read);check_edit($chunk['sha256']===$source['audioSha256'],'Existing original returned');
reject_edit(function()use(&$s,$b,$now,$read){nd_assembly_operation($s,$b+['command'=>'assembly_read','kind'=>'image','scene'=>1,'offset'=>0],'owner',$now+1,$read);},'Bounded inputs only');
$second=nd_assembly_claim($s,'owner',$now+1202,$read);check_edit($second['claimed']&&$second['lease']!==$first['lease']&&$second['operationId']===$first['operationId'],'Lost runner resumes same output operation');
reject_edit(fn()=>nd_assembly_authorize($s,$b,'owner',$now+1203),'Old runner remains fenced');
$b=array_intersect_key($second,array_flip(['id','lease','operationId']));$movie=file_get_contents($fixtures.'/short.mp4');
$v=['decoded'=>true,'audioMapped'=>true,'sourceAudioSha256'=>$source['audioSha256'],'sceneHashes'=>array_column($second['manifest']['layout']['scenes'],'sha256'),'selection'=>['start'=>10,'end'=>65]];
$upload=$b+['command'=>'assembly_write','bytes'=>strlen($movie),'sha256'=>hash('sha256',$movie),'verification'=>$v];
for($offset=0;$offset<strlen($movie);$offset+=524288){$part=$upload+['offset'=>$offset,'data'=>base64_encode(substr($movie,$offset,524288))];$receipt=nd_assembly_operation($s,$part,'owner',$now+1204,$read);}
check_edit($receipt['done']&&!$receipt['asset']['accepted']&&!$receipt['publicationReady'],'File received, never fabricated visual or listening review');
check_edit(nd_assembly_operation($s,$part,'owner',$now+1205,$read)['replayed'],'Lost final acknowledgement is replayable');
check_edit(nd_assembly_claim($s,'owner',$now+1206,$read)['state']==='final_review_required','No duplicate render after receipt');
check_edit($s['jobs'][$id]['state']==='agent_review'&&$s['jobs'][$id]['outputs']===[],'No public/final acceptance by editor');
$s=$baseline;for($i=0;$i<3;$i++)check_edit(nd_assembly_claim($s,'owner',$now+$i*1201,$read)['claimed'],'Bounded recovery attempt');
check_edit(nd_assembly_claim($s,'owner',$now+3603,$read)['state']==='assembly_retry_limit','Persistent retry budget');
echo "N80 automatic editing: existing job/source binding, pause, subtitle gate, exclusive lease, fenced recovery, original transfer, real MP4 receipt and no fake review passed.\n";
