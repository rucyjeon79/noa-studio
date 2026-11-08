<?php
declare(strict_types=1);
if(!isset($context,$action)||$action!=='n80_daily_shorts_tick')throw new RuntimeException('n80_dispatch_required');
require_once __DIR__.'/session-shorts.php';
$policy=nd_shorts_policy();$ready=nd_shorts_readiness(lab_read(),$policy);
return lab_lock(fn(&$s)=>nd_shorts_tick($s,$policy,time(),$ready));
