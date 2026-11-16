<?php
declare(strict_types=1);
/**
 * Isolated, in-memory contract tests for N80 scheduled wake admission.
 * No host filesystem, HTTP requests, provider calls or queue workers.
 * The simulated approvals below are NOT production approvals.
 */
$state=[];
$writes=[];
function n80_hub_read(string $root,string $name,array $default=[]):array {
    global $state;
    return $state[$name]??$default;
}
function n80_hub_write(string $root,string $name,array $value):void {
    global $state,$writes;
    $state[$name]=$value;
    $writes[]=$name;
}
function n80_hub_locked(string $root,callable $fn,int $waitMs=750):mixed {
    return $fn();
}
function n80_host_load_policy():array {
    return [
        'githubActionsRole'=>'scheduled_wake_signal_only',
        'githubWorkerDispatchAllowed'=>false,
        'githubBusinessExecutionAllowed'=>false,
        'hostResidentRunnerAllowed'=>false,
        'hostLegacyHeartbeatAllowed'=>false,
        'hostLegacyBatchExecuteAllowed'=>false,
        'githubWakeActivated'=>true,
        'requiresHostingApproval'=>false,
        'n80BoundedExecutorVerified'=>true,
    ];
}
require __DIR__.'/../../deploy/noa-app/engine/scheduled-wake.php';
function must(bool $condition,string $reason):void {
    if(!$condition)throw new RuntimeException('one-shot contract failed: '.$reason);
}
function throws(callable $task,string $reason):void {
    try{$task();}catch(DomainException $e){
        must($e->getMessage()===$reason,'unexpected reason '.$e->getMessage());
        return;
    }
    throw new RuntimeException('one-shot contract must reject: '.$reason);
}
$schedule=[
    'version'=>2,
    'timezone'=>'Asia/Seoul',
    'mediaStorage'=>['provider'=>'google_drive'],
    'maxPerLocalDate'=>1,
    'publishIsoWeekdays'=>[1,3,5],
    'prepareLocalTime'=>'08:00',
    'publishLocalTime'=>'12:00',
];
$control=['stop'=>true,'paused'=>true,'activeOperations'=>['ai.daily_shorts_clock']];
$wakeControl=[
    'version'=>1,'enabled'=>true,'stop'=>false,'paused'=>false,
    'hostingApproved'=>true,'boundedExecutorVerified'=>true,
];
$state['control.json']=$control;
$state['scheduled-wake-control.json']=$wakeControl;
$zone=new DateTimeZone('Asia/Seoul');
$now=(new DateTimeImmutable('2026-11-18 08:00:02',$zone))->getTimestamp();
$body=['action'=>'scheduled_wake','operation'=>'ai.daily_shorts_clock',
       'phase'=>'prepare','slot'=>'2026-11-18'];
$admission=n80_scheduled_wake_contract($body,$schedule,n80_host_load_policy(),
    $control,$now,$wakeControl);
must(($admission['ok']??null)===true && $admission['executionAllowed']===false,
    'admission must be signal-only');
$nonceA=str_repeat('a',32);
$result=n80_scheduled_wake_admit('/in-memory-test',$admission,$nonceA,$now);
must(($result['state']??'')==='signal_admitted_not_executed','ticket not recorded');
$ticket=$state['scheduled-wakes.json']['slots']['2026-11-18|prepare']??[];
must(($ticket['executionVerified']??null)===false
    && ($ticket['mediaCreated']??null)===false
    && ($ticket['youtubePublished']??null)===false,
    'ticket must not imply execution or publication');
must(count($state['scheduled-wakes.json']['slots'])===1
    && count($state['scheduled-wake-nonces.json'])===1,
    'exactly one slot and nonce');
$writeCount=count($writes);
$duplicate=n80_scheduled_wake_admit('/in-memory-test',$admission,str_repeat('b',32),$now+1);
must($duplicate['state']==='duplicate_signal'
    && count($writes)===$writeCount
    && count($state['scheduled-wakes.json']['slots'])===1,
    'duplicate slot must not produce a second task');
throws(static fn()=>n80_scheduled_wake_admit('/in-memory-test',$admission,$nonceA,$now+2),
    'wake_replay');
// Simulate a distinct, still-authorized publication slot.
$publish=array_replace($body,['phase'=>'publish']);
$publishAt=(new DateTimeImmutable('2026-11-18 12:00:01',$zone))->getTimestamp();
$publishAdmission=n80_scheduled_wake_contract($publish,$schedule,n80_host_load_policy(),
    $control,$publishAt,$wakeControl);
must(($publishAdmission['ok']??false)===true,'publish slot contract');
throws(static fn()=>n80_scheduled_wake_admit('/in-memory-test',
    $publishAdmission,$nonceA,$publishAt),'wake_replay');
must(count($state['scheduled-wakes.json']['slots'])===1,'replayed nonce did not add publish slot');
// An emergency stop applied just before admission must win.
$state['scheduled-wake-control.json']['stop']=true;
throws(static fn()=>n80_scheduled_wake_admit('/in-memory-test',
    $publishAdmission,str_repeat('c',32),$publishAt),'wake_revoked_before_commit');
must(count($state['scheduled-wakes.json']['slots'])===1,'stopped admission must not mutate ledger');
$state['scheduled-wake-control.json']=$wakeControl;
$state['control.json']['paused']=false;
throws(static fn()=>n80_scheduled_wake_admit('/in-memory-test',
    $publishAdmission,str_repeat('d',32),$publishAt),'wake_revoked_before_commit');
must(count($state['scheduled-wakes.json']['slots'])===1,'retired runner cannot restart');
throws(static fn()=>n80_scheduled_wake_admit('/in-memory-test',
    ['ok'=>false],str_repeat('e',32),$now),'wake_invalid_admission');
echo "N80 one-shot wake ticket: exactly-once, nonce replay, emergency stop, no business execution PASS\n";
