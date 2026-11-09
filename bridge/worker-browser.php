<?php
declare(strict_types=1);
if(!isset($context,$action)||$action!=='n80_browser_tick')throw new RuntimeException('n80_dispatch_required');
require_once __DIR__.'/browser-control.php';
return lab_lock(fn(&$s)=>nb_worker($s,$b,time()));
