<?php
declare(strict_types=1);

function n80_song_dispatch(string $taskId, string $dispatchToken): int {
    if (!preg_match('/^[a-f0-9]{32}$/D', $taskId) || $dispatchToken === '') return 0;
    $request = curl_init('https://api.github.com/repos/rucyjeon79/noa-private-worker/actions/workflows/noa-worker.yml/dispatches');
    curl_setopt_array($request, [
        CURLOPT_POST=>true, CURLOPT_RETURNTRANSFER=>true, CURLOPT_TIMEOUT=>12,
        CURLOPT_HTTPHEADER=>['User-Agent: NOA-STUDIO','Accept: application/vnd.github+json',
            'Content-Type: application/json','Authorization: Bearer '.$dispatchToken],
        CURLOPT_POSTFIELDS=>json_encode(['ref'=>'main','inputs'=>['task_id'=>$taskId]],JSON_THROW_ON_ERROR)
    ]);
    curl_exec($request);
    $status = curl_getinfo($request,CURLINFO_RESPONSE_CODE);
    return $status;
}

function n80_song_stage(array $job, int $now): string {
    if (empty($job['hosted'])) return '대기 작업 없음';
    if (isset($job['saved'])) return '곡에 저장됨';
    if (!empty($job['failed'])) return '생성 실패';
    if ($now >= ($job['expires'] ?? 0)) return '요청 만료';
    return empty($job['claimed']) ? 'GitHub 실행 대기' : '생성 중';
}
