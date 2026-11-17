<?php
declare(strict_types=1);
/** One authenticated wake -> one existing N80 clock call. No production runner. */
require_once __DIR__.'/scheduled-wake.php';

function n80_one_shot_clock_gate(string $root,array $body,int $now):array {
    $path=__DIR__.'/daily-shorts.json';
    if(is_link($path)||!is_file($path)||filesize($path)>32768)
        throw new DomainException('wake_schedule_unavailable');
    $schedule=json_decode((string)file_get_contents($path),true,32,JSON_THROW_ON_ERROR);
    return n80_scheduled_wake_contract($body,$schedule,n80_host_load_policy(),
        n80_hub_read($root,'control.json'),$now,n80_hub_read($root,'scheduled-wake-control.json'));
}

/** Commit the attempt before bootstrapping or calling the fixed specialist. */
function n80_one_shot_clock_claim(string $root,array $body,int $now):array {
    return n80_hub_locked($root,static function()use($root,$body,$now):array {
        $gate=n80_one_shot_clock_gate($root,$body,$now);
        if(!$gate['ok'])return ['claimed'=>false,'state'=>$gate['reason']];
        if($gate['phase']!=='prepare')
            return ['claimed'=>false,'state'=>'publish_handler_not_verified'];
        $store=n80_hub_read($root,'scheduled-wakes.json');
        if(($store['version']??null)!==1||!is_array($store['slots']??null)||count($store['slots'])>32)
            throw new DomainException('wake_store_invalid');
        $slot=$gate['slotId'];$ticket=$store['slots'][$slot]??null;
        if(!is_array($ticket)||($ticket['operation']??null)!==$gate['operation']
            ||($ticket['phase']??null)!==$gate['phase']
            ||($ticket['scheduledAt']??null)!==$gate['scheduleAt']
            ||!is_int($ticket['receivedAt']??null)||$ticket['receivedAt']<$gate['scheduleAt']
            ||$ticket['receivedAt']>$now
            ||($ticket['state']??null)!=='signal_admitted_not_executed'
            ||($ticket['executionVerified']??null)!==false
            ||($ticket['mediaCreated']??null)!==false||($ticket['youtubePublished']??null)!==false)
            throw new DomainException('wake_ticket_mismatch');
        if(array_key_exists('clockDispatch',$ticket))
            return ['claimed'=>false,'state'=>'clock_already_attempted'];
        // A missing final receipt may mean the call ran. Never reclaim a timeout.
        foreach($store['slots'] as $row){
            if(!is_array($row))throw new DomainException('wake_store_invalid');
            if(array_key_exists('clockDispatch',$row)
                &&(!is_array($row['clockDispatch'])||!in_array($row['clockDispatch']['state']??null,
                    ['clock_checked_not_produced','cancelled_before_clock'],true)))
                return ['claimed'=>false,'state'=>'clock_previous_outcome_unconfirmed'];
        }
        $claim=['id'=>bin2hex(random_bytes(16)),'state'=>'started_unconfirmed',
            'scope'=>'schedule_and_readiness_only','startedAt'=>$now,'attempts'=>1];
        $store['slots'][$slot]['clockDispatch']=$claim;
        n80_hub_write($root,'scheduled-wakes.json',$store);
        return ['claimed'=>true,'slot'=>$slot,'id'=>$claim['id'],'state'=>$claim['state']];
    });
}

/** Check stop/approval/time again after application bootstrap, immediately before the call. */
function n80_one_shot_clock_recheck(string $root,array $body,array $claim,int $now):bool {
    return n80_hub_locked($root,static function()use($root,$body,$claim,$now):bool {
        $gate=n80_one_shot_clock_gate($root,$body,$now);
        $store=n80_hub_read($root,'scheduled-wakes.json');
        $current=$store['slots'][$claim['slot']??'']['clockDispatch']??[];
        return $gate['ok']&&$gate['phase']==='prepare'&&$gate['slotId']===($claim['slot']??null)
            &&($current['id']??null)===($claim['id']??null)
            &&($current['state']??null)==='started_unconfirmed';
    });
}

/** Only a zero-production clock response is accepted. Exceptions stay uncertain. */
function n80_one_shot_clock_finish(string $root,array $claim,?array $result,int $now,bool $cancelled=false):array {
    $outcome=['state'=>'clock_outcome_unconfirmed','scope'=>'schedule_and_readiness_only',
        'businessExecutionVerified'=>false,'mediaCreated'=>false,'youtubePublished'=>false,
        'automaticRetryAllowed'=>false];
    if($cancelled)$outcome['state']='cancelled_before_clock';
    elseif(($result['ok']??null)===true&&($result['module']??null)==='lab'
        &&in_array($result['state']??null,['paused','connection_required','waiting_schedule','ready'],true)
        &&($result['processed']??null)===0&&($result['uploads']??null)===0){
        $outcome['state']='clock_checked_not_produced';
        $outcome['clockState']=$result['state'];
    }
    return n80_hub_locked($root,static function()use($root,$claim,$outcome,$now):array {
        $store=n80_hub_read($root,'scheduled-wakes.json');
        $slot=$claim['slot']??'';$current=$store['slots'][$slot]['clockDispatch']??[];
        if(($store['version']??null)!==1||!is_string($claim['id']??null)
            ||!preg_match('/^[a-f0-9]{32}$/D',$claim['id'])
            ||($current['id']??null)!==$claim['id']||($current['state']??null)!=='started_unconfirmed')
            throw new DomainException('wake_clock_receipt_conflict');
        $store['slots'][$slot]['clockDispatch']=array_replace($current,$outcome,['finishedAt'=>$now]);
        n80_hub_write($root,'scheduled-wakes.json',$store);
        return $outcome;
    });
}
