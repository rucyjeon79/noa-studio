<?php
declare(strict_types=1);
/** Existing signed URL delegates to N80 Media; no independent worker. */
if(!isset($context,$b,$action))throw new RuntimeException('n80_dispatch_required');
require_once dirname(__DIR__).'/noa-app/engine/media.php';
return n80_media_service_execute($action,$b,$context);
