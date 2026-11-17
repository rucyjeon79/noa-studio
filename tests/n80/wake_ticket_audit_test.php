<?php
declare(strict_types=1);
/** Synthetic N80 signed-ticket history. No host, DB, provider or network. */
$fixture=[];
$reads=0;$writes=0;
function n80_hub_read(string $root,string $name,array $default=[]):array {
 global $fixture,$reads;
 $reads++;
 return $fixture[$name]??$default;
}
function must(bool $ok,string $reason):void {
 if(!$ok)throw new RuntimeException('WAKE_TICKET_AUDIT: '.$reason);
}
require __DIR__.'/../../deploy/noa-app/engine/wake-ticket-audit.php';
$now=1000000;
$s=n80_wake_ticket_audit('/fixture',$now);
must($s['ok']&&$s['signalCount']===0&&$s['state']==='no_signed_signal_recorded','empty');
must($s['businessExecutionVerified']===false&&$s['canAutomaticallyRetry']===false,'no_execution');
must($s['retentionLimit']===32&&$s['remainingCapacity']===32&&!$s['newSignalsBlocked'],'empty_capacity');
$fixture['scheduled-wakes.json']=['version'=>1,'slots'=>[
 '2026-11-18|prepare'=>[
  'operation'=>'ai.daily_shorts_clock','phase'=>'prepare',
  'scheduledAt'=>$now-80,'receivedAt'=>$now-70,
  'state'=>'signal_admitted_not_executed',
  'executionVerified'=>false,'mediaCreated'=>false,'youtubePublished'=>false
 ]
]];
$initial=json_encode($fixture,JSON_THROW_ON_ERROR);
$s=n80_wake_ticket_audit('/fixture',$now);
must($s['ok']&&$s['signalCount']===1&&$s['unresolvedCount']===1,'one_pending');
must($s['remainingCapacity']===31&&!$s['newSignalsBlocked'],'pending_capacity');
must($s['staleCount']===0&&$s['latest']['slot']==='2026-11-18|prepare'
 && !$s['latest']['safeToReplay'],'no_duplicate_replay');
must($s['latest']['state']==='signal_received_not_executed','not_production');
must(json_encode($fixture,JSON_THROW_ON_ERROR)===$initial,'read_only');
$s=n80_wake_ticket_audit('/fixture',$now+1400);
must($s['staleCount']===1&&$s['latest']['needsReview'],'stale_review_no_retry');
$fixture['scheduled-wakes.json']['slots']['2026-11-18|prepare']['executionVerified']=true;
$s=n80_wake_ticket_audit('/fixture',$now);
must($s['signalCount']===1&&!$s['businessExecutionVerified']
 && $s['latest']['state']==='needs_independent_proof','flag_not_proof');
$fixture['scheduled-wakes.json']['slots']['2026-11-18|prepare']['operation']='ai.batch';
$s=n80_wake_ticket_audit('/fixture',$now);
must(!$s['ok']&&$s['state']==='needs_review'
 && $s['signalCount']===0,'forged_operation_fail_closed');
$fixture['scheduled-wakes.json']=['version'=>2,'slots'=>[]];
must(!n80_wake_ticket_audit('/fixture',$now)['ok'],'invalid_version');
$fullSlots=[];
for($i=0;$i<32;$i++) {
 $phase=$i%2===0?'prepare':'publish';
 $fullSlots[sprintf('2026-11-%02d|%s',intdiv($i,2)+1,$phase)]=[
  'operation'=>'ai.daily_shorts_clock','phase'=>$phase,
  'scheduledAt'=>1,'receivedAt'=>2,'state'=>'signal_admitted_not_executed'
 ];
}
$fixture['scheduled-wakes.json']=['version'=>1,'slots'=>$fullSlots];
$before=$fixture;
$s=n80_wake_ticket_audit('/fixture',$now);
must($s['ok']&&$s['remainingCapacity']===0&&$s['newSignalsBlocked']
 &&$s['unresolvedCount']===32
 &&$s['nextAction']==='reconcile_preserved_signals_before_new_admission','full_capacity_review');
must($fixture===$before&&!$s['businessExecutionVerified']&&!$s['canAutomaticallyRetry'],
 'capacity_check_preserves_history');
$fixture['scheduled-wakes.json']=['version'=>1,'slots'=>array_fill_keys(
 array_map(static fn(int $i):string=>sprintf('2026-11-%02d|prepare',$i+1),range(0,32)),
 ['operation'=>'ai.daily_shorts_clock','phase'=>'prepare',
  'scheduledAt'=>1,'receivedAt'=>2,'state'=>'signal_admitted_not_executed'])
];
$s=n80_wake_ticket_audit('/fixture',$now);
must(!$s['ok']&&$s['newSignalsBlocked']&&$s['remainingCapacity']===null,'too_many_signals');
echo "N80_WAKE_TICKET_AUDIT_PASS no execution, no replay, stale detection, fail closed\n";
