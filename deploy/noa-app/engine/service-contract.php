<?php
declare(strict_types=1);
/** Engine routing metadata only; no providers, storage or worker execution. */
function n80_service_operations():array {
    require_once __DIR__.'/media.php';
    return [
        ...array_fill_keys(['muvy_claim','muvy_complete','muvy_failed'],['module'=>'lab','handler'=>'worker-muvy.php','permission'=>'ai:muvy','method'=>'POST','store'=>'lab:muvy.json']),
        'n80_native_verify'=>['module'=>'admin','handler'=>'worker-native.php','permission'=>'native:verify','method'=>'POST','store'=>'existing_native_stores'],
        'n80_status'=>['module'=>'lab','handler'=>'worker-status.php','permission'=>'ai:read','method'=>'POST','store'=>'existing_native_stores'],
        'n80_daily_shorts_tick'=>['module'=>'lab','handler'=>'worker-shorts.php','permission'=>'media:worker','method'=>'POST','store'=>'lab:state.json:campaigns.daily_shorts'],
        'n80_browser_tick'=>['module'=>'lab','handler'=>'worker-browser.php','permission'=>'media:worker','method'=>'POST','store'=>'lab:state.json:browserControl'],
        'n80_text_tick'=>['module'=>'lab','handler'=>'worker-text.php','permission'=>'ai:text','method'=>'POST','store'=>'noa_documents:n80_ai_task'],
        'n80_batch_watchdog'=>['module'=>'creator_lab','handler'=>'worker-batch.php','permission'=>'batch:recover','method'=>'POST','store'=>'gpt-action'],
        'n80_listening_index'=>['module'=>'catalog','handler'=>'worker-index.php','permission'=>'catalog:index','method'=>'POST','store'=>'mysql'],
    ]+n80_media_service_operations();
}
