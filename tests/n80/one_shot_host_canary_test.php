<?php
declare(strict_types=1);
require __DIR__.'/../../deploy/noa-app/engine/host-load-policy.php';
require __DIR__.'/../../deploy/noa-app/engine/one-shot-host-canary.php';
function must(bool $condition,string $reason):void {
    if(!$condition)throw new RuntimeException('one_shot_host_canary: '.$reason);
}
$policy=n80_host_load_policy();
$legacy=['stop'=>true,'paused'=>true,'activeOperations'=>[]];
$wake=['version'=>1,'enabled'=>false,'paused'=>true,'stop'=>true,
       'hostingApproved'=>false,'boundedExecutorVerified'=>false];
$r=n80_one_shot_host_canary($policy,$legacy,$wake);
must($r['ok']===true&&$r['state']==='admission_blocked_as_designed','real_disabled_policy');
must(count($r['checks'])===4&&!in_array(false,$r['checks'],true),'all_admission_checks');
must($r['realSignedCanaryVerified']===false
    &&$r['boundedBusinessExecutorVerified']===false
    &&$r['hostingApprovalVerified']===false,'no_unverified_approval_claims');
must($r['businessOperationsExecuted']===0&&$r['hostWrites']===0
    &&$r['providerCalls']===0&&$r['processStarts']===0
    &&$r['mediaCreated']===false&&$r['youtubePublished']===false,'read_only');
must(is_float($r['elapsedMs'])&&$r['elapsedMs']>=0,'host_runtime_measured');
$badLegacy=$legacy;$badLegacy['paused']=false;
$r=n80_one_shot_host_canary($policy,$badLegacy,$wake);
must($r['ok']===false&&$r['state']==='needs_review','retired_runner_cannot_restart');
$changed=$policy;$changed['githubWakeActivated']=true;$changed['requiresHostingApproval']=false;
$r=n80_one_shot_host_canary($changed,$legacy,$wake);
must($r['ok']===false&&$r['state']==='needs_review'
    &&$r['businessOperationsExecuted']===0,'synthetic_canary_never_activates');
$r=n80_one_shot_host_canary([],$legacy,$wake);
must($r['ok']===false&&$r['businessOperationsExecuted']===0,'missing_policy_fails_closed');
$hub=file_get_contents(__DIR__.'/../../deploy/noa-app/engine/hub.php');
$system=file_get_contents(__DIR__.'/../../deploy/noa-app/engine/system-status.php');
must(is_string($hub)&&is_string($system),'source_check_available');
must(substr_count($hub,"require_once __DIR__.'/one-shot-host-canary.php';")===1,'host_canary_wired_once');
must(substr_count($hub,"'wakeHostCanary'=>$wakeHostCanary")===1,'hub_status_projection');
must(substr_count($system,"'wakeHostCanary'=>$hub['wakeHostCanary']")===1,'system_status_projection');
echo "N80_SYNTHETIC_HOST_CANARY_PASS: policy gate, stop latch, no execution, no approval\n";
