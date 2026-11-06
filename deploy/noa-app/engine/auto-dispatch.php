<?php
declare(strict_types=1);

function n80_auto_dispatch(string $taskId, string $dispatchToken, string $operation): int {
    $workflow = match ($operation) {
        'song_generation' => 'noa-worker.yml',
        'vip_weather' => 'noa-vip-weather.yml',
        default => null,
    };
    if (!preg_match('/^[a-f0-9]{32}$/D', $taskId) || $dispatchToken === '' || $workflow === null) return 0;
    $request = curl_init('https://api.github.com/repos/rucyjeon79/noa-private-worker/actions/workflows/'.$workflow.'/dispatches');
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
