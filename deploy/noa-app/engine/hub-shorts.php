<?php
declare(strict_types=1);
require_once __DIR__.'/hub.php';

/** Called only inside the authenticated heartbeat's Hub lock. No media work. */
function n80_hub_migrate_shorts_clock(string $root,string $web):bool {
    return false; // Automatic Shorts retired by owner; never migrate/reactivate it.
}

/** Bounded execution evidence: clock success is not a finished video/upload. */
function n80_hub_shorts_outcome(array $result):array {
    $campaign=$result['campaign']??[];
    $state=(string)($result['state']??'not_verified');
    if(!in_array($state,['paused','connection_required','waiting_schedule','ready','host_owned'],true))$state='not_verified';
    $allowed=['persistent_browser_executor_required','chatgpt_unattended_dispatch_not_verified',
  'google_drive_authorization_required','google_drive_readback_verification_required',
  'youtube_offline_connection_required','youtube_auto_publication_not_enabled',
  'youtube_related_video_adapter_not_verified'];
    return ['scope'=>'schedule_and_readiness_only','state'=>$state,
        'productionReady'=>($campaign['productionReady']??false)===true,
        'missing'=>array_values(array_intersect($allowed,$campaign['readiness']['missing']??[])),
        'processed'=>max(0,(int)($result['processed']??0)),'uploads'=>max(0,(int)($result['uploads']??0))];
}
