<?php
declare(strict_types=1);
require __DIR__.'/../../deploy/noa-app/engine/host-load-policy.php';
require __DIR__.'/../../deploy/noa-app/engine/scheduled-wake.php';
function assert_equal(mixed $actual,mixed $expected,string $message):void {
    if ($actual!==$expected)throw new RuntimeException($message.': '.json_encode([$actual,$expected]));
}
// Deterministic Wednesday test fixture, KST. No network, writes, leases or jobs.
$zone=new DateTimeZone('Asia/Seoul');
$when=(new DateTimeImmutable('2026-11-18 08:00:00',$zone))->getTimestamp();
$schedule=[
    'version'=>2,'timezone'=>'Asia/Seoul','mediaStorage'=>['provider'=>'google_drive'],
    'maxPerLocalDate'=>1,'publishIsoWeekdays'=>[1,3,5],
    'prepareLocalTime'=>'08:00','publishLocalTime'=>'12:00'
];
$body=['action'=>'scheduled_wake','operation'=>'ai.daily_shorts_clock',
       'phase'=>'prepare','slot'=>'2026-11-18'];
$control=['stop'=>true,'paused'=>true,'activeOperations'=>[]];
$blocked=n80_host_load_policy();
assert_equal($blocked['githubWakeActivated'],false,'schedule must default inactive');
assert_equal($blocked['hostResidentRunnerAllowed'],false,'old runner must be forbidden');
$preview=n80_scheduled_wake_contract($body,$schedule,$blocked,$control,$when);
assert_equal($preview['reason'],'wake_activation_not_approved','default activation gate');
$simulated=array_replace($blocked,[
   'githubWakeActivated'=>true,'requiresHostingApproval'=>false,'n80BoundedExecutorVerified'=>true
]);
$accepted=n80_scheduled_wake_contract($body,$schedule,$simulated,$control,$when);
assert_equal($accepted['ok'],true,'simulated signed-gate contract');
assert_equal($accepted['executionAllowed'],false,'wake must never execute a job');
assert_equal($accepted['slotId'],'2026-11-18|prepare','slot identity');
$oldRunner=n80_scheduled_wake_contract($body,$schedule,$simulated,
    ['stop'=>false,'paused'=>false,'activeOperations'=>['ai.daily_shorts_clock']],$when);
assert_equal($oldRunner['reason'],'wake_legacy_runner_not_suspended','must not restart resident process');
$late=n80_scheduled_wake_contract($body,$schedule,$simulated,$control,$when+1201);
assert_equal($late['reason'],'wake_outside_time_window','time-window bound');
$wrong=n80_scheduled_wake_contract(array_replace($body,['slot'=>'2026-11-17']),
    $schedule,$simulated,$control,$when);
assert_equal($wrong['reason'],'wake_slot_invalid','M/W/F schedule bound');
$snapshot=n80_scheduled_wake_snapshot($blocked,$control);
assert_equal($snapshot['activated'],false,'read-only report is not an activation');
echo "N80 signed-wake contract: fail-closed, bounded and resident-runner isolated\n";
