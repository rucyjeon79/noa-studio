<?php
declare(strict_types=1);
require_once __DIR__.'/router.php';
/**
 * NOA ENGINE: deterministic workflow plan, no side effects.
 * Never invokes a worker, alters FIFO or touches member/music data.
 */
function noa_engine_workflow_plan(array $event): array {
    $route=noa_engine_route_event($event);
    if (!$route['ok']) return ['ok'=>false,'error'=>$route['error'],'steps'=>[]];
    $steps=[];
    foreach ($route['consumers'] as $consumer) {
        $steps[]=[
            'id'=>$event['id'].':'.$consumer,
            'eventId'=>$event['id'],
            'consumer'=>$consumer,
            'correlationId'=>$event['correlationId'],
            'status'=>'planned',
            'attempts'=>0,
            'maxAttempts'=>3,
            'retryPolicy'=>'exponential_backoff',
            'execution'=>'disabled',
        ];
    }
    return ['ok'=>true,'mode'=>'plan_only','steps'=>$steps,'correlationId'=>$event['correlationId']];
}
function noa_engine_transition(array $step,string $next): array {
    $allowed=[
        'planned'=>['running','blocked'],
        'running'=>['succeeded','failed'],
        'failed'=>['running','blocked'],
        'succeeded'=>[],
        'blocked'=>[],
    ];
    $current=$step['status']??'';
    if (!isset($allowed[$current])||!in_array($next,$allowed[$current],true)) {
        return ['ok'=>false,'error'=>'invalid_transition','step'=>$step];
    }
    if ($next==='running') {
        $attempts=(int)($step['attempts']??0);
        $max=(int)($step['maxAttempts']??0);
        if ($max<1||$attempts >= $max) return ['ok'=>false,'error'=>'retry_limit','step'=>$step];
        $step['attempts']=$attempts+1;
    }
    $step['status']=$next;
    return ['ok'=>true,'error'=>null,'step'=>$step];
}
