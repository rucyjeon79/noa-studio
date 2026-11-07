<?php
declare(strict_types=1);
if(!isset($context))throw new RuntimeException('n80_dispatch_required');
require_once __DIR__.'/channel-batch-ai.php';
require_once dirname(__DIR__).'/noa-app/engine/song-generation.php';
ncbai_watchdog(lab_root().'/gpt-action',(string)$context['admin']);
return ['ok'=>true];
