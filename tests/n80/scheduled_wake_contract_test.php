<?php
declare(strict_types=1);
require __DIR__.'/../../deploy/noa-app/engine/host-load-policy.php';
require __DIR__.'/../../deploy/noa-app/engine/scheduled-wake.php';
function assert_equal(mixed $actual,mixed $expected,string $why):void{
    if($actual!==$expected)throw new RuntimeException($why.': '.json_encode([$actual,$expected]));
}
// Fixed Wednesday KST fixture. No hosting access, HTTP, queue, writes or jobs.
$zone=new DateTimeZone('Asia/Seoul');
$when=(new DateTimeImmutable('2026-11-18 08:00:00',$zone))->getTimestamp();
$schedule=[
    'version'=>2,'timezone'=>'Asia/Seoul','mediaStorage'=>['provider'=>'google_drive'],
    'maxPerLocalDate'=>1,'publishIsoWeekdays'=>[1,3,5],
    'prepareLocalTime'=>'08:00','publishLocalTime'=>'12:00'
];
$body=['action'=>'scheduled_wake','operation'=>'ai.daily_shorts_clock',
       'phase'=>'prepare','slot'=>'2026-11-18'];
$control=['stop'=>true,'paused'=>true,'activeOperations'=>['ai.daily_shorts_clock']];
$oneShot=['version'=>1,'enabled'=>true,'paused'=>false,'stop'=>false,
          'hostingApproved'=>true,'boundedExecutorVerified'=>true];
$blocked=n80_host_load_policy();
assert_equal($blocked['githubWakeActivated'],false,'default schedule inactive');
assert_equal($blocked['hostResidentRunnerAllowed'],false,'resident runner prohibited');
$preview=n80_scheduled_wake_contract($body,$schedule,$blocked,$control,$when);
assert_equal($preview['reason'],'wake_activation_not_approved','host approval gate');
$simulated=array_replace($blocked,[
    'githubWakeActivated'=>true,'requiresHostingApproval'=>false,'n80BoundedExecutorVerified'=>true
]);
$accepted=n80_scheduled_wake_contract($body,$schedule,$simulated,$control,$when,$oneShot);
assert_equal($accepted['ok'],true,'simulated one-shot contract');
assert_equal($accepted['executionAllowed'],false,'wake never runs business tasks');
assert_equal($accepted['slotId'],'2026-11-18|prepare','slot id');
$missing=n80_scheduled_wake_contract($body,$schedule,$simulated,$control,$when);
assert_equal($missing['reason'],'wake_one_shot_suspended','missing private control denied');
$stopped=n80_scheduled_wake_contract($body,$schedule,$simulated,$control,$when,
    array_replace($oneShot,['stop'=>true]));
assert_equal($stopped['reason'],'wake_one_shot_suspended','one-shot emergency stop');
$old=n80_scheduled_wake_contract($body,$schedule,$simulated,
    ['stop'=>false,'paused'=>false,'activeOperations'=>['ai.daily_shorts_clock']],$when,$oneShot);
assert_equal($old['reason'],'wake_legacy_runner_not_suspended','retired resident runner must stay off');
$late=n80_scheduled_wake_contract($body,$schedule,$simulated,$control,$when+1201,$oneShot);
assert_equal($late['reason'],'wake_outside_time_window','bounded schedule window');
$wrong=n80_scheduled_wake_contract(array_replace($body,['slot'=>'2026-11-17']),
    $schedule,$simulated,$control,$when,$oneShot);
assert_equal($wrong['reason'],'wake_slot_invalid','weekday constraint');
$snapshot=n80_scheduled_wake_snapshot($blocked,$control,[]);
assert_equal($snapshot['activated'],false,'read-only state is never activation');
echo "N80 signed-wake contract: fail-closed, bounded, paused legacy isolated\n";
