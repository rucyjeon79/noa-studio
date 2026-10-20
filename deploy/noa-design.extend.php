<?php
/** Additive common styles: preserve active theme, skins, forms and all GnuBoard core files. */
if(!defined('_GNUBOARD_'))exit;
function noa_design_assets(){
 global $config;
 $path=parse_url($_SERVER['REQUEST_URI']??'',PHP_URL_PATH);
 if(!is_string($path)||!preg_match('~^/(?:bbs|adm)/~',$path))return;
 $config['cf_title']='NOA STUDIO';
 // The core admin uses light panels; consumer theme tokens must not leak into it.
 if(str_starts_with($path,'/adm/')){
  add_javascript('<script src="/noa-brand.js?v=20261021-brand1" defer></script>',99);
  add_stylesheet('<link rel="stylesheet" href="/noa-admin.css?v=20261020-admin1">',99);
  return;
 }
 add_stylesheet('<link rel="stylesheet" href="/noa-ui.css?v=20261021-home1">',99);
 add_javascript('<script src="/noa-brand.js?v=20261021-brand1" defer></script><script src="/noa-ui.js?v=20261021-world2" defer></script>',99);
}
if(function_exists('add_event'))add_event('common_header','noa_design_assets',10,0);
