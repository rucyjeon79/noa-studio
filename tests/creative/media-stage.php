<?php
declare(strict_types=1);
define('_GNUBOARD_',true);
require dirname(__DIR__,2).'/deploy/noa-app/jukebox/media-location.php';
$dir=sys_get_temp_dir().'/n80-stage-'.bin2hex(random_bytes(8));mkdir($dir,0700);
function stage_check(bool $ok,string $reason):void{if(!$ok)throw new RuntimeException($reason);}
try{
 $source=$dir.'/source';$target=$dir.'/target';$original=random_bytes(65537);file_put_contents($source,$original);
 stage_check(nml_stage($source,$target),'stage must succeed');
 stage_check(file_get_contents($source)===$original&&file_get_contents($target)===$original,'both paths must retain exact bytes until commit');
 stage_check(!nml_stage($source,$target),'existing destination must not be overwritten');
 stage_check(file_get_contents($target)===$original,'collision must preserve destination');
 stage_check(!nml_stage($dir.'/missing',$dir.'/partial'),'missing source must fail');
 stage_check(!file_exists($dir.'/partial'),'failed staging must not leave a partial file');
 echo 'N80_MEDIA_STAGE_OK '.(function_exists('link')?'hardlink':'exclusive-copy')."\n";
}finally{foreach(glob($dir.'/*') as $p)unlink($p);rmdir($dir);}
