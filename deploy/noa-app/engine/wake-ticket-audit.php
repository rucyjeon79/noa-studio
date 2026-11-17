<?php
declare(strict_types=1);
/**
 * Read-only audit of signed N80 wake tickets.
 * A received clock signal NEVER constitutes proof of business execution.
 * No file writes, network, provider, worker, retry or credential access.
 */
function n80_wake_ticket_audit(string $root,?int $now=null):array {
    $now??=time();
    $result=[
        'ok'=>true,'mode'=>'read_only','source'=>'scheduled-wakes.json',
        'state'=>'no_signed_signal_recorded','signalCount'=>0,
        'unresolvedCount'=>0,'staleCount'=>0,
        'retentionLimit'=>32,'remainingCapacity'=>32,'newSignalsBlocked'=>false,
        'nextAction'=>'wait_for_approved_signal',
        'businessExecutionVerified'=>false,'canAutomaticallyRetry'=>false,
        'latest'=>null,'recent'=>[],
        'hostWrites'=>0,'processStarts'=>0,'providerCalls'=>0,
    ];
    try {
        $store=n80_hub_read($root,'scheduled-wakes.json',['version'=>1,'slots'=>[]]);
        if (($store['version']??null)!==1 || !is_array($store['slots']??null)
            || count($store['slots'])>32)throw new RuntimeException('ticket_store_invalid');
        $rows=[];
        foreach($store['slots'] as $slotId=>$ticket) {
            if (!is_string($slotId)
                || !preg_match('/^\\d{4}-\\d{2}-\\d{2}\\|(prepare|publish)$/D',$slotId)
                || !is_array($ticket)
                || ($ticket['operation']??null)!=='ai.daily_shorts_clock'
                || !in_array($ticket['phase']??null,['prepare','publish'],true)
                || $slotId!==substr($slotId,0,10).'|'.$ticket['phase']
                || !is_int($ticket['scheduledAt']??null)
                || !is_int($ticket['receivedAt']??null)
                || $ticket['scheduledAt']<=0
                || $ticket['receivedAt']<$ticket['scheduledAt']
                || $ticket['receivedAt']>$now+180
                || !is_string($ticket['state']??null)) {
                throw new RuntimeException('ticket_record_invalid');
            }
            // Never trust a state flag as independent proof of a rendered video,
            // YouTube upload, or business-side source of truth.
            $age=max(0,$now-$ticket['receivedAt']);
            $pending=($ticket['state']==='signal_admitted_not_executed'
                && ($ticket['executionVerified']??false)===false);
            $rows[]=[
                'slot'=>$slotId,'receivedAt'=>$ticket['receivedAt'],
                'state'=>$pending?'signal_received_not_executed':'needs_independent_proof',
                'ageSeconds'=>$age,
                'needsReview'=>!$pending||$age>1200,
                'safeToReplay'=>false,
            ];
        }
        usort($rows,static fn(array $a,array $b):int=>
            $a['receivedAt']===$b['receivedAt']
                ?strcmp($a['slot'],$b['slot'])
                :($a['receivedAt']<=>$b['receivedAt']));
        $result['signalCount']=count($rows);
        $result['unresolvedCount']=count($rows);
        $result['remainingCapacity']=32-count($rows);
        $result['newSignalsBlocked']=count($rows)>=32;
        $result['nextAction']=$result['newSignalsBlocked']
            ?'reconcile_preserved_signals_before_new_admission'
            :($rows?'verify_business_effects_before_retry':'wait_for_approved_signal');
        $result['staleCount']=count(array_filter($rows,
            static fn(array $r):bool=>$r['needsReview']));
        $result['state']=$rows?'signal_only_not_execution':'no_signed_signal_recorded';
        $result['latest']=$rows?end($rows):null;
        $result['recent']=array_slice($rows,-5);
    }catch(Throwable $e) {
        // Do not leak filesystem details or sensitive raw ticket contents.
        $result['ok']=false;
        $result['state']='needs_review';
        $result['remainingCapacity']=null;
        $result['newSignalsBlocked']=true;
        $result['nextAction']='review_ticket_store_without_replay';
    }
    return $result;
}
