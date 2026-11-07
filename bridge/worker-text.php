<?php
declare(strict_types=1);
if(!isset($context))throw new RuntimeException('n80_dispatch_required');
require_once __DIR__.'/storage.php';
require_once __DIR__.'/ainoa-core.php';
require_once __DIR__.'/ainoa-automation.php';
if(empty(lab_read()['config']['workerEnabled']))$result=['processed'=>0,'state'=>'paused'];
else $result=n80_ai_tick(noa_bridge_pdo(),(string)$context['admin']);
require_once dirname(__DIR__).'/noa-app/engine/creative.php';
$result['creativeRecoveryCleanup']=ncd_cleanup_recovery(noa_bridge_pdo());
lab_lock(static function(&$s)use($result){$s['worker']['at']=gmdate('c');$s['worker']['version']='n80-2';$s['worker']['operations']['n80_text_tick']=array_intersect_key($result,array_flip(['processed','state','missing','creativeRecoveryCleanup']));});
return ['ok'=>true]+$result;
