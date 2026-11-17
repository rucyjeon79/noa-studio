<?php
declare(strict_types=1);
/** Retired feature status, not an unmet activation checklist. */
function n80_shorts_execution_audit(array $policy,array $hub,array $connections,array $handoffs,int $now):array {
 return ['ok'=>true,'mode'=>'read_only','state'=>'retired','productionReady'=>false,'executionAllowed'=>false,'reason'=>'automatic_shorts_retired','schedule'=>null,'blockers'=>[],'hostWrites'=>0,'providerCalls'=>0,'githubWorkerCalls'=>0,'checkedAt'=>$now,'nextAction'=>'manual_chatgpt_production'];
}
