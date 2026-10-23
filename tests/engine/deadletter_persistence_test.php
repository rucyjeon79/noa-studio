<?php
declare(strict_types=1);
require_once dirname(__DIR__,2).'/deploy/noa-app/engine/lease-state.php';
$dir=sys_get_temp_dir().'/n80-deadletter-'.getmypid().'-'.bin2hex(random_bytes(4));
mkdir($dir,0700);
try{
 $a=n80_lease_state_transition($dir,'evt1','music','claim',100,null,10,1);
 if(!$a['ok'])exit(1);
 $b=n80_lease_state_transition($dir,'evt1','music','claim',111,null,10,1);
 if($b['ok']||$b['error']!=='retry_exhausted'||$b['state']['status']!=='dead_letter')exit(2);
 $files=glob($dir.'/*.json');
 if(count($files)!==1)exit(3);
 $stored=json_decode(file_get_contents($files[0]),true);
 if($stored['status']!=='dead_letter'||$stored['attempts']!==1)exit(4);
 $c=n80_lease_state_transition($dir,'evt1','music','claim',112,null,10,1);
 if($c['ok']||$c['error']!=='terminal')exit(5);
 echo "N80_DEADLETTER_PERSISTENCE_OK\n";
}finally{
 foreach(glob($dir.'/{*,.*}',GLOB_BRACE) as $file)if(is_file($file))unlink($file);
 rmdir($dir);
}
