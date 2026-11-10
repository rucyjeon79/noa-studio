<?php
declare(strict_types=1);
/** Existing creator module owns recovery of its batch tasks. */
function n80_creator_lab_recover():array {
 require_once __DIR__.'/lab.php';
 return n80_lab_host_service('n80_batch_watchdog');
}
