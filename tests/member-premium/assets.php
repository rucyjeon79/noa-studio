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

// Exercise server-rendered first paint, including native POST validation pages.
$body='<body><header id="hd">기존 쇼핑몰 메뉴</header><main id="container"><form id="sod_frm" action="/shop/orderformupdate.php" method="post"><input type="hidden" name="token" value="keep-token"><label for="od_name">이름</label><input id="od_name" name="od_name" class="frm_input" required value="입력 유지"></form><section id="bo_w"><input class="frm_input" aria-label="제목" value="작성 중인 제목"></section></main></body>';
$proof=[];
foreach(['/shop/cart.php','/shop/orderform.php','/mobile/shop/orderform.php','/bbs/write.php','/bbs/register_form.php'] as $path){
 foreach(['',' class="existing"'," class='existing'",' class=existing',' class="noa-member-ui existing"'] as $attribute){
  $_SERVER=['REQUEST_URI'=>$path,'REQUEST_METHOD'=>'POST'];
  $html='<html lang="ko"'.$attribute.'><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>'.$body.'</html>';
  $rendered=noa_member_first_paint_markup($html,$path);
  if(!str_contains($rendered,$body))throw new Exception('first paint changed native form '.$path);
  if(noa_member_first_paint_markup($rendered,$path)!==$rendered)throw new Exception('first paint not idempotent');
  preg_match('~<html\b[^>]*class=["\']([^"\']*)~',$rendered,$root);
  $classes=preg_split('/\s+/',$root[1]??'');$expected=str_starts_with($path,'/bbs/')?'noa-g5':'ny-native';
  foreach([$expected,'noa-member-ui'] as $class)if(count(array_keys($classes,$class,true))!==1)throw new Exception('missing or duplicate first paint class '.$path);
  if($attribute!==''&&!in_array('existing',$classes,true))throw new Exception('existing class lost');
  if($attribute===''){
   $rendered=str_replace('</head>','<style>#captcha #captcha_key{background:#fff}</style></head>',$rendered);
   $rendered=str_replace('</main>','<fieldset id="captcha"><label for="captcha_key">자동등록방지</label><input type="text" id="captcha_key" name="captcha_key"></fieldset></main>',$rendered);
   $proof[]=['path'=>$path,'html'=>$rendered,'class'=>$expected];
  }
 }
}
foreach(['/adm/index.php','/noa-bridge/index.php','/noa-app/jukebox/','/unrelated.php','/noa-youngcart.php'] as $path){
 $html='<html class="existing"><head></head>'.$body.'</html>';
 if(noa_member_first_paint_markup($html,$path)!==$html)throw new Exception('first paint escaped native scope');
}
if(noa_member_first_paint_markup('{"ok":true}','/bbs/ajax.php')!=='{"ok":true}')throw new Exception('first paint changed JSON');
$json=json_encode(['html'=>'<html><head></head><body>응답 안의 HTML</body></html>']);
if(noa_member_first_paint_markup($json,'/bbs/ajax.php')!==$json)throw new Exception('first paint changed embedded HTML in JSON');
$target=sys_get_temp_dir().'/noa-member-native';@mkdir($target,0777,true);file_put_contents($target.'/first-paint.json',json_encode($proof,JSON_UNESCAPED_UNICODE));
echo "MEMBER_NATIVE_FIRST_PAINT_CLASSES_AND_POST_VALUES_OK\n";
