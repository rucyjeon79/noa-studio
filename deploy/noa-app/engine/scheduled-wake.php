<?php
declare(strict_types=1);
/**
 * N80 scheduled one-shot wake admission contract, version 1.
 * This module NEVER executes a job, launches a process, sends a network
 * request, or changes the existing paused/stop control. GitHub is only a clock.
 */
function n80_scheduled_wake_contract(array $body, array $schedule, array $hostPolicy, array $control, int $now, array $wakeControl=[]): array {
    $reject=static fn(string $code): array => ['ok'=>false, 'reason'=>$code, 'executionAllowed'=>false];
    $required=['action','operation','phase','slot'];
    if (count($body)!==4 || array_diff(array_keys($body),$required) || array_diff($required,array_keys($body))
        || ($body['action']??null)!=='scheduled_wake'
        || ($body['operation']??null)!=='ai.daily_shorts_clock'
        || !in_array($body['phase']??null,['prepare','publish'],true)
        || !is_string($body['slot']??null)
        || !preg_match('/^\d{4}-\d{2}-\d{2}$/D',$body['slot'])) return $reject('wake_request_invalid');
    if (($schedule['version']??null)!==2 || ($schedule['timezone']??null)!=='Asia/Seoul'
        || ($schedule['mediaStorage']['provider']??null)!=='google_drive'
        || ($schedule['maxPerLocalDate']??null)!==1
        || !is_array($schedule['publishIsoWeekdays']??null)
        || !array_is_list($schedule['publishIsoWeekdays'])
        || count($schedule['publishIsoWeekdays'])<1
        || count($schedule['publishIsoWeekdays'])>7
        || count(array_unique($schedule['publishIsoWeekdays']))!==count($schedule['publishIsoWeekdays'])
        || !is_string($schedule['prepareLocalTime']??null)
        || !is_string($schedule['publishLocalTime']??null)) return $reject('wake_schedule_invalid');
    foreach ($schedule['publishIsoWeekdays'] as $weekday)
        if (!is_int($weekday)||$weekday<1||$weekday>7) return $reject('wake_schedule_invalid');
    $clock=$body['phase']==='prepare'?$schedule['prepareLocalTime']:$schedule['publishLocalTime'];
    if (!preg_match('/^([01]\d|2[0-3]):[0-5]\d$/D',$clock)) return $reject('wake_schedule_invalid');
    $zone=new DateTimeZone('Asia/Seoul');
    $when=DateTimeImmutable::createFromFormat('!Y-m-d H:i',$body['slot'].' '.$clock,$zone);
    if (!$when || $when->format('Y-m-d H:i')!==$body['slot'].' '.$clock
        || !in_array((int)$when->format('N'),$schedule['publishIsoWeekdays'],true)) return $reject('wake_slot_invalid');
    // Never accept an early wake or a long-delayed cron run. No retries here.
    $lag=$now-$when->getTimestamp();
    if ($lag<0 || $lag>1200) return $reject('wake_outside_time_window');
    if (($hostPolicy['githubActionsRole']??null)!=='scheduled_wake_signal_only'
        || ($hostPolicy['githubWorkerDispatchAllowed']??true)!==false
        || ($hostPolicy['githubBusinessExecutionAllowed']??true)!==false
        || ($hostPolicy['hostResidentRunnerAllowed']??true)!==false
        || ($hostPolicy['hostLegacyHeartbeatAllowed']??true)!==false
        || ($hostPolicy['hostLegacyBatchExecuteAllowed']??true)!==false) return $reject('wake_policy_not_verified');
    if (($hostPolicy['githubWakeActivated']??false)!==true
        || ($hostPolicy['requiresHostingApproval']??true)!==false
        || ($hostPolicy['n80BoundedExecutorVerified']??false)!==true)
        return $reject('wake_activation_not_approved');
    // A scheduled one-shot wake has its own control plane. The retired resident
    // runner MUST stay paused and stopped, including during signal admission.
    if (($control['paused']??null)!==true || ($control['stop']??null)!==true
        || !in_array('ai.daily_shorts_clock',$control['activeOperations']??[],true))
        return $reject('wake_legacy_runner_not_suspended');
    // Separate N80 one-shot emergency stop and owner/hosting approval.
    // Missing private control is DENIED; the public endpoint cannot set it.
    if (($wakeControl['version']??null)!==1
        || ($wakeControl['enabled']??false)!==true
        || ($wakeControl['paused']??true)!==false
        || ($wakeControl['stop']??true)!==false
        || ($wakeControl['hostingApproved']??false)!==true
        || ($wakeControl['boundedExecutorVerified']??false)!==true)
        return $reject('wake_one_shot_suspended');
    return ['ok'=>true,'reason'=>'admitted_signal_only','executionAllowed'=>false,
        'operation'=>'ai.daily_shorts_clock','phase'=>$body['phase'],
        'slot'=>$body['slot'],'slotId'=>$body['slot'].'|'.$body['phase'],
        'scheduleAt'=>$when->getTimestamp()];
}

