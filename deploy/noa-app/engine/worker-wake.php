<?php
declare(strict_types=1);
if(!defined('_GNUBOARD_')){http_response_code(403);exit;}
/**
 * Legacy host-to-GitHub AI worker wake is retired by the owner policy.
 * GitHub Actions may only send an authenticated scheduled wake INTO N80.
 * This compatibility handler must neither contact GitHub nor claim a task.
 * Returning a non-success status preserves the original N80 job for review.
 */
function n80_ai_wake():string {
 return 'github_worker_retired';
}
