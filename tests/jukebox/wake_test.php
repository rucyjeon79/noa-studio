<?php
declare(strict_types=1);
define('_GNUBOARD_',true);
require __DIR__.'/../../deploy/noa-app/jukebox/wake-core.php';
function check($value,$expected):void{if($value!==$expected)throw new RuntimeException('wake assertion failed: '.json_encode([$value,$expected]));}
$dir=sys_get_temp_dir().'/noa-wake-'.bin2hex(random_bytes(8));mkdir($dir,0700);$calls=0;
$send=function($token)use(&$calls){$calls++;return 204;};
try{
 check(nw_request($dir,$send,100),'not_configured');check($calls,0);
 file_put_contents($dir.'/upload-wake-token',str_repeat('a',40));chmod($dir.'/upload-wake-token',0600);
 check(nw_request($dir,$send,100),'requested');check($calls,1);
 check(nw_request($dir,$send,101),'already_requested');check($calls,1);
 check(nw_request($dir,fn($token)=>403,161),'recovery_pending');
 check(nw_request($dir,$send,162),'already_requested');
 check(nw_request($dir,$send,172),'requested');check($calls,2);
 check(nw_request($dir,fn($token)=>throw new RuntimeException('offline'),233),'recovery_pending');
 check(nw_request($dir,$send,234),'already_requested');check($calls,2);
 check(nw_request($dir,$send,244),'requested');check($calls,3);
 $lock=fopen($dir.'/upload-wake-state','c+');flock($lock,LOCK_EX);
 check(nw_request($dir,$send,400),'already_requested');check($calls,3);fclose($lock);
 check(str_contains(file_get_contents($dir.'/upload-wake-state'),str_repeat('a',40)),false);
 echo "wake: dispatch, deduplication, failure fallback, lock and secret isolation passed\n";
}finally{foreach(glob($dir.'/*')as $p)unlink($p);rmdir($dir);}
