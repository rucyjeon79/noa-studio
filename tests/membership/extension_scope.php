<?php
declare(strict_types=1);
define('_GNUBOARD_',true);
function nr_policy():array{return ['enabled'=>false];}
$fixture=sys_get_temp_dir().'/noa-extension-'.bin2hex(random_bytes(6));
mkdir($fixture.'/extend',0700,true);mkdir($fixture.'/noa-bridge',0700);
file_put_contents($fixture.'/noa-bridge/membership-core.php',"<?php\n");
file_put_contents($fixture.'/noa-account.css','body{}');
file_put_contents($fixture.'/noa-account.js','window.noaAccount=true;');
copy($argv[1]??dirname(__DIR__,2).'/deploy/noa-membership.extend.php',$fixture.'/extend/noa.00-membership.php');
try{
 foreach(['/bbs/logout.php?url=%2F','/bbs/logout.php?url=%2Fnoa-my.php','/bbs/login.php?url=%2Fnoa-my.php','/bbs/board.php?bo_table=free']as $request){
  $_SERVER['REQUEST_METHOD']='GET';$_SERVER['REQUEST_URI']=$request;
  $url=str_contains($request,'noa-my')?'/noa-my.php':'/';$expected=$url;
  $kind='core-kind';$file='core-file';$assetRoot='core-root';$assets='core-assets';
  ob_start();require $fixture.'/extend/noa.00-membership.php';
  if($url!==$expected)throw new RuntimeException('Core redirect URL overwritten for '.$request);
  if($kind!=='core-kind'||$file!=='core-file'||$assetRoot!=='core-root'||$assets!=='core-assets')throw new RuntimeException('Asset injection leaked request variables');
  echo '<html><head></head><body>NOA</body></html>';ob_end_flush();$html=ob_get_clean();
  if(!str_contains($html,'/noa-account.js?v=')||!str_contains($html,'/noa-account.css?v='))throw new RuntimeException('Shared account assets missing');
  if($url!==$expected)throw new RuntimeException('Output callback changed redirect');
 }
 echo "NOA_EXTENSION_SCOPE_OK 4 request cases\n";
}finally{
 while(ob_get_level()>0)ob_end_clean();
 foreach(['/extend/noa.00-membership.php','/noa-bridge/membership-core.php','/noa-account.css','/noa-account.js']as $file)@unlink($fixture.$file);
 @rmdir($fixture.'/extend');@rmdir($fixture.'/noa-bridge');@rmdir($fixture);
}
