<?php
declare(strict_types=1);
/**
 * N80 synchronous PHP host canary, read-only and fail-closed.
 * This verifies only that the real scheduled-wake admission contract can run
 * on a host HTTP request. It NEVER verifies hosting approval, HMAC canary,
 * a bounded BUSINESS executor, provider creation, or YouTube publication.
 *
 * No network, file writes, locks, secrets, job claims or process launches.
 * Synthetic timestamps are never passed to the live endpoint or Hub ticket store.
 */
require_once __DIR__.'/scheduled-wake.php';
function n80_one_shot_host_canary(array $hostPolicy,array $legacy,array $wakeControl):array {
    $start=hrtime(true);
    $report=[
        'ok'=>false,'mode'=>'synthetic_read_only_host_request',
        'state'=>'needs_review','checks'=>[
            'contractCodeExecuted'=>false,
            'invalidEnvelopeDenied'=>false,
            'activationGateEnforced'=>false,
            'legacyStopPreserved'=>false,
        ],
        'realSignedCanaryVerified'=>false,
        'hostingApprovalVerified'=>false,
        'boundedBusinessExecutorVerified'=>false,
        'mediaCreated'=>false,'youtubePublished'=>false,
        'hostWrites'=>0,'providerCalls'=>0,'processStarts'=>0,'businessOperationsExecuted'=>0,
    ];
    try {
        $zone=new DateTimeZone('Asia/Seoul');
        $stamp=(new DateTimeImmutable('2026-11-18 08:00:02',$zone))->getTimestamp();
        $schedule=[
            'version'=>2,'timezone'=>'Asia/Seoul','maxPerLocalDate'=>1,
            'mediaStorage'=>['provider'=>'google_drive'],
            'publishIsoWeekdays'=>[1,3,5],
            'prepareLocalTime'=>'08:00','publishLocalTime'=>'12:00',
        ];
        $body=[
            'action'=>'scheduled_wake','operation'=>'ai.daily_shorts_clock',
            'phase'=>'prepare','slot'=>'2026-11-18',
        ];
        $bad=$body;$bad['operation']='ai.batch';
        $invalid=n80_scheduled_wake_contract($bad,$schedule,$hostPolicy,$legacy,$stamp,$wakeControl);
        $gate=n80_scheduled_wake_contract($body,$schedule,$hostPolicy,$legacy,$stamp,$wakeControl);
        $report['checks']['contractCodeExecuted']=is_array($invalid)&&is_array($gate);
        $report['checks']['invalidEnvelopeDenied']=($invalid['ok']??true)===false
            &&($invalid['reason']??null)==='wake_request_invalid'
            &&($invalid['executionAllowed']??true)===false;
        $report['checks']['legacyStopPreserved']=($legacy['stop']??null)===true
            &&($legacy['paused']??null)===true;
        // The actual live policy MUST be used. Do not inject simulated approvals
        // into a live Hub status check.
        $report['checks']['activationGateEnforced']=($hostPolicy['githubWakeActivated']??null)===false
            &&($hostPolicy['requiresHostingApproval']??null)===true
            &&($gate['ok']??true)===false
            &&($gate['reason']??null)==='wake_activation_not_approved'
            &&($gate['executionAllowed']??true)===false;
        $report['ok']=!in_array(false,$report['checks'],true);
        $report['state']=$report['ok']?'admission_blocked_as_designed':'needs_review';
    }catch(Throwable $e){
        $report['ok']=false;
        $report['state']='host_canary_unavailable';
    }
    $report['elapsedMs']=round((hrtime(true)-$start)/1000000,3);
    return $report;
}
