<?php
declare(strict_types=1);
define('_GNUBOARD_',true);require __DIR__.'/../../bridge/session-shorts-subtitles.php';require __DIR__.'/../../bridge/session-shorts.php';
function check_caption(bool $ok,string $why):void{if(!$ok)throw new RuntimeException($why);}
function reject_caption(callable $f,string $why):void{try{$f();}catch(DomainException|InvalidArgumentException $e){return;}throw new RuntimeException($why);}
$now=strtotime('2026-11-09T08:00:00+09:00');
$lyrics="[Chorus]\n(soft gayageum harmonics, female vocal)\n별빛이 내려와\n(I love you)\n(아~)";
check_caption(sa_lyric_lines($lyrics)===['별빛이 내려와','(I love you)','(아~)'],'Remove explicit directions while preserving sung parentheses');
$source=['key'=>'single:test:1','revision'=>2,'audioSha256'=>str_repeat('a',64),'lyrics'=>$lyrics,'duration'=>100,'audioPath'=>'/private/source.mp3'];
$read=function($key)use(&$source){check_caption($key===$source['key'],'Exact registered key');return $source;};
$s=['config'=>['workerEnabled'=>true],'campaigns'=>['daily_shorts'=>['enabled'=>true,'preparation'=>['state'=>'analyzed','publishAt'=>'2026-11-09T12:00:00+09:00',
 'report'=>['candidates'=>[['trackKey'=>$source['key'],'sourceRevision'=>2,'audioSha256'=>$source['audioSha256'],'videoId'=>'AAAAAAAAAAA']]]]]]];
$first=nd_caption_claim($s,$now,$read);check_caption($first['claimed']&&$first['source']['audioPath']==='/private/source.mp3','Claim existing private original');$b=['lease'=>$first['lease']];
check_caption(nd_caption_claim($s,$now+1,$read)['state']==='recognizing','No overlapping recognition');
reject_caption(fn()=>nd_caption_authorize($s,['lease'=>'stale'],$now+1),'Reject stale executor');
reject_caption(fn()=>nd_caption_authorize($s,$b,$now+1200),'Reject expired executor');
$second=nd_caption_claim($s,$now+1201,$read);check_caption($second['claimed']&&$second['lease']!==$first['lease'],'Resume after worker loss');
reject_caption(fn()=>nd_caption_authorize($s,$b,$now+1202),'Old executor fenced');
$b=['lease'=>$second['lease'],'subtitles'=>['sourceAudioSha256'=>$source['audioSha256'],'lyricsSha256'=>hash('sha256',$lyrics),'method'=>'faster-whisper','model'=>'small',
 'cues'=>[['line'=>1,'text'=>'별빛이 내려와','startMs'=>2000,'endMs'=>4000,'match'=>1,'probability'=>.95,'maxWordGapMs'=>0]]]];
$safe=nd_shorts_public($s['campaigns']['daily_shorts']);check_caption(!isset($safe['preparation']['subtitlePreparation']['lease'])&&!isset($safe['preparation']['subtitlePreparation']['sourceFingerprint']),'Public output cannot expose worker credentials');
$bad=$b;$bad['subtitles']['cues'][0]['text']='다른 가사';reject_caption(function()use(&$s,$bad,$now,$read){nd_caption_complete($s,$bad,$now+1202,$read);},'Reject substituted lyrics');
$source['revision']=3;reject_caption(function()use(&$s,$b,$now,$read){nd_caption_complete($s,$b,$now+1202,$read);},'Reject changed current song');$source['revision']=2;
$paused=$s;$paused['config']['workerEnabled']=false;check_caption(nd_caption_claim($paused,$now+1202,$read)['state']==='paused','Respect pause');reject_caption(fn()=>nd_caption_authorize($paused,$b,$now+1202),'Paused writes blocked');
$result=nd_caption_complete($s,$b,$now+1202,$read);check_caption($result['state']==='needs_review'&&$result['issueCount']===2&&!$result['publicationReady']&&!$result['audioListeningReviewed'],'Partial ASR never becomes a reviewed movie');
check_caption($result['nonKoreanLineCount']===1,'English lyrics remain visible for translation review');
check_caption(!nd_caption_claim($s,$now+1203,$read)['claimed'],'Saved result is not regenerated');
check_caption(nd_caption_claim($s,strtotime('2026-11-09T12:00:00+09:00'),$read)['state']==='preparation_date_expired','Never recognize stale publication date');
$s['campaigns']['daily_shorts']['preparation']['subtitlePreparation']['state']='subtitle_failed';$s['campaigns']['daily_shorts']['preparation']['subtitlePreparation']['attempts']=3;
check_caption(nd_caption_claim($s,$now+1204,$read)['state']==='subtitle_retry_limit','Bounded retries');
echo "N80 automatic subtitles: existing source, lease recovery, pause, bounded retries, exact-lyric validation, dedup and honest review state passed.\n";
