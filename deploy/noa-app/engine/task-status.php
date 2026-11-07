<?php
declare(strict_types=1);
/** Read-only projection. Native task stores remain authoritative; no second queue. */
function n80_task_status(string $module,string $id,string $native,array $details=[]):array {
    $state=match(true){
        in_array($native,['queued','pending','planned'],true),str_starts_with($native,'queued_')=>'queued',
        in_array($native,['running','in_progress','analyzing','rendering','uploading','collecting_metrics','creating_text','mastering_audio'],true)=>'running',
        in_array($native,['complete','completed','succeeded','saved','published','audio_ready','acknowledged','already_acknowledged'],true)=>'succeeded',
        in_array($native,['failed','error'],true)=>'failed',
        in_array($native,['cancelled','canceled'],true)=>'cancelled',
        in_array($native,['review','needs_review','creation_review','review_highlights','review_video','unconfirmed','timed_out','expired'],true)=>'needs_review',
        in_array($native,['paused','connection_required','admin_unavailable','blocked'],true)=>'blocked',
        $native==='idle'=>'idle',
        default=>'unknown',
    };
    return ['engine'=>'N80 Engine','module'=>$module,'taskId'=>$id,'state'=>$state,'nativeState'=>$native,
        'terminal'=>in_array($state,['succeeded','failed','cancelled'],true)]
        +array_intersect_key($details,array_flip(['operation','updatedAt','error','missing','replayed']));
}
