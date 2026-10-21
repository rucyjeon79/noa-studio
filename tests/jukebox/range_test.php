<?php
declare(strict_types=1);define('_GNUBOARD_',true);require dirname(__DIR__,2).'/deploy/noa-app/jukebox/core.php';
foreach([[null,[0,99,200]],['bytes=0-9',[0,9,206]],['bytes=90-',[90,99,206]],['bytes=-10',[90,99,206]],['bytes=0-999',[0,99,206]]] as [$s,$expected])if(nj_range($s,100)!==$expected)throw new RuntimeException('range mismatch');
foreach(['bytes=100-','bytes=9-2','bytes=0-1,3-4','bytes=-0','bad'] as $s){$rejected=false;try{nj_range($s,100);}catch(InvalidArgumentException $e){$rejected=true;}if(!$rejected)throw new RuntimeException('invalid range accepted');}
foreach(['../secret','/etc/passwd','K-POP/../../secret',"x\0.mp3",'K-POP\\file'] as $p)if(nj_file($p)!==null)throw new RuntimeException('unsafe path accepted');
echo "PASS ranges, suffix ranges, 416 validation and traversal rejection\n";
