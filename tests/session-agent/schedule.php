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
$r=nd_shorts_tick($s,$p,$t('2026-11-09 12:00:00'),$blocked);verify_schedule($r['campaign']['nextPublicationAt']==='2026-11-11T12:00:00+09:00','Skip Tuesday after Monday noon');
nd_shorts_tick($s,$p,$t('2026-11-11 08:00:00'),$blocked);verify_schedule($s['campaigns']['daily_shorts']['current']['date']==='2026-11-11'&&count($s['jobs'])===0,'Next selected date keeps one pending slot');
$s['campaigns']['daily_shorts']['current']['jobId']='existing';$s['campaigns']['daily_shorts']['current']['date']='2026-11-10';
nd_shorts_tick($s,$p,$t('2026-11-11 08:00:00'),$blocked);verify_schedule($s['campaigns']['daily_shorts']['current']['date']==='2026-11-10','Keep resumable work');
$s['campaigns']['daily_shorts']['enabled']=false;$r=nd_shorts_tick($s,$p,$t('2026-11-11 08:30:00'),$blocked);verify_schedule($r['state']==='paused'&&$r['campaign']['productionReady']===false,'Pause and honest readiness');
verify_schedule($r['campaign']['conversationDependent']===false&&$r['uploads']===0,'No fabricated publication');
$cases=[
 ['2026-11-10 00:00:00','2026-11-11'],['2026-11-11 11:59:59','2026-11-11'],
 ['2026-11-11 12:00:00','2026-11-13'],['2026-11-13 12:00:00','2026-11-16'],
 ['2026-11-14 08:00:00','2026-11-16'],['2026-11-15 23:59:59','2026-11-16'],
 ['2026-12-31 23:59:59','2027-01-01'],['2027-01-01 12:00:00','2027-01-04']];
foreach($cases as [$input,$date]){
 $slot=nd_shorts_schedule($p,$t($input));
 verify_schedule($slot['target']->format(DATE_ATOM)===$date.'T12:00:00+09:00','Weekday/rollover '.$input);
 verify_schedule($slot['due']->format(DATE_ATOM)===$date.'T08:00:00+09:00','Preparation uses the same date');
}
$slot=nd_shorts_schedule($p,strtotime('2026-11-08T23:00:00Z'));
verify_schedule($slot['target']->format(DATE_ATOM)==='2026-11-09T12:00:00+09:00','UTC Sunday is KST Monday');
foreach([null,[],[0],[8],['1'],[1,1],[1.5]] as $days){
 $invalid=$p;$invalid['publishIsoWeekdays']=$days;$rejected=false;
 try{nd_shorts_schedule($invalid,$t('2026-11-09 08:00:00'));}catch(DomainException $e){$rejected=true;}
 verify_schedule($rejected,'Reject invalid weekdays, never default to every day');
}
$migration=['config'=>['workerEnabled'=>true],'jobs'=>[],'events'=>[],'campaigns'=>['daily_shorts'=>[
 'enabled'=>true,'current'=>['date'=>'2026-11-10','publishAt'=>'2026-11-10T12:00:00+09:00','jobId'=>null,'videoId'=>null]]]];
$before=$migration;
nd_shorts_tick($migration,$p,$t('2026-11-10 08:00:00'),$blocked);
verify_schedule($migration['campaigns']['daily_shorts']['current']===null,'Remove only obsolete empty Tuesday slot');
foreach(['jobId','videoId'] as $field){
 $keep=$before;$keep['campaigns']['daily_shorts']['current'][$field]='existing';$original=$keep['campaigns']['daily_shorts']['current'];
 nd_shorts_tick($keep,$p,$t('2026-11-10 08:00:00'),$blocked);
 verify_schedule($keep['campaigns']['daily_shorts']['current']===$original,'Do not relabel existing work or upload');
}
echo "N80 Shorts: M/W/F KST noon, weekends, UTC/year boundaries, invalid policy, slot migration, resume and dedup passed.\n";
