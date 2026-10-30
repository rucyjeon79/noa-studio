<?php
/** Additive common styles: preserve active theme, skins, forms and all GnuBoard core files. */
if(!defined('_GNUBOARD_'))exit;
function noa_policy_script_revision($html){
 $html=preg_replace('~<html\b(?![^>]*data-noa-style)~i','<html data-noa-style="starlight"',$html,1);
 // The installed extension lives under /extend; version the actual deployed script.
 $browse=dirname(__DIR__).'/noa-browse.js';
 $revision=is_file($browse)?hash_file('sha256',$browse):false;
 if(!$revision)$revision='20261025-four-level';
 $html=preg_replace("~(/noa-browse[.]js)(?:[?][^\"']*)?~i",'$1?v='.$revision,$html);
 $media_css=dirname(__DIR__).'/noa-app/p0-media.css';$media_revision=is_file($media_css)?hash_file('sha256',$media_css):'20261028-queue-rows';
 $html=preg_replace("~(/noa-app/p0-media[.]css)(?:[?][^\"']*)?~i",'$1?v='.$media_revision,$html);
 $css=dirname(__DIR__).'/noa-ui.css';$css_revision=is_file($css)?hash_file('sha256',$css):'20261026-home-notices';
 $html=preg_replace("~(<link\\b[^>]*\\bhref=[\"'])/noa-ui[.]css(?:[?][^\"']*)?([\"'])~i",'$1/noa-ui.css?v='.$css_revision.'$2',$html);
 $ui=dirname(__DIR__).'/noa-ui.js';$ui_revision=is_file($ui)?hash_file('sha256',$ui):'20261025-member-access';
 $html=preg_replace("~(<script\\b[^>]*\\bsrc=[\"'])/noa-ui[.]js(?:[?][^\"']*)?([\"'])~i",'$1/noa-ui.js?v='.$ui_revision.'$2',$html);
 $brand=dirname(__DIR__).'/noa-brand.js';if(is_file($brand))$html=preg_replace("~(/noa-brand[.]js)(?:[?][^\"']*)?~i",'$1?v='.hash_file('sha256',$brand),$html);
 $home_js=dirname(__DIR__).'/noa-home.js';if(is_file($home_js))$html=preg_replace("~(/noa-home[.]js)(?:[?][^\"']*)?~i",'$1?v='.hash_file('sha256',$home_js),$html);
 $world_css=dirname(__DIR__).'/noa-world.css';if(is_file($world_css))$html=preg_replace("~(/noa-world[.]css)(?:[?][^\"']*)?~i",'$1?v='.hash_file('sha256',$world_css),$html);
 $world_js=dirname(__DIR__).'/noa-world.js';if(is_file($world_js))$html=preg_replace("~(/noa-world[.]js)(?:[?][^\"']*)?~i",'$1?v='.hash_file('sha256',$world_js),$html);
 $manifest=dirname(__DIR__).'/noa-manifest.json';
 if(is_file($manifest))$html=preg_replace("~(/noa-manifest[.]json)(?:[?][^\"']*)?~i",'$1?v='.hash_file('sha256',$manifest),$html);
 return $html;
}
function noa_design_assets(){
 global $config;
 $path=parse_url($_SERVER['REQUEST_URI']??'',PHP_URL_PATH);
 if(!is_string($path))return;
 $launch=dirname(__DIR__).'/noa-launch.js';$ainoa=is_file($launch)?'<script src="/noa-launch.js?v='.hash_file('sha256',$launch).'"></script>':'';
 $voice=dirname(__DIR__).'/noa-voice.js';if(is_file($voice))$ainoa.='<script src="/noa-voice.js?v='.hash_file('sha256',$voice).'"></script>';
 foreach(['css','js'] as $kind){$asset=dirname(__DIR__).'/noa-ainoa.'.$kind;if(is_file($asset)){$url='/noa-ainoa.'.$kind.'?v='.hash_file('sha256',$asset);$ainoa.=$kind==='css'?'<link rel="stylesheet" href="'.$url.'">':'<script src="'.$url.'" defer></script>';}}
 foreach(['css','js']as $kind){$file=dirname(__DIR__).'/noa-install.'.$kind;if(is_file($file)){$url='/noa-install.'.$kind.'?v='.hash_file('sha256',$file);$ainoa.=$kind==='css'?'<link rel="stylesheet" href="'.$url.'">':'<script src="'.$url.'"></script>';}}
 $ainoa.='<meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="NOA STUDIO"><link rel="apple-touch-icon" href="/noa-assets/icon-180.png?v=original-symbol-1">';
 $starlight_file=dirname(__DIR__).'/noa-starlight.css';
 $starlight=is_file($starlight_file)?'<meta name="color-scheme" content="dark"><link rel="stylesheet" href="/noa-starlight.css?v='.hash_file('sha256',$starlight_file).'">':'';
 $native=preg_match('~^/(?:bbs|adm)/~',$path);
 $workspace=preg_match('~^/noa-app/(?:database|taxonomy|jukebox)/(?:index[.]php)?$~',$path);
 $public=in_array($path,['/','/index.php'],true)||preg_match('~^/noa-(?:music|youtube|world|my|settings|sitemap|notifications|catalog|ai-lab|library|editor|download|install|theme-admin|creator|channel|subscription|login|membership|quality)(?:-admin)?[.]php$~',$path);
 // All application HTML pages share the same voice; JSON responses are untouched.
 $public=$public||(bool)preg_match('~^/noa-[a-z0-9-]+[.]php$~D',$path);
 if(!$native&&!$workspace&&!$public)return;
 if(!$native&&($_SERVER['REQUEST_METHOD']??'GET')!=='GET')return;
 // MY stays in primary navigation; AInoa keeps its existing floating control.
 // Standalone views do not call GnuBoard html_end(); inject only completed HTML.
 if(!$native){
  $assets=$ainoa.'<link rel="stylesheet" href="/noa-policy-20261024.css?v=20261024-approved-ui">';
  if($workspace){
   if(!str_starts_with($path,'/noa-app/jukebox/'))$assets=$ainoa.'<link rel="stylesheet" href="/noa-ui.css?v=20261022-recovery2">'.$assets;
   $assets.='<script src="/noa-ui.js?v=20261024-approved-ui" data-noa-theme-only defer></script>';
  }
  ob_start(static function($html)use($assets,$path,$starlight){
   if(http_response_code()>=300||stripos($html,'</head>')===false)return $html;
   $html=noa_policy_script_revision($html);
   if(in_array($path,['/noa-youtube.php','/noa-music.php'],true)&&!str_contains($html,'data-noa-community=')){
    $board=$path==='/noa-music.php'?'song_request':'free';$id=$board==='song_request'?'noa-song-requests':'noa-free-board';$title=$board==='song_request'?'사연곡 신청':'자유게시판';
    $widget='<section id="'.$id.'" class="noa-section noa-community" data-noa-community="'.$board.'" aria-label="'.$title.'"><h2>'.$title.'</h2><p role="status">게시글을 불러오는 중입니다.</p></section>';
    $html=str_ireplace('</main>',$widget.'</main>',$html);
    foreach(['css','js']as $kind){$file=dirname(__DIR__).'/noa-community.'.$kind;if(is_file($file)){$url='/noa-community.'.$kind.'?v='.hash_file('sha256',$file);$assets.=$kind==='css'?'<link rel="stylesheet" href="'.$url.'">':'<script src="'.$url.'" defer></script>';}}
   }
   
   if(!empty($GLOBALS['is_member'])&&($GLOBALS['is_admin']??'')==='super'&&is_file(dirname(__DIR__).'/noa-workspace.php')){
    require_once dirname(__DIR__).'/noa-workspace.php';$help=null;foreach(noa_workspace_groups() as $group)foreach($group['routes'] as $route)if(parse_url($route[3],PHP_URL_PATH)===$path&&!str_contains($route[3],'#')&&!str_contains($route[3],'?'))$help=$route;
    if($help&&!in_array($path,['/noa-library.php','/noa-music.php','/noa-youtube.php'],true)){$guide='<aside class="noa-workspace-guide"><a href="/noa-library.php">← 최고관리자 작업실</a><p>'.htmlspecialchars($help[2],ENT_QUOTES,'UTF-8').'</p></aside>';$html=preg_replace('~(<main\b[^>]*>)~i','$1'.$guide,$html,1);}
   }
   return str_ireplace('</head>',$assets.$starlight.'</head>',$html);
  });
  return;
 }
 add_javascript($ainoa,1001);
 if($starlight!=='')add_stylesheet($starlight,1100);
 // Native skins use GnuBoard's ordered asset registration.
 if(!str_starts_with($path,'/adm/'))add_stylesheet('<link rel="stylesheet" href="/noa-policy-20261024.css?v=20261024-approved-ui">',999);
 $config['cf_title']='NOA STUDIO';
 // The core admin uses light panels; consumer theme tokens must not leak into it.
 if(str_starts_with($path,'/adm/')){
  add_javascript('<script src="/noa-brand.js?v=20261021-brand1" defer></script>',99);
  add_stylesheet('<link rel="stylesheet" href="/noa-admin.css?v='.hash_file('sha256',dirname(__DIR__).'/noa-admin.css').'">',99);
  return;
 }
 // Native skin colors follow the selected palette; version the actual deployed CSS.
 $skin_css=dirname(__DIR__).'/noa-gnuboard.css';
 if(is_file($skin_css))add_stylesheet('<link rel="stylesheet" href="/noa-gnuboard.css?v='.hash_file('sha256',$skin_css).'">',1000);
 add_stylesheet('<link rel="stylesheet" href="/noa-ui.css?v=20261022-recovery2">',99);
 // Keep registration identical to theme/head.php for GnuBoard asset deduplication.
 add_javascript('<script src="/noa-brand.js?v=20261021-brand1" defer></script><script src="/noa-ui.js?v=20261022-recovery1" defer></script>',99);
}
if(function_exists('add_event'))add_event('common_header','noa_design_assets',10,0);
if(function_exists('add_replace'))add_replace('html_process_buffer',static function($html){
 $path=parse_url($_SERVER['REQUEST_URI']??'',PHP_URL_PATH);
 return is_string($path)&&preg_match('~^/(bbs|adm)/~',$path)?noa_policy_script_revision($html):$html;
},10,1);
