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
 check(count(array_filter($admin['admin']['routes'],fn($r)=>$r[3]==='/noa-library.php'))===1 && $admin['admin']['title']==='홈페이지 설정','one administrator workspace root');
 check(count($admin['admin']['routes'])>10,'administrator specialists are discoverable in the tree');
 check(isset($admin['creator_lab'],$admin['ai_lab']),'creator workspaces are top-level branches');
 check(!in_array('channelWorkspace',array_column($admin['account']['routes'],0),true)&&!in_array('aiLab',array_column($admin['account']['routes'],0),true),'workspaces are not buried in account services');
 require_once dirname(__DIR__,2).'/deploy/noa-workspace.php';
 $adminModules=[];foreach(noa_workspace_groups() as $g)foreach($g['routes'] as $route){check($route[5]==='admin','administrator module scope');$adminModules[]=$route[0];}
 foreach(['popularity','workStatus','payments','subscriptions'] as $id)check(in_array($id,$adminModules,true),'specialist remains reachable from homepage settings');
 ob_start();noa_workspace_render();$workspace=ob_get_clean();check(substr_count($workspace,'class="noa-workspace-grid"')===3,'three focused administrator groups');
 check(!str_contains($workspace,'/noa-catalog.php')&&str_contains($workspace,'크리에이터 가입 심사'),'content belongs to CREATOR LAB');
 check(!isset($admin['admin-content'],$admin['admin-creation']),'global directory does not duplicate specialist menus');
 check(in_array('points',$ids($guest),true),'point packs remain public');
 check(in_array('store',$ids($guest),true)&&in_array('store',$ids($member),true)&&in_array('store',$ids($admin),true),'store available to every audience');
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
 $groups=noa_sitemap_visible_groups($root,'guest',[$board],['privacy']);check(in_array('board-free',$ids($groups),true)&&in_array('privacy-page',$ids($groups),true)&&!in_array('legal-privacy',$ids($groups),true),'native privacy alias must not duplicate the current privacy page');
 foreach([$guest,$member,$admin,$groups] as $list){$destinations=[];foreach($list as $g)foreach($g['routes'] as $r)$destinations[]=noa_sitemap_destination($r[3]);check(count($destinations)===count(array_unique($destinations)),'duplicate function across categories');}
 check(noa_sitemap_destination('/noa-music.php?group=original')!==noa_sitemap_destination('/noa-music.php?group=ep'),'different music collections remain separate');
 check(noa_sitemap_destination('/noa-ai-lab.php')!==noa_sitemap_destination('/noa-ai-lab.php#settings'),'separate settings anchor remains available');
 check(noa_sitemap_destination('/noa-lounge.php?category=story&view=list#ec-content')===noa_sitemap_destination('/noa-lounge.php?board=song_request#ec-content'),'story request aliases share one entry');
 unlink($root.'/noa-privacy.php');$fallback=noa_sitemap_visible_groups($root,'guest',[],['privacy']);check(in_array('legal-privacy',$ids($fallback),true),'available native route must survive when modern page is unavailable');file_put_contents($root.'/noa-privacy.php','<?php ');
 check(!in_array('board-free',$ids($guest),true)&&!isset($guest['legal']),'unknown native records not fabricated');
 file_put_contents($root.'/noa-new-feature.php','<?php ?><!doctype html><html lang="ko">');
 file_put_contents($root.'/noa-sample-api.php','<?php header("Content-Type: application/json");');
 check(noa_sitemap_unlisted_pages($root)===['/noa-new-feature.php'],'new UI screens require an explicit registry and audience decision');
 check(noa_sitemap_unlisted_pages(dirname(__DIR__,2).'/deploy')===[],'repository screen coverage');
  $locked=noa_sitemap_visible_groups($root,'member',[array_replace($board,['noa_condition'=>'이용 그룹 승인이 필요해요.'])]);check(array_values(array_filter($locked['community']['routes'],fn($r)=>$r[0]==='board-free'))[0][6]==='이용 그룹 승인이 필요해요.','native board condition retained without a navigable link');
 echo "NOA_SITEMAP_ROLE_RUNTIME_PATH_AND_NATIVE_PERMISSION_OK\n";
}finally{
 $iterator=new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root,FilesystemIterator::SKIP_DOTS),RecursiveIteratorIterator::CHILD_FIRST);
 foreach($iterator as $file){if($file->isDir())rmdir($file->getPathname());else unlink($file->getPathname());}rmdir($root);
}

