<?php
declare(strict_types=1);
/**
 * Read-only, bounded scheduled-wake readiness inventory.
 * Never changes approvals, secrets, scheduler flags, work state or receipts.
 */
function n80_wake_preflight(string $root,string $web,array $policy,array $legacy,array $oneShot,array $retirement):array {
    $secret=$root.'/scheduled-wake.key';
    $secretIsFile=!is_link($root)&&!is_link($secret)&&is_file($secret);
    $secretMetadataSecure=$secretIsFile
        && (fileperms($secret)&0077)===0
        && filesize($secret)>=64 && filesize($secret)<=129;
    // Inspect only key metadata; not the HMAC key bytes or signature.
    $source=$web.'/noa-app/engine/daily-shorts.json';
    $schedule=null;
    if (!is_link($source)&&is_file($source) && filesize($source)>0 && filesize($source)<=32768) {
        $body=file_get_contents($source);
        $schedule=is_string($body)?json_decode($body,true,16):null;
    }
    $scheduleMatchesSender=is_array($schedule)
        && ($schedule['version']??null)===2
        && ($schedule['timezone']??null)==='Asia/Seoul'
        && ($schedule['prepareLocalTime']??null)==='08:00'
        && ($schedule['publishLocalTime']??null)==='12:00'
        && ($schedule['publishIsoWeekdays']??null)===[1,3,5]
        && ($schedule['mediaStorage']['provider']??null)==='google_drive'
        && ($schedule['maxPerLocalDate']??null)===1;
    $checks=[
        'residentRunnerRemoved'=>($retirement['verified']??false)===true,
        'legacyStopLatched'=>($legacy['stop']??null)===true&&($legacy['paused']??null)===true,
        'githubSignalOnly'=>($policy['githubActionsRole']??null)==='scheduled_wake_signal_only'
            && ($policy['githubWorkerDispatchAllowed']??true)===false
            && ($policy['githubBusinessExecutionAllowed']??true)===false,
        'dedicatedKeyMetadataSecure'=>$secretMetadataSecure,
        'clockConfigMatchesSender'=>$scheduleMatchesSender,
        'hostingApproval'=>($policy['requiresHostingApproval']??true)===false
            && ($oneShot['hostingApproved']??false)===true,
        'boundedExecutor'=>($policy['n80BoundedExecutorVerified']??false)===true
            && ($oneShot['boundedExecutorVerified']??false)===true,
        'oneShotOwnerEnabled'=>($oneShot['version']??null)===1
            && ($oneShot['enabled']??false)===true
            && ($oneShot['paused']??true)===false
            && ($oneShot['stop']??true)===false,
        'hostWakePolicyActivated'=>($policy['githubWakeActivated']??false)===true,
    ];
    $blocked=array_keys(array_filter($checks,static fn(bool $ready):bool=>!$ready));
    // A read-only inventory cannot verify an authenticated production canary,
    // GitHub cron activation, provider processing, or actual YouTube publication.
    return [
        'ok'=>true,'mode'=>'read_only','scope'=>'key_metadata_and_static_gate_evidence',
        'checks'=>$checks,'blockers'=>$blocked,
        'eligibleForSignedCanary'=>count($blocked)===0,
        'signedCanaryVerified'=>false,'githubCronVerified'=>false,
        'executionVerified'=>false,'productionReady'=>false,
        'hostWrites'=>0,'processLaunches'=>0,'providerCalls'=>0,
        'nextAction'=>$blocked?'verify_blocked_preflight_gates':'perform_separate_signed_request_canary',
    ];
}
