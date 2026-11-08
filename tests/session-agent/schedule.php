<?php
declare(strict_types=1);
define('_GNUBOARD_',true);require __DIR__.'/../../bridge/session-shorts.php';
function verify_schedule($b,$why){if(!$b)throw new RuntimeException($why);}
$p=json_decode(file_get_contents(__DIR__.'/../../config/n80-daily-shorts.json'),true);
$s=['config'=>['workerEnabled'=>true],'jobs'=>[],'events'=>[]];$blocked=['ready'=>false,'missing'=>['persistent_browser_executor_required']];
$t=fn($local)=>strtotime($local.' +09:00');
$r=nd_shorts_tick($s,$p,$t('2026-11-09 07:59:00'),$blocked);verify_schedule($r['state']==='connection_required'&&$r['campaign']['current']===null,'No premature job');
$r=nd_shorts_tick($s,$p,$t('2026-11-09 08:00:00'),$blocked);$pending=$r['campaign']['current'];verify_schedule($pending['date']==='2026-11-09'&&$pending['jobId']===null,'One durable due slot');
for($i=0;$i<4;$i++)nd_shorts_tick($s,$p,$t('2026-11-09 09:00:00'),$blocked);
verify_schedule($s['campaigns']['daily_shorts']['current']===$pending&&count($s['events'])===1&&$s['jobs']===[],'Repeated ticks create no duplicate jobs or state events');
$r=nd_shorts_tick($s,$p,$t('2026-11-09 12:00:00'),$blocked);verify_schedule($r['campaign']['nextPublicationAt']==='2026-11-10T12:00:00+09:00','Never backdate noon');
nd_shorts_tick($s,$p,$t('2026-11-10 08:00:00'),$blocked);verify_schedule($s['campaigns']['daily_shorts']['current']['date']==='2026-11-10'&&count($s['jobs'])===0,'Missed day keeps one pending slot');
$s['campaigns']['daily_shorts']['current']['jobId']='existing';$s['campaigns']['daily_shorts']['current']['date']='2026-11-10';
nd_shorts_tick($s,$p,$t('2026-11-11 08:00:00'),$blocked);verify_schedule($s['campaigns']['daily_shorts']['current']['date']==='2026-11-10','Keep resumable work');
$s['campaigns']['daily_shorts']['enabled']=false;$r=nd_shorts_tick($s,$p,$t('2026-11-11 08:30:00'),$blocked);verify_schedule($r['state']==='paused'&&$r['campaign']['productionReady']===false,'Pause and honest readiness');
verify_schedule($r['campaign']['conversationDependent']===false&&$r['uploads']===0,'No fabricated publication');
echo "N80 daily Shorts: durable date/slot, KST noon, retries, resumable work, pause and honest executor blocker passed.\n";
