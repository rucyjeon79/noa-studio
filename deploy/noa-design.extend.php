<?php
/** Additive common styles: preserve active theme, skins, forms and all GnuBoard core files. */
if(!defined('_GNUBOARD_'))exit;
function noa_design_assets(){
 global $config;
 $path=parse_url($_SERVER['REQUEST_URI']??'',PHP_URL_PATH);
 if(!is_string($path)||!preg_match('~^/(?:bbs|adm)/~',$path))return;
 $config['cf_title']='NOA STUDIO';
 add_stylesheet('<link rel="stylesheet" href="/noa-ui.css">',99);
 add_javascript('<script src="/noa-ui.js" defer></script>',99);
}
if(function_exists('add_event'))add_event('common_header','noa_design_assets',10,0);
