<?php
/** Verify registration with real extension output; no GnuBoard/database boot. */
define('_GNUBOARD_',true);$styles=[];$scripts=[];$config=[];
function add_event(...$args){}function add_replace(...$args){}
function add_stylesheet($html,$priority){global $styles;$styles[$priority][]=$html;}
function add_javascript($html,$priority){global $scripts;$scripts[$priority][]=$html;}
require __DIR__.'/../../deploy/noa-design.extend.php';
foreach(['/','/noa-creator-apply.php','/noa-gifts.php','/bbs/write.php','/bbs/register_form.php','/shop/cart.php','/shop/orderform.php','/mobile/shop/orderform.php'] as $path){
 $styles=$scripts=[];$_SERVER=['REQUEST_URI'=>$path,'REQUEST_METHOD'=>'GET'];http_response_code(200);
 ob_start();$level=ob_get_level();noa_design_assets();echo '<html><head></head><body><form action="/unchanged" method="post"><input name="token" value="unchanged"></form></body></html>';if(ob_get_level()>$level)ob_end_flush();$html=ob_get_clean();
 $registered=$html.json_encode([$styles,$scripts]);foreach(['css','js'] as $kind)if(!str_contains($registered,'noa-member-surfaces.'.$kind.'?v='))throw new Exception('asset missing '.$path);
 if(!str_contains($html,'name="token" value="unchanged"'))throw new Exception('form changed');
}
foreach(['/noa-bridge/index.php','/unrelated.php','/adm/index.php'] as $path){$styles=$scripts=[];$_SERVER=['REQUEST_URI'=>$path,'REQUEST_METHOD'=>'GET'];noa_design_assets();if(str_contains(json_encode([$styles,$scripts]),'noa-member-surfaces'))throw new Exception('nonmember pollution');}
$_SERVER=['REQUEST_URI'=>'/noa-gifts.php','REQUEST_METHOD'=>'POST'];ob_start();$level=ob_get_level();noa_design_assets();echo '{"ok":true}';if(ob_get_level()>$level)ob_end_flush();$json=ob_get_clean();if($json!=='{"ok":true}')throw new Exception('JSON changed');
echo "MEMBER_SURFACE_HTML_ONLY_ASSETS_AND_FORM_CONTRACT_OK\n";
