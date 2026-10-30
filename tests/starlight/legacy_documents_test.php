<?php
// Exercise the extension as installed under /extend, including early-exit documents.
define('_GNUBOARD_',true);
function add_stylesheet($html,$priority){$GLOBALS['registered_css'][]=$html;}
function add_javascript($html,$priority){}
$root=sys_get_temp_dir().'/noa-legacy-'.bin2hex(random_bytes(6));
mkdir($root.'/extend',0700,true);
copy(dirname(__DIR__,2).'/deploy/noa-design.extend.php',$root.'/extend/noa.design.php');
foreach(['noa-starlight.css','noa-ui.css','noa-ui.js'] as $asset)file_put_contents($root.'/'.$asset,'/* fixture '.$asset.' */');
require $root.'/extend/noa.design.php';
function check($ok,$message){if(!$ok)throw new RuntimeException($message);}
try{
 foreach(['privacy','provision'] as $id){
  $_SERVER=['REQUEST_URI'=>'/bbs/content.php?co_id='.$id,'REQUEST_METHOD'=>'GET'];
  $_GET=['co_id'=>$id];$GLOBALS['config']=['cf_visit'=>'오늘:12,어제:8,최대:20,전체:100'];
  http_response_code(200);
  ob_start();$level=ob_get_level();noa_design_assets();
  check(ob_get_level()===$level+1,'legacy document must receive standalone processing');
  echo '<html lang="ko"><head><link href="/noa-ui.css" rel="stylesheet"><script src="/noa-ui.js"></script></head><body><main>Published document</main></body></html>';
  ob_end_flush();$html=ob_get_clean();
  check(str_contains($html,'data-noa-style="starlight"'),'missing shared style');
  check(str_contains($html,'/noa-starlight.css?v='),'missing shared stylesheet');
  check(str_contains($html,'/noa-ui.js?v='.hash_file('sha256',$root.'/noa-ui.js')),'stale navigation');
  check(substr_count($html,'id="noa-visitor-counts"')===1,'counter must appear once');
  check(str_contains($html,'"today":"12"'),'must reuse actual GnuBoard counts');
  check(str_contains($html,'<main>Published document</main>'),'document content changed');
 }
 foreach([
  ['/bbs/content.php','POST',['co_id'=>'privacy']],
  ['/bbs/content.php','GET',['co_id'=>'other']],
  ['/bbs/content.php','GET',['co_id'=>['privacy']]],
  ['/bbs/board.php?bo_table=free','GET',[]],
  ['/bbs/write_update.php','POST',[]],
  ['/bbs/register_form_update.php','POST',[]],
 ] as [$path,$method,$query]){
  $_SERVER=['REQUEST_URI'=>$path,'REQUEST_METHOD'=>$method];$_GET=$query;
  $level=ob_get_level();noa_design_assets();
  check(ob_get_level()===$level,'native forms and other content must retain their own pipeline');
 }
 foreach([['{"ok":true}',200],['<html><head></head><body>Redirect</body></html>',302]] as [$body,$status]){
  $_SERVER=['REQUEST_URI'=>'/bbs/content.php?co_id=privacy','REQUEST_METHOD'=>'GET'];$_GET=['co_id'=>'privacy'];
  http_response_code($status);ob_start();noa_design_assets();echo $body;ob_end_flush();
  check(ob_get_clean()===$body,'non-HTML and redirects must remain untouched');
 }
 http_response_code(200);
 echo "LEGACY_DOCUMENT_PIPELINE_OK: legal routes, revisions, counters, native forms, JSON and redirects\n";
}finally{
 foreach(glob($root.'/extend/*') as $file)unlink($file);
 rmdir($root.'/extend');foreach(glob($root.'/*') as $file)unlink($file);rmdir($root);
}
