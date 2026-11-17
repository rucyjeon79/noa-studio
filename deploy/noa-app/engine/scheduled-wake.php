<?php
declare(strict_types=1);
/** Owner retired scheduled wake on 2026-11-17. Old flags cannot reactivate it. */
function n80_scheduled_wake_contract(array $body,array $schedule,array $hostPolicy,array $control,int $now,array $wakeControl=[]):array {
 return ['ok'=>false,'reason'=>'scheduled_wake_retired','executionAllowed'=>false];
}
function n80_scheduled_wake_snapshot(array $hostPolicy,array $control,array $wakeControl=[]):array {
 return ['ok'=>true,'mode'=>'read_only','state'=>'retired','sourceInstalled'=>true,'endpoint'=>'/noa-bridge/n80-scheduled-wake.php','activated'=>false,'executionAllowed'=>false,'oneShotEnabled'=>false,'oneShotPaused'=>true,'oneShotStopped'=>true,'githubScheduleEnabledVerified'=>false,'tasksExecuted'=>0,'uploads'=>0,'providerCalls'=>0,'nextAction'=>'manual_chatgpt_production'];
}
function n80_scheduled_wake_admit(string $root,array $admission,string $nonce,int $now):array {
 throw new DomainException('scheduled_wake_retired');
}
