<?php
/** Delegate behavior to the installed GnuBoard skins; only NOA presentation is shared. */
if(!defined('_GNUBOARD_'))exit;
if(!isset($noa_skin_family,$noa_skin_file)||!in_array($noa_skin_family,['board','member','latest','search'],true)||!preg_match('/^[a-z_]+[.]skin[.]php$/D',$noa_skin_file))return;
$noa_core_skin=G5_SKIN_PATH.'/'.$noa_skin_family.'/basic';$noa_core_url=G5_SKIN_URL.'/'.$noa_skin_family.'/basic';
if(G5_IS_MOBILE&&is_file(G5_MOBILE_PATH.'/skin/'.$noa_skin_family.'/basic/'.$noa_skin_file)){
 $noa_core_skin=G5_MOBILE_PATH.'/skin/'.$noa_skin_family.'/basic';$noa_core_url=G5_MOBILE_URL.'/skin/'.$noa_skin_family.'/basic';
}
if(!is_file($noa_core_skin.'/'.$noa_skin_file)){echo '<p class="noa-empty">설치된 기본 스킨에서 이 화면을 지원하지 않습니다.</p>';return;}
${$noa_skin_family.'_skin_path'}=$noa_core_skin;${$noa_skin_family.'_skin_url'}=$noa_core_url;
add_stylesheet('<link rel="stylesheet" href="/noa-ui.css">',99);
include $noa_core_skin.'/'.$noa_skin_file;
unset($noa_skin_family,$noa_skin_file,$noa_core_skin,$noa_core_url);
