<?php
declare(strict_types=1);
/** Synthetic Hub store only. No bootstrap, providers, host or real approvals. */
$state=[];$writes=0;$overrides=[];$failWrite=false;
function n80_hub_read(string $root,string $name,array $default=[]):array {global $state;return $state[$name]??$default;}
function n80_hub_write(string $root,string $name,array $value):void {
    global $state,$writes,$failWrite;if($failWrite)throw new RuntimeException('simulated_write_failure');
    $state[$name]=$value;$writes++;
}
function n80_hub_locked(string $root,callable $fn,int $waitMs=750):mixed {return $fn();}
function n80_host_load_policy():array {global $overrides;return array_replace([
    'githubActionsRole'=>'scheduled_wake_signal_only','githubWorkerDispatchAllowed'=>false,
    'githubBusinessExecutionAllowed'=>false,'hostResidentRunnerAllowed'=>false,
    'hostLegacyHeartbeatAllowed'=>false,'hostLegacyBatchExecuteAllowed'=>false,
    'githubWakeActivated'=>true,'requiresHostingApproval'=>false,'n80BoundedExecutorVerified'=>true,
],$overrides);}
$fixtureDir=sys_get_temp_dir().'/n80-clock-'.bin2hex(random_bytes(8));mkdir($fixtureDir,0700);
foreach(['one-shot-clock.php','scheduled-wake.php'] as $file)
    copy(__DIR__.'/../../deploy/noa-app/engine/'.$file,$fixtureDir.'/'.$file);
file_put_contents($fixtureDir.'/daily-shorts.json',json_encode([
    'version'=>2,'timezone'=>'Asia/Seoul','mediaStorage'=>['provider'=>'google_drive'],
    'maxPerLocalDate'=>1,'publishIsoWeekdays'=>[1,3,5],'prepareLocalTime'=>'08:00','publishLocalTime'=>'12:00',
]));
register_shutdown_function(static function()use($fixtureDir):void {
    foreach(['one-shot-clock.php','scheduled-wake.php','daily-shorts.json'] as $file)unlink($fixtureDir.'/'.$file);
    rmdir($fixtureDir);
});
require $fixtureDir.'/one-shot-clock.php';
function must(bool $ok,string $why):void {if(!$ok)throw new RuntimeException($why);}
function denied(callable $fn,string $why):void {
    try{$fn();}catch(Throwable $e){must($e->getMessage()===$why,'wrong failure '.$e->getMessage());return;}
    throw new RuntimeException('did not reject '.$why);
}
$now=(new DateTimeImmutable('2026-11-18T08:00:02+09:00'))->getTimestamp();
$body=['action'=>'scheduled_wake','operation'=>'ai.daily_shorts_clock','phase'=>'prepare','slot'=>'2026-11-18'];
$slot='2026-11-18|prepare';
$state=['control.json'=>['stop'=>true,'paused'=>true,'activeOperations'=>[]],
    'scheduled-wake-control.json'=>['version'=>1,'enabled'=>true,'paused'=>false,'stop'=>false,
        'hostingApproved'=>true,'boundedExecutorVerified'=>true],
    'scheduled-wakes.json'=>['version'=>1,'slots'=>[$slot=>[
        'operation'=>'ai.daily_shorts_clock','phase'=>'prepare','scheduledAt'=>$now-2,'receivedAt'=>$now,
        'state'=>'signal_admitted_not_executed','executionVerified'=>false,'mediaCreated'=>false,'youtubePublished'=>false]]]];
$baseline=$state;
$claim=n80_one_shot_clock_claim('/fixture',$body,$now);
must($claim['claimed']&&$writes===1,'one durable claim');
must(n80_one_shot_clock_recheck('/fixture',$body,$claim,$now),'initial recheck');
$before=$state;
must(!n80_one_shot_clock_claim('/fixture',$body,$now)['claimed']&&$state===$before,'no duplicate claim');
$state['scheduled-wake-control.json']['stop']=true;
must(!n80_one_shot_clock_recheck('/fixture',$body,$claim,$now),'post-bootstrap stop wins');
$state=$before;
must(!n80_one_shot_clock_recheck('/fixture',$body,$claim,$now+1200),'time window closes');
$good=['ok'=>true,'module'=>'lab','state'=>'connection_required','processed'=>0,'uploads'=>0,
    'privateCredential'=>'DO_NOT_COPY'];
