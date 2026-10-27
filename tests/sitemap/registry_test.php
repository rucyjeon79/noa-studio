<?php
declare(strict_types=1);
define('NOA_SITEMAP_REGISTRY_ONLY',true);
require dirname(__DIR__,2).'/deploy/noa-sitemap.php';
function check(bool $ok,string $message):void{if(!$ok)throw new RuntimeException($message);}
$root=sys_get_temp_dir().'/noa-sitemap-'.bin2hex(random_bytes(8));mkdir($root,0700);
$created=[];
try{
 foreach(noa_sitemap_registry() as $group)foreach($group['routes'] as $route){
  $path=parse_url($route[3],PHP_URL_PATH);$relative=ltrim($path,'/');if($relative===''||str_ends_with($relative,'/'))$relative.='index.php';
  $full=$root.'/'.$relative;if(!is_dir(dirname($full)))mkdir(dirname($full),0700,true);file_put_contents($full,'<?php ');$created[]=$full;
 }
 foreach(['bbs/board.php','bbs/content.php'] as $relative){$full=$root.'/'.$relative;file_put_contents($full,'<?php ');$created[]=$full;}
 $ids=static function(array $groups):array{return array_merge(...array_map(static fn($g)=>array_column(array_filter($g['routes'],static fn($r)=>empty($r[6])),0),array_values($groups)));};
 $guest=noa_sitemap_visible_groups($root,'guest');$member=noa_sitemap_visible_groups($root,'member');$admin=noa_sitemap_visible_groups($root,'admin');
 check(isset($guest['admin'],$member['admin'])&&$guest['admin']['routes'][0][6]!==''&&$member['admin']['routes'][0][6]!=='','administrator routes visible but disabled with conditions');
 check(in_array('popularity',$ids($admin),true)&&!in_array('popularity',$ids($guest),true)&&!in_array('popularity',$ids($member),true),'actual popularity service is administrator-only');
 check(isset($admin['admin-content'],$admin['admin-creation'],$admin['admin-operation'],$admin['admin-advanced'])&&count($admin['admin']['routes'])===1,'administrator task groups and single workspace entry included');
 foreach(noa_workspace_groups() as $g)check(is_string($g['intro']??null)&&count($g['routes'])>0,'task group description and destinations required');
 ob_start();noa_workspace_render();$workspace=ob_get_clean();check(substr_count($workspace,'class="noa-workspace-grid"')===4,'all administrator sections render');
 check(!isset($guest['admin-content'])&&!isset($member['admin-content']),'task groups are administrator-only');
 check(in_array('workStatus',$ids($admin),true)&&!in_array('workStatus',$ids($member),true)&&!in_array('workStatus',$ids($guest),true),'work journal highest-admin-only');
 check(in_array('subscriptions',$ids($admin),true)&&!in_array('subscriptions',$ids($member),true)&&!in_array('subscriptions',$ids($guest),true),'subscription configuration highest-admin-only');
 check(!in_array('register',$ids($guest),true),'no duplicate signup button; social enrollment stays in the login screen');
 check(in_array('login',$ids($guest),true)&&!in_array('playlists',$ids($guest),true),'guest account destinations');
 check(in_array('playlists',$ids($member),true)&&!in_array('login',$ids($member),true),'member playlist destination');
 $adminLinks=array_merge(...array_map(static fn($g)=>array_column($g['routes'],3),array_values($admin)));
 check(array_diff(['/noa-music.php','/noa-youtube.php','/noa-music.php#my-playlists','/noa-world.php','/noa-ai-lab.php','/noa-my.php'],$adminLinks)===[],'all six previously unshipped HOME destinations carried into the complete map');
 check(noa_sitemap_role(false,'super')==='guest'&&noa_sitemap_role(true,'group')==='member','server member state required for super role');
 check(!in_array('aiLab',$ids($guest),true)&&in_array('aiLab',$ids($admin),true),'AI LAB remains administrator-only');
 foreach($admin as $g)foreach($g['routes'] as $r)check(!str_contains($r[3],'logout.php')&&!str_contains($r[3],'noa2.php')&&!str_contains($r[3],'deploy-center'),'no actions, legacy home or unverified deploy center');
 unlink($root.'/noa-install.php');check(!in_array('download',$ids(noa_sitemap_visible_groups($root,'guest')),true),'missing runtime page hidden');
 check(!noa_sitemap_available('/../outside.php',$root)&&!noa_sitemap_available('https://example.com/page.php',$root),'only fixed local service paths');
 $outside=$root.'-outside.php';file_put_contents($outside,'<?php ');symlink($outside,$root.'/outside.php');check(!noa_sitemap_available('/outside.php',$root),'outside-root symlink hidden');unlink($root.'/outside.php');unlink($outside);
 $board=['bo_table'=>'free','bo_subject'=>'<b>자유게시판</b>','bo_read_level'=>1,'bo_list_level'=>1,'gr_use_access'=>0,'bo_use_cert'=>''];
 check(noa_sitemap_board_allowed($board,1,false,false),'public board readable');
 check(noa_sitemap_board_allowed(array_replace($board,['bo_use_cert'=>'0']),1,false,false),'native false certification setting remains public');
 check(noa_sitemap_board_allowed($board+['group_allowed'=>false],1,false,false),'public board ignores absent membership');
 $private=array_replace($board,['bo_read_level'=>2]);check(!noa_sitemap_board_allowed($private,1,false,false)&&noa_sitemap_board_allowed($private,2,true,false),'board read levels');
 $private=array_replace($board,['gr_use_access'=>1]);check(!noa_sitemap_board_allowed($private,10,true,false)&&noa_sitemap_board_allowed($private+['group_allowed'=>true],2,true,false),'restricted board group membership');
 $cert=array_replace($board,['bo_use_cert'=>'hp-adult']);check(!noa_sitemap_board_allowed($cert,2,true,false,['mb_certify'=>'ipin','mb_adult'=>1])&&noa_sitemap_board_allowed($cert,2,true,false,['mb_certify'=>'hp','mb_adult'=>1]),'native certification preserved');
 check(!noa_sitemap_board_allowed(array_replace($board,['bo_table'=>'../../secret']),10,true,true),'invalid board identifiers rejected');
 $groups=noa_sitemap_visible_groups($root,'guest',[$board],['privacy']);check(in_array('board-free',$ids($groups),true)&&in_array('legal-privacy',$ids($groups),true)&&!in_array('legal-provision',$ids($groups),true),'only existing readable board/content rows');
 check(!in_array('board-free',$ids($guest),true)&&!isset($guest['legal']),'unknown native records not fabricated');
 file_put_contents($root.'/noa-new-feature.php','<?php ?><!doctype html><html lang="ko">');
 file_put_contents($root.'/noa-sample-api.php','<?php header("Content-Type: application/json");');
 check(noa_sitemap_unlisted_pages($root)===['/noa-new-feature.php'],'new UI screens require an explicit registry and audience decision');
 check(noa_sitemap_unlisted_pages(dirname(__DIR__,2).'/deploy')===[],'repository screen coverage');
  $locked=noa_sitemap_visible_groups($root,'member',[array_replace($board,['noa_condition'=>'이용 그룹 승인이 필요해요.'])]);check($locked['community']['routes'][1][6]==='이용 그룹 승인이 필요해요.','native board condition retained without a navigable link');
 echo "NOA_SITEMAP_ROLE_RUNTIME_PATH_AND_NATIVE_PERMISSION_OK\n";
}finally{
 $iterator=new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root,FilesystemIterator::SKIP_DOTS),RecursiveIteratorIterator::CHILD_FIRST);
 foreach($iterator as $file){if($file->isDir())rmdir($file->getPathname());else unlink($file->getPathname());}rmdir($root);
}

