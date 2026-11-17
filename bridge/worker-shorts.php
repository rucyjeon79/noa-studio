<?php
declare(strict_types=1);
if(!isset($context,$action)||$action!=='n80_daily_shorts_tick')throw new RuntimeException('n80_dispatch_required');
// All commands, including legacy preparation/storage/assembly, are retired here.
// Existing jobs and media remain readable through the session tools.
return ['ok'=>true,'state'=>'retired','reason'=>'automatic_shorts_retired','processed'=>0,'uploads'=>0,'providerCalls'=>0,'executionAllowed'=>false];
