<?php
declare(strict_types=1);
/** Existing recommendation module owns popularity computation. */
function n80_personalization_calculate():array {
 $bridge=dirname(__DIR__,2).'/noa-bridge';
  require_once $bridge.'/storage.php';require_once $bridge.'/popularity-store.php';$db=noa_bridge_pdo();$db->exec("SET time_zone='+00:00'");
  if(!np_ready($db))throw new RuntimeException('hub_popularity_not_installed');return ['ok'=>true,'result'=>np_calculate($db)];
}
