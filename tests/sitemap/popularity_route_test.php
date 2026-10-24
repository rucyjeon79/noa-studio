<?php
declare(strict_types=1);
define('NOA_SITEMAP_REGISTRY_ONLY',true);
require __DIR__.'/../../deploy/noa-sitemap.php';
$root=sys_get_temp_dir().'/noa-popularity-map-'.bin2hex(random_bytes(6));
mkdir($root.'/noa-app/popularity',0700,true);
function has_popularity(string $root,string $role):bool{foreach(noa_sitemap_visible_groups($root,$role)as $group)foreach($group['routes']as $route)if($route[0]==='popularity')return true;return false;}
try{
 file_put_contents($root.'/noa-app/popularity/index.php','<?php // fixture');
 if(has_popularity($root,'guest')||has_popularity($root,'member')||!has_popularity($root,'admin'))throw new RuntimeException('popularity route role guard failed');
 unlink($root.'/noa-app/popularity/index.php');
 if(has_popularity($root,'admin'))throw new RuntimeException('missing popularity page exposed');
 echo "popularity sitemap: role and actual-file guards PASS\n";
}finally{
 if(is_file($root.'/noa-app/popularity/index.php'))unlink($root.'/noa-app/popularity/index.php');
 rmdir($root.'/noa-app/popularity');rmdir($root.'/noa-app');rmdir($root);
}
