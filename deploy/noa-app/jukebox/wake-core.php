<?php
declare(strict_types=1);
if (!defined('_GNUBOARD_')) { http_response_code(403); exit; }

/**
 * Retired GitHub worker compatibility shim (2026-11-17).
 * The durable SQL upload queue remains intact. A site upload MUST NOT start
 * any GitHub Actions processing or shared-host resident process.
 * Only a separately verified user-triggered N80 bounded executor may claim
 * queued media. A queued item is never reported as completed by this shim.
 */
function nw_dispatch(string $token,string $workflow='noa-jukebox.yml'): int {
    return 0;
}
function nw_request(string $directory, ?callable $send = null, ?int $now = null,
                    string $workflow='noa-jukebox.yml'): string {
    if (!in_array($workflow,['noa-jukebox.yml','noa-ai-worker.yml'],true))
        return 'invalid_workflow';
    return 'github_worker_retired';
}
function nw_after_enqueue(): void {
    // Durable N80 queue is preserved; no unattended GitHub or host execution.
}
