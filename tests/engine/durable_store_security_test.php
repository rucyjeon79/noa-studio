<?php
declare(strict_types=1);
require_once dirname(__DIR__,2).'/deploy/noa-app/engine/durable-store.php';
$dir=sys_get_temp_dir().'/n80-store-security-'.getmypid().'-'.bin2hex(random_bytes(4));
mkdir($dir,0700);
$event=['id'=>'evt-sec','type'=>'audio.ready','source'=>'jukebox','subjectId'=>'track','occurredAt'=>'2026-10-23T00:00:00Z','schemaVersion'=>1,'correlationId'=>'corr'];
$target=$dir.'/'.hash('sha256',$event['id']).'.json';
$external=tempnam(sys_get_temp_dir(),'n80-outside-');file_put_contents($external,'protected');
try {
 if(!symlink($external,$target))exit(2);
 $result=noa_engine_store_event($dir,$event);
 if($result['ok']||$result['error']!=='unsafe_target')exit(3);
 if(file_get_contents($external)!=='protected')exit(4);
 unlink($target);
 if(!symlink($external,$dir.'/.engine.lock'))exit(5);
 $result=noa_engine_store_event($dir,$event);
 if($result['ok']||$result['error']!=='unsafe_lock')exit(6);
 unlink($dir.'/.engine.lock');
 $result=noa_engine_store_event($dir,$event);
 if(!$result['ok']||$result['status']!=='stored')exit(7);
 echo "N80_DURABLE_STORE_SECURITY_OK\n";
}finally{
 foreach(glob($dir.'/{*,.*}',GLOB_BRACE) as $file)if(is_file($file)||is_link($file))unlink($file);
 rmdir($dir);unlink($external);
}
