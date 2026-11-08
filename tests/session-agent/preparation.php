<?php
declare(strict_types=1);
define('_GNUBOARD_',true);require __DIR__.'/../../bridge/session-shorts-prepare.php';
function check_prepare(bool $ok,string $reason):void {if(!$ok)throw new RuntimeException($reason);}
function reject_prepare(callable $fn,string $reason):void {try{$fn();}catch(DomainException|InvalidArgumentException $e){return;}throw new RuntimeException($reason);}
$p=json_decode(file_get_contents(__DIR__.'/../../config/n80-daily-shorts.json'),true);
$s=['config'=>['workerEnabled'=>true],'campaigns'=>['daily_shorts'=>['enabled'=>true]]];$now=strtotime('2026-11-09T03:00:00+09:00');
$first=nd_prepare_claim($s,$p,$now);check_prepare($first['claimed']&&$first['date']==='2026-11-09','Immediate bootstrap within existing campaign');
$b=['lease'=>$first['lease']];nd_prepare_authorize($s,$b,$now+1);
check_prepare(!nd_prepare_claim($s,$p,$now+10)['claimed'],'No overlapping worker');
reject_prepare(fn()=>nd_prepare_authorize($s,['lease'=>'wrong'],$now+1),'Reject stale worker');
reject_prepare(fn()=>nd_prepare_authorize($s,$b,$now+1800),'Reject expired worker');
$again=nd_prepare_claim($s,$p,$now+1801);check_prepare($again['claimed']&&$again['lease']!==$first['lease'],'Recover after runner death');
reject_prepare(fn()=>nd_prepare_authorize($s,$b,$now+1802),'Old executor fenced');
$safe=nd_shorts_public($s['campaigns']['daily_shorts']);check_prepare(!isset($safe['preparation']['lease'])&&!isset($safe['preparation']['sources']),'Do not expose leases/source paths');
$s['campaigns']['daily_shorts']['preparation']['state']='analyzed';$s['campaigns']['daily_shorts']['preparation']['leaseUntil']=0;
check_prepare(!nd_prepare_claim($s,$p,$now+1803)['claimed'],'Do not redo same-day analysis');
check_prepare(nd_prepare_claim($s,$p,strtotime('2026-11-10T07:59:00+09:00'))['state']==='waiting_schedule','Following date follows morning schedule');
check_prepare(nd_prepare_claim($s,$p,strtotime('2026-11-10T08:00:00+09:00'))['claimed'],'Next day preparation');
$s['campaigns']['daily_shorts']['enabled']=false;reject_prepare(fn()=>nd_prepare_authorize($s,['lease'=>$s['campaigns']['daily_shorts']['preparation']['lease']],strtotime('2026-11-10T08:01:00+09:00')),'Pause revokes access');
reject_prepare(fn()=>nd_prepare_youtube_query(['resource'=>'videos','ids'=>['../secrets']],$p),'Reject arbitrary proxy request');
reject_prepare(fn()=>nd_prepare_youtube_query(['resource'=>'delete','ids'=>['AAAAAAAAAAA']],$p),'Read-only API surface');
$sources=[];$candidates=[];for($i=1;$i<=3;$i++){$key='song'.$i;$sources[$key]=['revision'=>3,'audioSha256'=>str_repeat((string)$i,64),'videoId'=>str_repeat((string)$i,11),'duration'=>210];$candidates[]=['trackKey'=>$key,'sourceRevision'=>3,'audioSha256'=>$sources[$key]['audioSha256'],'videoId'=>$sources[$key]['videoId'],'audioAnalysis'=>['duration'=>210,'alignmentVerified'=>false,'candidates'=>[['start'=>20,'end'=>75,'score'=>.7]]]];}
$report=nd_prepare_report(['candidates'=>$candidates],$sources);check_prepare(!$report['publicationReady']&&!$report['audioListeningReviewed'],'Analysis is not a publication or listening receipt');
$bad=$candidates;$bad[0]['audioSha256']=str_repeat('0',64);reject_prepare(fn()=>nd_prepare_report(['candidates'=>$bad],$sources),'Reject wrong original');
$bad=$candidates;$bad[0]['audioAnalysis']['candidates'][0]['end']=81;reject_prepare(fn()=>nd_prepare_report(['candidates'=>$bad],$sources),'49–59 seconds only');
echo "N80 preparation: lease recovery, pause, daily dedup, source binding, API boundaries and honest measurements passed.\n";
