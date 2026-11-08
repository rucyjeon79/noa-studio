<?php
declare(strict_types=1);
require_once __DIR__.'/generation-state.php';
require_once __DIR__.'/auto-dispatch.php';
require_once __DIR__.'/agent-runtime.php';

// Legacy entry point shared with the VIP weather service.
function n80_song_dispatch(string $taskId, string $dispatchToken, string $workflow='noa-worker.yml'): int {
    return match ($workflow) {
        'noa-worker.yml' => n80_auto_dispatch($taskId,$dispatchToken,'song_generation'),
        'noa-vip-weather.yml' => n80_auto_dispatch($taskId,$dispatchToken,'vip_weather'),
        default => 0,
    };
}

function n80_song_stage(array $job, int $now): string {
    if (empty($job['hosted'])) return '대기 작업 없음';
    return match(n80_engine_generation_state($job, $now)) {
        'saved'=>'곡에 저장됨', 'failed'=>(($job['failureReason']??'')==='dispatch_failed'?'N80 Auto 요청 전달 실패':'N80 AI 생성 실패'), 'expired', 'timed_out'=>'요청 만료',
        'queued'=>'N80 Auto 실행 대기', 'running'=>'N80 AI 생성 중', default=>'대기 작업 없음'
    };
}
