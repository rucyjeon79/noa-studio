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
        $last=-1;$ranks=[];
        foreach($group['routes'] as $r){
            must($r[6]==='','denied route returned');$labels[$r[0]]=$r[7];
            must($r[8]>=$last,'higher requirement must follow lower requirements in '.$id);$last=$r[8];$ranks[$r[0]]=$r[8];
            if($r[7]!==''){
                $badge=noa_sitemap_access_icon($r[8],$r[7]);
                must(str_contains($badge,'role="img"')&&str_contains($badge,'aria-label="'.$esc($r[7]).'"'),'icon needs accessible restrictions');
                must(trim(strip_tags($badge))==='','grade badge must be an icon, not text');
            }
            $html.='<a class="noa-site-map-link" data-noa-route="'.$esc($r[0]).'" href="'.$esc($r[3]).'" data-noa-access-label="'.$esc($r[7]).'" data-noa-access-rank="'.$r[8].'"><strong>'.$esc($r[1]).'</strong>'.noa_sitemap_access_icon($r[8],$r[7]).'<small>'.$esc($r[2]).'</small></a>';
        }
        $original=array_values(array_filter(noa_sitemap_registry()[$id]['routes']??[],fn($r)=>isset($ranks[$r[0]])));
        foreach(array_unique($ranks) as $rank){
            $before=array_column(array_values(array_filter($original,fn($r)=>$ranks[$r[0]]===$rank)),0);
            $after=array_values(array_filter(array_keys($ranks),fn($key)=>$ranks[$key]===$rank&&!str_starts_with($key,'board-')));
            if($original)must($before===$after,'same-grade routes changed order');
        }
        if($id==='collections'&&isset($ranks['weatherCare']))must(array_key_last($ranks)==='weatherCare','VIP weather must be below the other music entries');
        if($id==='account'&&isset($ranks['creatorAI']))must(array_key_last($ranks)==='creatorAI','AI creation must be below member and creator entries');
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
    if(in_array($role,['guest','member','eight','admin'],true)){
        file_put_contents($out.'/drawer-'.$role.'.html',$html.'</main>');
        file_put_contents($out.'/drawer-'.$role.'-access.json',json_encode($access,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR));
    }
}
// A lower read requirement on the native request board must not erase the write grade.
$request=['bo_table'=>'song_request','bo_list_level'=>1,'bo_read_level'=>1,'bo_use_cert'=>'','gr_use_access'=>0];
$access=nam_access(['mb_id'=>'writer','mb_level'=>3]);$GLOBALS['noa_access']=$access;
$groups=noa_sitemap_member_directory(noa_sitemap_visible_groups($root,'member',[$request]),$access,[$request]);
$requestRows=array_column($groups['collections']['routes'],null,0);
must($requestRows['storyRequest'][8]===3&&$requestRows['storyRequest'][7]==='Lv.3 이상','request write grade lost');
foreach([3=>4,7=>8] as $base=>$paid){
    $now=time();$grant=['baseLevel'=>$base,'status'=>'active','until'=>$now];$effective=ns_effective_level($paid,$grant,$now);
    must($effective===$base&&!nam_access(['mb_id'=>'expired','mb_level'=>$effective])['weatherVip'],'expired VIP remains visible');
}
echo "DRAWER_ACCESS_OK levels 1-10, stable grade order, icon-only badges, board conditions and expired grants\n";
