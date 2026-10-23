<?php
declare(strict_types=1);
/** NOA ENGINE leased consumer state machine; pure functions only. */
function noa_engine_lease_new(string $eventId,string $consumer): array {
    return ['eventId'=>$eventId,'consumer'=>$consumer,'status'=>'pending','attempts'=>0,'leaseUntil'=>null,'lastError'=>null];
}
function noa_engine_lease_apply(array $state,string $action,int $now,int $ttl=60,int $maxAttempts=3): array {
    if($ttl<1||$maxAttempts<1)return ['ok'=>false,'error'=>'invalid_policy','state'=>$state];
    $status=$state['status']??'';
    if($action==='claim'){
        if($status==='succeeded'||$status==='dead_letter')return ['ok'=>false,'error'=>'terminal','state'=>$state];
        if($status==='running'&&($state['leaseUntil']??0)>$now)return ['ok'=>false,'error'=>'lease_active','state'=>$state];
        if(($state['attempts']??0)>=$maxAttempts){
            $state['status']='dead_letter';$state['leaseUntil']=null;
            return ['ok'=>false,'error'=>'retry_exhausted','state'=>$state];
        }
        $state['attempts']++;$state['status']='running';$state['leaseUntil']=$now+$ttl;
        return ['ok'=>true,'error'=>null,'state'=>$state];
    }
    if($action==='ack'&&$status==='running'&&($state['leaseUntil']??0)>=$now){
        $state['status']='succeeded';$state['leaseUntil']=null;return ['ok'=>true,'error'=>null,'state'=>$state];
    }
    if($action==='fail'&&$status==='running'){
        $state['status']=$state['attempts']>=$maxAttempts?'dead_letter':'pending';
        $state['leaseUntil']=null;return ['ok'=>true,'error'=>null,'state'=>$state];
    }
    return ['ok'=>false,'error'=>'invalid_transition','state'=>$state];
}
