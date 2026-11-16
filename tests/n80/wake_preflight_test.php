<?php
declare(strict_types=1);
require __DIR__.'/../../deploy/noa-app/engine/wake-preflight.php';
function n80_preflight_assert(bool $ok,string $reason):void {
 if(!$ok)throw new RuntimeException('N80_PREFLIGHT: '.$reason);
}
$base=sys_get_temp_dir().'/n80-one-shot-preflight-'.bin2hex(random_bytes(8));
$root=$base.'/private';$web=$base.'/html';
mkdir($root,0700,true);mkdir($web.'/noa-app/engine',0700,true);
$key=$root.'/scheduled-wake.key';
$schedule=$web.'/noa-app/engine/daily-shorts.json';
$policy=[
 'githubActionsRole'=>'scheduled_wake_signal_only',
 'githubWorkerDispatchAllowed'=>false,'githubBusinessExecutionAllowed'=>false,
 'requiresHostingApproval'=>true,'n80BoundedExecutorVerified'=>false,
 'githubWakeActivated'=>false
];
$legacy=['stop'=>true,'paused'=>true,'activeOperations'=>[]];
$oneShot=['version'=>1,'enabled'=>false,'paused'=>true,'stop'=>true,
 'hostingApproved'=>false,'boundedExecutorVerified'=>false];
$removed=['verified'=>true];
try {
 $state=n80_wake_preflight($root,$web,$policy,$legacy,$oneShot,$removed);
 n80_preflight_assert(!$state['productionReady']&&!$state['signedCanaryVerified']&&$state['hostWrites']===0,'no_execution_claims');
 n80_preflight_assert(in_array('dedicatedKeyMetadataSecure',$state['blockers'],true),'missing_key_blocked');
 n80_preflight_assert(in_array('clockConfigMatchesSender',$state['blockers'],true),'missing_schedule_blocked');
 file_put_contents($key,str_repeat('a',64));chmod($key,0644);
 $state=n80_wake_preflight($root,$web,$policy,$legacy,$oneShot,$removed);
 n80_preflight_assert(!$state['checks']['dedicatedKeyMetadataSecure'],'insecure_key_blocked');
 chmod($key,0600);
 file_put_contents($schedule,json_encode([
    'version'=>2,'timezone'=>'Asia/Seoul','prepareLocalTime'=>'08:00',
    'publishLocalTime'=>'12:00','publishIsoWeekdays'=>[1,3,5],
    'mediaStorage'=>['provider'=>'google_drive'],'maxPerLocalDate'=>1
 ]));
 $state=n80_wake_preflight($root,$web,$policy,$legacy,$oneShot,$removed);
 n80_preflight_assert($state['checks']['clockConfigMatchesSender']&&$state['checks']['dedicatedKeyMetadataSecure'],'safe_fixture');
 n80_preflight_assert(!$state['eligibleForSignedCanary'],'unapproved_host_blocked');
 $oneShot['enabled']=true;$oneShot['stop']=false;$oneShot['paused']=false;
 $oneShot['hostingApproved']=true;$oneShot['boundedExecutorVerified']=true;
 $policy['requiresHostingApproval']=false;$policy['githubWakeActivated']=true;
 $policy['n80BoundedExecutorVerified']=true;
 $state=n80_wake_preflight($root,$web,$policy,$legacy,$oneShot,$removed);
 n80_preflight_assert($state['eligibleForSignedCanary']&&!$state['productionReady'],'eligibility_not_activation');
 $state=n80_wake_preflight($root,$web,$policy,['stop'=>false,'paused'=>false],$oneShot,$removed);
 n80_preflight_assert(!$state['eligibleForSignedCanary'],'retired_runner_stays_off');
 $state=n80_wake_preflight($root,$web,$policy,$legacy,$oneShot,['verified'=>false]);
 n80_preflight_assert(!$state['eligibleForSignedCanary'],'physical_removal_required');
 file_put_contents($schedule,'{}');
 $state=n80_wake_preflight($root,$web,$policy,$legacy,$oneShot,$removed);
 n80_preflight_assert(!$state['eligibleForSignedCanary'],'invalid_schedule_blocked');
 echo "N80_READONLY_ONE_SHOT_PREFLIGHT_PASS\n";
}finally{
 if(is_file($key))unlink($key);if(is_file($schedule))unlink($schedule);
 rmdir($web.'/noa-app/engine');rmdir($web.'/noa-app');rmdir($web);rmdir($root);rmdir($base);
}
