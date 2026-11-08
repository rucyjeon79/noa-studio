<?php
declare(strict_types=1);
$fixtures=$argv[1]??'/tmp/n80-session-fixture';$root=sys_get_temp_dir().'/n80-subtitle-'.bin2hex(random_bytes(6));
mkdir($root,0700);mkdir($root.'/html',0700);mkdir($root.'/noa-ai-lab',0700);mkdir($root.'/noa-ai-lab/jobs',0700);
define('_GNUBOARD_',true);define('G5_PATH',$root.'/html');require __DIR__.'/../../bridge/session-agent.php';
set_error_handler(function($level,$message){throw new ErrorException($message,0,$level);});
function check(bool $ok,string $why):void{if(!$ok)throw new RuntimeException($why);}
function refuses(callable $fn,string $expected):void{try{$fn();}catch(Throwable $e){check($e->getMessage()===$expected,'Expected '.$expected.', got '.$e->getMessage());return;}throw new RuntimeException('Did not refuse '.$expected);}
$source=['key'=>'story:subtitle:test','revision'=>1,'title'=>'한글자막 검증','lyrics'=>"[Verse]\n별빛이 내려와\n다시 웃어 봐",'description'=>'','cast'=>'female','genre'=>'test','imageGuidance'=>'','duration'=>5,'audioPath'=>$fixtures.'/audio.wav','audioSha256'=>hash_file('sha256',$fixtures.'/audio.wav')];
$reader=function($key)use(&$source){return $source;};$call=fn($op,$b=[])=>sa_dispatch($op,$b,'owner',$reader);$id=fn()=>bin2hex(random_bytes(16));
try{
 $j=$call('agentStart',['trackKey'=>$source['key'],'sourceRevision'=>1,'requestId'=>$id(),'goal'=>'한글자막 뮤비','format'=>'landscape','subtitles'=>true])['job'];$jobId=$j['id'];
 $claim=$call('agentStep',['id'=>$jobId,'action'=>'claim','sessionId'=>$id()]);$lease=$claim['lease'];$j=$claim['job'];
 $step=function($action,$extra=[])use($call,$id,$jobId,&$lease,&$j){$b=['id'=>$jobId,'action'=>$action,'lease'=>$lease,'requestId'=>$id(),'expectedRevision'=>$j['revision']]+$extra;$r=$call('agentStep',$b);$j=$r['job'];return [$b,$r];};
 $step('plan',['scenes'=>[['n'=>1,'summary'=>'검증','imagePrompt'=>'scene','videoPrompt'=>'motion']]]);check($j['next']['action']==='align_subtitles','Subtitle stage not connected');
 $payload=json_decode(file_get_contents($fixtures.'/subtitle-payload.json'),true,32,JSON_THROW_ON_ERROR);
 refuses(fn()=>$step('subtitles',['subtitles'=>array_replace($payload,['sourceAudioSha256'=>str_repeat('0',64)])]),'subtitle_source_mismatch');
 $changed=$payload;$changed['cues'][0]['text']='다른 곡의 가사';refuses(fn()=>$step('subtitles',['subtitles'=>$changed]),'invalid_subtitle_cues');
 $partial=$payload;$partial['cues']=array_slice($partial['cues'],0,1);$step('subtitles',['subtitles'=>$partial]);check($j['next']['action']==='review_subtitles','Unmatched lyric hidden');
 refuses(fn()=>$step('begin',['kind'=>'image','scene'=>1]),'unexpected_agent_step');
 refuses(fn()=>$step('subtitle_review',['accepted'=>true,'audioChecked'=>true,'note'=>'Missing line must block.']),'complete_subtitles_required');
 $low=$payload;$low['cues'][0]['probability']=.1;$step('subtitles',['subtitles'=>$low]);
 refuses(fn()=>$step('subtitle_review',['accepted'=>true,'note'=>'Not listened.']),'subtitle_audio_review_required');
 $step('subtitle_review',['accepted'=>true,'audioChecked'=>true,'note'=>'Isolated test timing checked.']);check($j['next']['action']==='generate','Reviewed timing did not continue');
 [$saved]=$step('subtitles',['subtitles'=>$payload]);check($j['subtitles']['status']==='ready','Confident automatic timing');
 check($call('agentStep',$saved)['replayed']===true,'Subtitle write replay');
 $receipt=json_decode(file_get_contents($fixtures.'/subtitle-landscape.receipt.json'),true,32,JSON_THROW_ON_ERROR);
 check($j['subtitles']['sha256']===$receipt['verification']['subtitleSha256'],'PHP/JS subtitle digest diverged');
 foreach(['srt','vtt'] as $format){$r=$call('agentFile',['id'=>$jobId,'mode'=>'read','kind'=>$format,'offset'=>0]);check($r['done']&&base64_decode($r['data'])===file_get_contents($fixtures.'/subtitle-landscape.mp4.'.$format),'Subtitle export diverged');}
 refuses(fn()=>sa_dispatch('agentFile',['id'=>$jobId,'mode'=>'read','kind'=>'srt','offset'=>0],'other',$reader),'agent_job_unavailable');
 // Exercise final upload fencing with approved fixture assets in this isolated store.
 $raw=lab_read()['jobs'][$jobId];$raw['agent']['scenes']=[['n'=>1,'video'=>['accepted'=>true,'duration'=>3,'sha256'=>hash_file('sha256',$fixtures.'/clip-1.mp4')]],['n'=>2,'video'=>['accepted'=>true,'duration'=>3,'sha256'=>hash_file('sha256',$fixtures.'/clip-2.mp4')]]];
 $raw['agent']['active']=['kind'=>'final','scene'=>0,'requestId'=>$id(),'phase'=>'requested'];
 require_once __DIR__.'/../../bridge/session-agent-media.php';$bytes=file_get_contents($fixtures.'/subtitle-landscape.mp4');
 $upload=['mode'=>'write','offset'=>0,'operationId'=>$raw['agent']['active']['requestId'],'sha256'=>hash('sha256',$bytes),'bytes'=>strlen($bytes),'data'=>base64_encode($bytes),'verification'=>$receipt['verification']];
 $bad=$upload;$bad['verification']['subtitleSha256']=str_repeat('0',64);refuses(function()use(&$raw,$bad){sa_file($raw,$bad);},'subtitle_final_mismatch');
 check(sa_file($raw,$upload)['asset']['checks']['subtitlesBurned']===true,'Final subtitle proof not stored');
 $source['lyrics'].="\n원곡 변경";refuses(fn()=>$step('subtitles',['subtitles'=>$payload]),'source_changed_replan_required');
 echo "Subtitle state: automatic/review gates, source identity, exact lyrics, durable replay, owner exports and final burn proof passed.\n";
}finally{restore_error_handler();foreach(new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root,FilesystemIterator::SKIP_DOTS),RecursiveIteratorIterator::CHILD_FIRST)as$f){$f->isDir()?rmdir($f->getPathname()):unlink($f->getPathname());}rmdir($root);}
