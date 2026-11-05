<?php
$target=sys_get_temp_dir().'/noa-member-native';@mkdir($target.'/bbs',0777,true);file_put_contents($target.'/common.php','<?php');copy(__DIR__.'/../workspace/board_fixture.php',$target.'/bbs/board.php');
foreach(['list','read','write'] as $view){$_GET['view']=$view;ob_start();include $target.'/bbs/board.php';$html=ob_get_clean();file_put_contents($target.'/'.$view.'.html',$html);}
echo "ISOLATED_NATIVE_BOARD_CONTRACT_FIXTURES_READY\n";

define('NOA_SITEMAP_REGISTRY_ONLY',true);require __DIR__.'/../../deploy/noa-sitemap.php';$routes=[];foreach(noa_sitemap_registry() as $group)foreach($group['routes'] as $route)if($route[5]!=='admin')$routes[]=explode('#',$route[3])[0];file_put_contents($target.'/routes.json',json_encode(array_values(array_unique($routes))));
