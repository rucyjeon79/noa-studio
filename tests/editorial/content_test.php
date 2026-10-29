<?php
error_reporting(E_ALL);
set_error_handler(static function($severity,$message,$file,$line){throw new ErrorException($message,0,$severity,$file,$line);});
define('_GNUBOARD_',true);
require __DIR__.'/../../deploy/noa-app/editorial.php';
function check($condition,$message){if(!$condition)throw new RuntimeException($message);}
$docs=noa_editorial_documents();
foreach(['privacy','terms'] as $key){
 $ids=array_column($docs[$key]['sections'],'id');check(count($ids)===count(array_unique($ids)),'duplicate_anchor');
 check(!str_contains(noa_editorial_plain($key),'<p>'),'raw_markup_in_consent');
 check(!str_contains(noa_editorial_plain($key),'내용을 입력'),'placeholder');
}
foreach(['about','privacy','terms'] as $page){
 ob_start();noa_editorial_render($page);$html=ob_get_clean();
 check(substr_count($html,'<h1 ')===1,'one_primary_heading');
 check(str_contains($html,'제이알'),'operator_missing');
 check(str_contains($html,'aria-current="page"'),'current_navigation_missing');
 check(str_contains($html,'/noa-assets/editorial-starlight-studio.webp'),'hero_missing');
 $dom=new DOMDocument();libxml_use_internal_errors(true);$dom->loadHTML('<?xml encoding="UTF-8">'.$html);libxml_clear_errors();
 $xpath=new DOMXPath($dom);foreach($xpath->query('//a[starts-with(@href,"#")]') as $a){$id=substr($a->getAttribute('href'),1);check($xpath->query('//*[@id="'.$id.'"]')->length===1,'broken_section_link:'.$id);}
 check($xpath->query('//a[@target="_blank" and not(contains(@rel,"noopener"))]')->length===0,'external_tab_isolation');
 if($page==='about')foreach(['하람','하준','부캐 버전','별무리'] as $text)check(str_contains($html,$text),'missing_user_fact');
}
check(nea_e('<script>')==='&lt;script&gt;','escape_failure');
require __DIR__.'/../../bridge/member-access.php';
foreach(['/noa-about.php','/noa-privacy.php','/noa-terms.php'] as $path)check(nam_allowed(nam_access(),nam_requirement($path)),'public_document_requires_login');
foreach(['privacy','provision'] as $id)check(nam_allowed(nam_access(),nam_requirement('/bbs/content.php','GET',['co_id'=>$id])),'legacy_document_requires_login');
check(!nam_allowed(nam_access(),nam_requirement('/bbs/content.php','GET',['co_id'=>'private'])),'unrelated_content_authorization_changed');
echo "Editorial routes, content, anchors, escaping and guest access passed.\n";
