<?php
/** Additive common styles: preserve active theme, skins, forms and all GnuBoard core files. */
if(!defined('_GNUBOARD_'))exit;
function noa_policy_script_revision($html){
 return preg_replace("~(<script\\b[^>]*\\bsrc=[\"'])/noa-ui[.]js(?:[?][^\"']*)?([\"'])~i",'$1/noa-ui.js?v=20261024-policy1$2',$html);
}
function noa_design_assets(){
 global $config;
 $path=parse_url($_SERVER['REQUEST_URI']??'',PHP_URL_PATH);
 if(!is_string($path))return;
 $native=preg_match('~^/(?:bbs|adm)/~',$path);
 $workspace=preg_match('~^/noa-app/(?:database|taxonomy|jukebox)/(?:index[.]php)?$~',$path);
 $public=in_array($path,['/','/index.php'],true)||preg_match('~^/noa-(?:music|youtube|world|my|settings|catalog|ai-lab|library|editor|download|theme-admin)(?:-admin)?[.]php$~',$path);
 if(!$native&&!$workspace&&!$public)return;
 if(!$native&&($_SERVER['REQUEST_METHOD']??'GET')!=='GET')return;
 // Standalone views do not call GnuBoard html_end(); inject only completed HTML.
 if(!$native){
  $assets='<link rel="stylesheet" href="/noa-policy-20261024.css">';
  if($workspace){
   if(!str_starts_with($path,'/noa-app/jukebox/'))$assets='<link rel="stylesheet" href="/noa-ui.css?v=20261022-recovery2">'.$assets;
   $assets.='<script src="/noa-ui.js?v=20261024-policy1" data-noa-theme-only defer></script>';
  }
  ob_start(static function($html)use($assets){
   if(http_response_code()>=300||stripos($html,'</head>')===false)return $html;
   $html=noa_policy_script_revision($html);
   return str_ireplace('</head>',$assets.'</head>',$html);
  });
  return;
 }
 // Native skins use GnuBoard's ordered asset registration.
 if(!str_starts_with($path,'/adm/'))add_stylesheet('<link rel="stylesheet" href="/noa-policy-20261024.css">',999);
 $config['cf_title']='NOA STUDIO';
 // The core admin uses light panels; consumer theme tokens must not leak into it.
 if(str_starts_with($path,'/adm/')){
  add_javascript('<script src="/noa-brand.js?v=20261021-brand1" defer></script>',99);
  add_stylesheet('<link rel="stylesheet" href="/noa-admin.css?v=20261020-admin1">',99);
  return;
 }
 add_stylesheet('<link rel="stylesheet" href="/noa-ui.css?v=20261022-recovery2">',99);
 // Keep registration identical to theme/head.php for GnuBoard asset deduplication.
 add_javascript('<script src="/noa-brand.js?v=20261021-brand1" defer></script><script src="/noa-ui.js?v=20261022-recovery1" defer></script>',99);
}
if(function_exists('add_event'))add_event('common_header','noa_design_assets',10,0);
if(function_exists('add_replace'))add_replace('html_process_buffer',static function($html){
 $path=parse_url($_SERVER['REQUEST_URI']??'',PHP_URL_PATH);
 return is_string($path)&&str_starts_with($path,'/bbs/')?noa_policy_script_revision($html):$html;
},10,1);
