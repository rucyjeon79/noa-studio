<?php
declare(strict_types=1);

// Interpret older jobs with only an expiry using their original worker time budget.
function n80_engine_generation_state(array $job, int $now): string {
    if (!$job) return 'idle';
    if (isset($job['saved'])) return 'saved';
    if (!empty($job['failed'])) return 'failed';
    $expires = (int)($job['expires'] ?? 0);
    if ($now >= $expires) return 'expired';
    if (!empty($job['worker'])) {
        $deadline = $expires - 3600 + (!empty($job['hosted']) ? 1200 : 360);
        if ($now > $deadline) return 'timed_out';
    }
    return empty($job['claimed']) ? 'queued' : 'running';
}

function n80_engine_write_state(string $dir, string $file, array $state): void {
    $bytes = json_encode($state, JSON_THROW_ON_ERROR);
    $tmp = tempnam($dir, 'gpt-');
    try {
        if (!$tmp || file_put_contents($tmp, $bytes) !== strlen($bytes) || !rename($tmp, $file)) throw new RuntimeException('state_write');
    } finally {
        if ($tmp && is_file($tmp)) unlink($tmp);
    }
}
