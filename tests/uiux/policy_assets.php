<?php
declare(strict_types=1);
define('_GNUBOARD_',true);
$styles=[];$scripts=[];$config=[];$filters=[];
function add_stylesheet($html,$order){global $styles;$styles[]=$html;}
function add_javascript($html,$order){global $scripts;$scripts[]=$html;}
function add_event(...$args){}
function add_replace($name,$callback,...$args){global $filters;$filters[$name]=$callback;}
require dirname(__DIR__,2).'/deploy/noa-design.extend.php';
foreach(['/','/index.php','/noa-music.php','/noa-login.php','/noa-membership.php','/bbs/login.php','/noa-app/database/','/noa-app/taxonomy/index.php','/noa-app/jukebox/'] as $path){
 $styles=[];$scripts=[];$_SERVER['REQUEST_URI']=$path;$_SERVER['REQUEST_METHOD']='GET';http_response_code(200);
 ob_start();$level=ob_get_level();noa_design_assets();echo '<html><head><title>test</title><link rel="stylesheet" href="/noa-ui.css?v=20261024-category-complete"><script src="/noa-ui.js?v=20261022-recovery1" defer></script></head><body>unchanged</body></html>';if(ob_get_level()>$level)ob_end_flush();$rendered=ob_get_clean();
 if(str_starts_with($path,'/bbs/'))$rendered=$filters['html_process_buffer']($rendered);
 if(!str_contains(implode('',$styles).$rendered,'noa-policy-20261024.css'))throw new RuntimeException('policy_missing:'.$path);
 if(str_starts_with($path,'/noa-app/')&&!str_contains($rendered,'data-noa-theme-only'))throw new RuntimeException('theme_mode_missing');
 if(str_contains($rendered,'noa-ui.css?v=20261024-category-complete'))throw new RuntimeException('stale_stylesheet_revision');
 if(str_contains($rendered,'noa-ui.js?v=20261022'))throw new RuntimeException('stale_script_revision');
}
$styles=[];$scripts=[];$_SERVER['REQUEST_URI']='/noa-app/database/';ob_start();noa_design_assets();http_response_code(403);echo 'denied';ob_end_flush();$denied=ob_get_clean();if($denied!=='denied')throw new RuntimeException('authorization_response_changed');http_response_code(200);
foreach(['/noa-app/database/','/noa-app/jukebox/'] as $path){$styles=[];$scripts=[];$_SERVER['REQUEST_URI']=$path;$_SERVER['REQUEST_METHOD']='POST';noa_design_assets();if($styles||$scripts)throw new RuntimeException('post_response_changed');}
foreach(['/noa-bridge/catalog.php','/noa-app/jukebox/service.php','/noa-app/database/restore-cli.php','/unrelated.php'] as $path){$styles=[];$scripts=[];$_SERVER['REQUEST_URI']=$path;$_SERVER['REQUEST_METHOD']='GET';noa_design_assets();if($styles||$scripts)throw new RuntimeException('api_response_changed');}
$styles=[];$scripts=[];$_SERVER['REQUEST_URI']='/adm/member_list.php';noa_design_assets();if(str_contains(implode('',$styles),'noa-policy')||str_contains(implode('',$styles),'noa-ui.css'))throw new RuntimeException('core_admin_pollution');
echo "NOA_POLICY_HTML_ONLY_ASSETS_AND_ADMIN_ISOLATION_OK\n";
