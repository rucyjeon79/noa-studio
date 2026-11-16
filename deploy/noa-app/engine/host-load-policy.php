<?php
declare(strict_types=1);
/**
 * N80 host policy 2026-11-16: GitHub Actions may send only a signed scheduled
 * wake signal. GitHub may NEVER execute AI, media, database or queue tasks.
 * Activation still requires a verified N80 wake intake and hosting approval.
 */
function n80_host_load_policy(): array {
    return [
        'mode' => 'scheduled_n80_wake_only_pending_activation',
        'hostResidentRunnerAllowed' => false,
        'hostLegacyHeartbeatAllowed' => false,
        'hostLegacyBatchExecuteAllowed' => false,
        'githubActionsRole' => 'scheduled_wake_signal_only',
        'githubWorkerDispatchAllowed' => false,
        'githubBusinessExecutionAllowed' => false,
        'githubWakeAllowedByPolicy' => true,
        'githubWakeActivated' => false,
        'externalWorkerActivated' => false,
        'proposedExternalMaxConcurrency' => 0,
        'proposedExternalMaxItemsPerBatch' => 0,
        'requiresHostingApproval' => true,
    ];
}
/** Keep old resident execution stopped irrespective of the old stop flags. */
function n80_host_legacy_background_guard(array $control): void {
    if (($control['stop'] ?? true) !== false || ($control['paused'] ?? true) !== false) {
        throw new DomainException('hub_scheduler_suspended');
    }
    // Compatibility failure code; never a permission to launch an external worker.
    throw new DomainException('hub_external_worker_required');
}