$receipt=n80_one_shot_clock_finish('/fixture',$claim,$good,$now+1);
must($receipt['state']==='clock_checked_not_produced'&&!$receipt['businessExecutionVerified']
    &&!$receipt['mediaCreated']&&!$receipt['youtubePublished'],'clock is not production');
must(!str_contains(json_encode($state),'DO_NOT_COPY'),'no raw result persisted');
must($state['control.json']===$baseline['control.json'],'legacy control preserved');
denied(fn()=>n80_one_shot_clock_finish('/fixture',$claim,$good,$now+2),'wake_clock_receipt_conflict');
foreach([
    ['githubWakeActivated'=>false],['requiresHostingApproval'=>true],['n80BoundedExecutorVerified'=>false],
    ['hostLegacyHeartbeatAllowed'=>true],['hostLegacyBatchExecuteAllowed'=>true],
    ['hostResidentRunnerAllowed'=>true],['githubBusinessExecutionAllowed'=>true],['githubWorkerDispatchAllowed'=>true],
] as $overrides){
    $state=$baseline;$before=$state;$beforeWrites=$writes;
    must(!n80_one_shot_clock_claim('/fixture',$body,$now)['claimed']&&$state===$before&&$writes===$beforeWrites,
        'revoked policy must not write');
}
$overrides=[];
foreach(['stop'=>true,'paused'=>true,'enabled'=>false,'hostingApproved'=>false,'boundedExecutorVerified'=>false] as $k=>$v){
    $state=$baseline;$state['scheduled-wake-control.json'][$k]=$v;$before=$state;
    must(!n80_one_shot_clock_claim('/fixture',$body,$now)['claimed']&&$state===$before,'wake control gate');
}
foreach([null,array_replace($good,['processed'=>1]),array_replace($good,['uploads'=>1]),
    array_replace($good,['module'=>'media']),array_replace($good,['state'=>'host_owned']),
    ['ok'=>false,'error'=>'secret_failure']] as $bad){
    $state=$baseline;$claim=n80_one_shot_clock_claim('/fixture',$body,$now);
    $receipt=n80_one_shot_clock_finish('/fixture',$claim,$bad,$now+1);
    must($receipt['state']==='clock_outcome_unconfirmed'&&!$receipt['automaticRetryAllowed'],'uncertainty preserved');
    $state['scheduled-wakes.json']['slots']['2026-11-16|prepare']=$state['scheduled-wakes.json']['slots'][$slot];
    $state['scheduled-wakes.json']['slots'][$slot]=$baseline['scheduled-wakes.json']['slots'][$slot];
    $before=$state;
    must(n80_one_shot_clock_claim('/fixture',$body,$now)['state']==='clock_previous_outcome_unconfirmed'
        &&$state===$before,'unconfirmed prior call blocks overlapping work');
}
$state=$baseline;$failWrite=true;
denied(fn()=>n80_one_shot_clock_claim('/fixture',$body,$now),'simulated_write_failure');
must($state===$baseline,'failed claim does not authorize work');$failWrite=false;
$claim=n80_one_shot_clock_claim('/fixture',$body,$now);$before=$state;$failWrite=true;
denied(fn()=>n80_one_shot_clock_finish('/fixture',$claim,$good,$now+1),'simulated_write_failure');
must($state===$before,'lost final receipt stays started-unconfirmed');$failWrite=false;
must(!n80_one_shot_clock_claim('/fixture',$body,$now)['claimed'],'lost receipt never retried');
$state=$baseline;$claim=n80_one_shot_clock_claim('/fixture',$body,$now);
$receipt=n80_one_shot_clock_finish('/fixture',$claim,null,$now+1,true);
must($receipt['state']==='cancelled_before_clock','pre-call revocation recorded');
$state=$baseline;$before=$state;
$publish=array_replace($body,['phase'=>'publish']);
must(n80_one_shot_clock_claim('/fixture',$publish,$now+4*3600)['state']==='publish_handler_not_verified'
    &&$state===$before,'publish cannot become next-day preparation');
$state=$baseline;$state['scheduled-wakes.json']['slots'][$slot]['scheduledAt']++;
denied(fn()=>n80_one_shot_clock_claim('/fixture',$body,$now),'wake_ticket_mismatch');
echo "N80_ONE_SHOT_CLOCK_PASS durable attempt, duplicate/uncertain preservation, policy/stop races, clock-only outcome\n";
