<?php
/** Add an admin navigation link without changing any GnuBoard core file. */
if(!defined('_GNUBOARD_'))exit;
function noa_database_admin_link(){
 global $is_member,$is_admin,$member,$config;
 if(empty($is_member)||($is_admin??'')!=='super'||($member['mb_id']??'')!==($config['cf_admin']??''))return;
 $path=parse_url($_SERVER['REQUEST_URI']??'',PHP_URL_PATH);
 if(str_starts_with((string)$path,'/adm/')||in_array($path,['/noa-library.php','/noa-theme-admin.php','/noa-catalog-admin.php','/noa-ai-lab.php'],true))
 add_javascript('<script src="/noa-app/database/admin-link.js?v=20261021-db1" defer></script>',100);
}
if(function_exists('add_event'))add_event('common_header','noa_database_admin_link',10,0);
// Standalone pages do not flush GnuBoard's script queue. Inject only their GET HTML.
if(($_SERVER['REQUEST_METHOD']??'GET')==='GET'&&($is_admin??'')==='super'&&($member['mb_id']??'')===($config['cf_admin']??'')&&in_array(parse_url($_SERVER['REQUEST_URI']??'',PHP_URL_PATH),['/noa-library.php','/noa-theme-admin.php','/noa-catalog-admin.php','/noa-ai-lab.php'],true))
 ob_start(static function($html){return str_replace('</body>','<script src="/noa-app/database/admin-link.js?v=20261021-db1" defer></script></body>',$html);});
