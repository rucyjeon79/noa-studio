<?php
declare(strict_types=1);
/** Hub schedules and records; fixed specialized owners perform the business work. */
require_once __DIR__.'/hub.php';
function n80_hub_specialist(string $operation):array {
 $route=n80_hub_operations()[$operation]??null;
 if(!$route)throw new InvalidArgumentException('hub_specialist_not_installed');
 if($operation==='hub.verify')return ['ok'=>true,'module'=>'hub','hostExecution'=>true,'phpVersion'=>PHP_VERSION_ID,'githubRequired'=>false];
 require_once __DIR__.'/'.$route['handler'];
 $result=match($operation){
  'ai.text','ai.daily_shorts_clock'=>n80_lab_hub_execute($operation),
  'ai.batch'=>n80_creator_lab_recover(),
  'catalog.index'=>n80_catalog_index(),
  'notifications.dispatch'=>n80_notify_dispatch(),
  'covers.refresh'=>n80_media_refresh_covers(),
  'popularity.calculate'=>n80_personalization_calculate(),
  'members.maintain'=>n80_sign_maintain(),
  default=>throw new InvalidArgumentException('hub_specialist_not_installed'),
 };
 $actual=$result['runtime']['module']??$result['module']??$route['module'];
 if($actual!==$route['module'])throw new RuntimeException('hub_specialist_owner_mismatch');
 $result['module']=$route['module'];return $result;
}
/** Compatibility caller remains read-only and delegates to the catalog owner. */
function n80_hub_catalog_readback(bool $moods=false):array {
 require_once __DIR__.'/catalog.php';return n80_catalog_readback($moods);
}
