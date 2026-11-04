<?php
declare(strict_types=1);
// Exercise the actual capability and sitemap rules with disposable members and screen files.
define('NOA_SITEMAP_REGISTRY_ONLY',true);
require dirname(__DIR__,2).'/deploy/noa-sitemap.php';
require dirname(__DIR__,2).'/bridge/member-access.php';
require dirname(__DIR__,2).'/bridge/subscription-access.php';
$out=$argv[1];$root=$out.'/drawer-root';
if(!is_dir($root))mkdir($root,0700,true);
foreach(noa_sitemap_registry() as $group)foreach($group['routes'] as $row){
    $path=ltrim(parse_url($row[3],PHP_URL_PATH),'/');
    if($path===''||str_ends_with($path,'/'))$path.='index.php';
    if(!is_dir(dirname($root.'/'.$path)))mkdir(dirname($root.'/'.$path),0700,true);
    touch($root.'/'.$path);
}
function must(bool $ok,string $why):void{if(!$ok)throw new RuntimeException($why);}
$esc=static fn($v)=>htmlspecialchars((string)$v,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');
foreach(['guest'=>1,'member'=>3,'admin'=>10,'two'=>2,'four'=>4,'five'=>5,'six'=>6,'seven'=>7,'eight'=>8,'nine'=>9,'numeric-ten'=>10] as $role=>$level){
    $super=$role==='admin';$member=$level>1?['mb_id'=>'fixture','mb_level'=>$level]:[];
    $access=nam_access($member,$super?'super':'');$GLOBALS['noa_access']=$access;
    $board=['bo_table'=>'fixture_board','bo_subject'=>'전용 게시판','bo_list_level'=>4,'bo_read_level'=>5,'gr_use_access'=>1,'group_allowed'=>$role==='five','bo_use_cert'=>''];
    $board['noa_condition']=noa_sitemap_board_allowed($board,$level,!!$member,$super,$member)?'':'이용 조건 미충족';
    $boards=[$board];$groups=noa_sitemap_visible_groups($root,noa_sitemap_role(!!$member,$super?'super':''),$boards);
    $groups=noa_sitemap_member_directory($groups,$access,$boards);$labels=[];$html='<main data-noa-member-directory>';
    foreach($groups as $id=>$group){
        must((bool)$group['routes'],'empty category');
        $html.='<section class="noa-site-map"><h2 id="map-'.$esc($id).'">'.$esc($group['title']).'</h2>';
        foreach($group['routes'] as $r){
            must($r[6]==='','denied route returned');$labels[$r[0]]=$r[7];
            $html.='<a class="noa-site-map-link" data-noa-route="'.$esc($r[0]).'" href="'.$esc($r[3]).'" data-noa-access-label="'.$esc($r[7]).'"><strong>'.$esc($r[1]).'</strong><small>'.$esc($r[2]).'</small></a>';
        }
        $html.='</section>';
    }
    foreach(['creatorApply'=>$level<=4,'storyRequest'=>$access['write'],'my'=>$level>=2,'weatherCare'=>in_array($level,[4,5,6,8,9,10],true),'catalog'=>$access['music'],'playlists'=>$access['music'],'creator'=>$access['creator'],'creatorAI'=>$access['creatorAI'],'libraryAdmin'=>$super,'login'=>!$member,'board-fixture_board'=>$super||$role==='five'] as $id=>$allowed){
        must(array_key_exists($id,$labels)===$allowed,$role.' '.$id);
        if($allowed)must($labels[$id]!=='',$role.' unlabeled '.$id);
    }
    must($labels['home']==='','public home must not carry a level');
    if(isset($labels['board-fixture_board']))must($labels['board-fixture_board']==='Lv.5 이상 · 그룹 승인','board restrictions');
    if(isset($labels['weatherCare']))must($labels['weatherCare']==='Lv.4·5·6·8·9·10','weather levels');
    if(isset($labels['creatorAI']))must($labels['creatorAI']==='Lv.8 / 최고관리자','creator AI levels');
    if(in_array($role,['guest','member','admin'],true)){
        file_put_contents($out.'/drawer-'.$role.'.html',$html.'</main>');
        file_put_contents($out.'/drawer-'.$role.'-access.json',json_encode($access,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR));
    }
}
foreach([3=>4,7=>8] as $base=>$paid){
    $now=time();$grant=['baseLevel'=>$base,'status'=>'active','until'=>$now];$effective=ns_effective_level($paid,$grant,$now);
    must($effective===$base&&!nam_access(['mb_id'=>'expired','mb_level'=>$effective])['weatherVip'],'expired VIP remains visible');
}
echo "DRAWER_ACCESS_OK levels 1-10, administrator identity, board conditions and expired grants\n";
