<?php
declare(strict_types=1);
$source=file_get_contents(dirname(__DIR__,2).'/deploy/noa-app/jukebox/cli.php');
if($source===false)exit(1);
foreach(["PHP_SAPI!=='cli'","N80_CLI_EMIT_ENABLED","n80_ready_event_from_job","n80_verified_ready_pipeline","N80_PRIVATE_EVENT_DIR"] as $needle){
 if(!str_contains($source,$needle))exit(2);
}
if(str_contains($source,'n80_engine_execute(')||str_contains($source,'n80_dispatch('))exit(3);
echo "N80_CLI_PRODUCER_STATIC_OK\n";