/** Read-only safe status. Installed source is NOT proof of receiver activation. */
function n80_scheduled_wake_snapshot(array $hostPolicy, array $control, array $wakeControl=[]): array {
    return [
        'ok'=>true,'mode'=>'read_only','sourceInstalled'=>true,
        'endpoint'=>'/noa-bridge/n80-scheduled-wake.php',
        'activated'=>($hostPolicy['githubWakeActivated']??false)===true
            && ($hostPolicy['requiresHostingApproval']??true)===false
            && ($hostPolicy['n80BoundedExecutorVerified']??false)===true
            && ($wakeControl['enabled']??false)===true
            && ($wakeControl['stop']??true)===false
            && ($wakeControl['paused']??true)===false
            && ($wakeControl['hostingApproved']??false)===true
            && ($wakeControl['boundedExecutorVerified']??false)===true
            && ($control['paused']??null)===true && ($control['stop']??null)===true,
        'hostingApprovalRequired'=>($hostPolicy['requiresHostingApproval']??true)===true,
        'boundedExecutorVerified'=>($hostPolicy['n80BoundedExecutorVerified']??false)===true,
        'legacyRunnerPaused'=>($control['paused']??null)===true,
        'oneShotEnabled'=>($wakeControl['enabled']??false)===true,
        'oneShotPaused'=>($wakeControl['paused']??true)!==false,
        'oneShotStopped'=>($wakeControl['stop']??true)!==false,
        'signedRequestCanaryVerified'=>false,'githubScheduleEnabledVerified'=>false,
        'tasksExecuted'=>0,'uploads'=>0,'providerCalls'=>0,
        'activationNotPerformed'=>true,
        'nextAction'=>'hosting_approval_and_signed_one_shot_canary_required'
    ];
}

/**
 * Write only a single wake ticket in the private N80 Hub store after ALL gates.
 * The actual business executor is not part of this API.
 * Called only after HMAC verification, with a caller-owned Hub lock.
 */
function n80_scheduled_wake_admit(string $root, array $admission, string $nonce, int $now): array {
    if (($admission['ok']??false)!==true || !preg_match('/^[a-f0-9]{32}$/D',$nonce))
        throw new DomainException('wake_invalid_admission');
    return n80_hub_locked($root, static function() use ($root,$admission,$nonce,$now): array {
        // Re-read under the same lock: an administrator pause must win races.
        $liveControl=n80_hub_read($root,'control.json');
        $liveWake=n80_hub_read($root,'scheduled-wake-control.json');
        $livePolicy=n80_host_load_policy();
        if (($liveControl['stop']??null)!==true || ($liveControl['paused']??null)!==true
            || !in_array('ai.daily_shorts_clock',$liveControl['activeOperations']??[],true)
            || ($liveWake['version']??null)!==1
            || ($liveWake['enabled']??false)!==true
            || ($liveWake['paused']??true)!==false
            || ($liveWake['stop']??true)!==false
            || ($liveWake['hostingApproved']??false)!==true
            || ($liveWake['boundedExecutorVerified']??false)!==true
            || ($livePolicy['githubActionsRole']??null)!=='scheduled_wake_signal_only'
            || ($livePolicy['githubWorkerDispatchAllowed']??true)!==false
            || ($livePolicy['githubBusinessExecutionAllowed']??true)!==false
            || ($livePolicy['hostResidentRunnerAllowed']??true)!==false
            || ($livePolicy['githubWakeActivated']??false)!==true
            || ($livePolicy['requiresHostingApproval']??true)!==false
            || ($livePolicy['n80BoundedExecutorVerified']??false)!==true)
            throw new DomainException('wake_revoked_before_commit');
        $state=n80_hub_read($root,'scheduled-wakes.json',['version'=>1,'slots'=>[]]);
        if (($state['version']??null)!==1 || !is_array($state['slots']??null))
            throw new DomainException('wake_store_invalid');
        $slot=$admission['slotId'];
        $nonces=n80_hub_read($root,'scheduled-wake-nonces.json');
        if (isset($nonces[$nonce])) throw new DomainException('wake_replay');
        if (isset($state['slots'][$slot]))
            return ['ok'=>true,'state'=>'duplicate_signal','executionAllowed'=>false,'slot'=>$slot];
        // Nonces are recorded only for accepted, new time slots.
        $nonces=array_filter($nonces,static fn($t)=>is_int($t)&&$t>$now-360);
        if (count($nonces)>256) throw new DomainException('wake_nonce_limit');
        $nonces[$nonce]=$now;
        $state['slots'][$slot]=[
            'operation'=>'ai.daily_shorts_clock','phase'=>$admission['phase'],
            'scheduledAt'=>$admission['scheduleAt'],'receivedAt'=>$now,
            'state'=>'signal_admitted_not_executed','executionVerified'=>false,
            'mediaCreated'=>false,'youtubePublished'=>false
        ];
        if (count($state['slots'])>32)
            $state['slots']=array_slice($state['slots'],-32,null,true);
        n80_hub_write($root,'scheduled-wakes.json',$state);
        n80_hub_write($root,'scheduled-wake-nonces.json',$nonces);
        return ['ok'=>true,'state'=>'signal_admitted_not_executed',
            'executionAllowed'=>false,'slot'=>$slot];
    });
}
