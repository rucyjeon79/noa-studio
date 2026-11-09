<?php
declare(strict_types=1);
/** Invoked only by the authenticated Hub service, using the existing module stores. */
function n80_hub_specialist(string $operation):array {
 global $config;
 $web=dirname(__DIR__,2);$bridge=$web.'/noa-bridge';
 if($operation==='hub.verify')return ['ok'=>true,'hostExecution'=>true,'phpVersion'=>PHP_VERSION_ID,'githubRequired'=>false];
 $actions=['ai.text'=>'n80_text_tick','ai.batch'=>'n80_batch_watchdog','catalog.index'=>'n80_listening_index','ai.daily_shorts_clock'=>'n80_daily_shorts_tick'];
 if(isset($actions[$operation])){
  require_once __DIR__.'/service-runtime.php';require_once $bridge.'/lab-core.php';
  return n80_service_execute($actions[$operation],[],['authenticatedByServer'=>true,'principal'=>'n80_lab_worker','permissions'=>['ai:text','batch:recover','catalog:index','media:worker'],'method'=>'POST','admin'=>(string)($config['cf_admin']??'')]);
 }
 if($operation==='notifications.dispatch'){
  require_once $bridge.'/storage.php';require_once $bridge.'/notifications-sources.php';require_once $bridge.'/notifications-inline.php';
  $db=noa_bridge_pdo();if(!nnt_ready($db)||!nnt_inline_capable())throw new RuntimeException('hub_notification_runtime_unavailable');
  return ['ok'=>true]+nnt_inline_drain($db,nnt_config());
 }
 if($operation==='popularity.calculate'){
  require_once $bridge.'/storage.php';require_once $bridge.'/popularity-store.php';$db=noa_bridge_pdo();
  if(!np_ready($db))throw new RuntimeException('hub_popularity_not_installed');return ['ok'=>true,'result'=>np_calculate($db)];
 }
 throw new InvalidArgumentException('hub_specialist_not_installed');
}
