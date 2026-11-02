<?php
declare(strict_types=1);

/** Role-aware navigation for the existing application. No database writes. */
function noa_sitemap_registry():array{
    return [
        'explore'=>['title'=>'NOA STUDIO','routes'=>[
            ['home','홈','추천 음악과 최신 소식','/','home','public'],
            ['youtube','YouTube','음악 영상과 컬렉션','/noa-youtube.php','youtube','public'],
            ['world','NOA WORLD','세계관과 공식 EP 뮤직비디오','/noa-world.php','book','public'],
            ['music','MUSIC','음원과 ACT 플레이리스트','/noa-music.php','music','public'],
            ['my','MY','최근 재생과 나의 음악','/noa-my.php','user','public'],
            ['catalog','통합 라이브러리','곡과 영상의 연결 정보','/noa-catalog.php','library','public'],
            ['settings','설정','테마와 언어','/noa-settings.php','settings','public'],
            ['download','앱 설치','iPhone · iPad · Android · PC','/noa-install.php','download','public'],
        ]],
        'collections'=>['title'=>'음악 탐색','routes'=>[
            ['original','오리지널송','K-POP · J-POP · POP · Thai','/noa-music.php?group=original','disc','public'],
            ['ep','EP 컬렉션','장르별 ACT와 EP 수록곡','/noa-music.php?group=ep','playlists','public'],
            ['story','당신의 이야기, 우리의 음악','사연을 담은 음악','/noa-music.php?group=story','mail','public'],
            ['cover','AInoa의 유명곡 커버','익숙한 노래의 새로운 목소리','/noa-music.php?group=cover','mic','public'],
        ]],
        'world'=>['title'=>'ACT 세계관','routes'=>[
            ['act1','ACT 1','사랑의 시작과 아픔 · EP.1–10','/noa-world.php?story=1','book','public'],
            ['act2','ACT 2','엇갈린 사랑의 상처 · EP.11–20','/noa-world.php?story=2','book','public'],
            ['act3','ACT 3','다시 빛을 향해 · EP.21–30','/noa-world.php?story=3','book','public'],
            ['act4','ACT 4','새로운 시작 · EP.31–40','/noa-world.php?story=4','book','public'],
        ]],
        'account'=>['title'=>'회원 서비스','routes'=>[
            ['login','로그인','기존 계정 또는 구글·카카오로 로그인','/noa-login.php','user','guest'],
            ['creatorApply','크리에이터 가입·전환','본인인증과 승인 후 7레벨·채널 개설','/noa-creator-apply.php','user','public'],
            ['channelWorkspace','내 채널 작업실','소유한 콘텐츠·게시판·제작 관리','/noa-channel-workspace.php','music','member'],
            ['channelRules','카테고리·제작 규칙','내 채널 장르별 제작 원칙','/noa-channel-rules.php','playlists','member'],
            ['creatorAI','채널 AI 제작실','8레벨 크레이터 VIP회원 · 최고 관리자','/noa-creator-ai.php','mic','member'],
            ['password','아이디·비밀번호 찾기','계정 접근 복구','/bbs/password_lost.php','settings','guest'],
            ['playlists','내 재생목록','나만의 목록 만들기와 편집','/noa-music.php#my-playlists','playlists','member'],
            ['subscription','월 구독 · 포인트','이용 기간과 구독 구매 내역','/noa-subscription.php','user','member'],
            ['giftBox','선물함','받은 선물 사용·연장 및 보낸 선물 현황','/noa-gifts.php','user','member'],
            ['vipStore','VIP 이용권','별무리·크레이터 30일·365일 이용권','/noa-vip.php','user','public'],
            ['points','포인트권 구매','카드·카카오페이 · 10,000P부터 10% 추가','/noa-points.php','user','public'],
            ['membership','포인트 · VIP 이용권','포인트 잔액·적립·이용 기간 확인','/noa-membership.php','user','member'],
            ['support','받은 후원 · 정산','후원 내역과 개인·사업자 정산 신청','/noa-support.php','user','member'],
            ['creator','내 채널 · 음원','내 채널과 업로드한 음악 관리','/noa-creator.php','music','member'],
            ['profile','회원정보','내 계정 정보 확인과 수정','/bbs/member_confirm.php?url=register_form.php','user','member'],
            ['notifications','내 활동 알림','AInoa의 소식과 알림 설정','/noa-notifications.php','mail','member'],
        ]],
        'community'=>['title'=>'커뮤니티·창작·SHOP','routes'=>[
            ['shop','NOA SHOP','굿즈 탐색·찜·공식 구매','/noa-shop.php','disc','public'],
            ['lounge','별무리 라운지','음악과 일상을 나누는 팬 커뮤니티','/noa-lounge.php','community','public'],
            ['creatorLab','CREATOR LAB','피드백·작품 성장 기록·협업','/noa-creator-lab.php','mic','public'],
            ['search','게시판 검색','공개된 게시글 찾기','/bbs/search.php','search','public'],
        ]],
        'creatorTools'=>['title'=>'내 채널 · 전문 제작 도구','routes'=>[['taxonomy','공통 카테고리·제작 규칙','최고관리자의 공통 분류 기준','/noa-app/taxonomy/','playlists','admin']]],
        'company'=>['title'=>'제이알 · 서비스 안내','routes'=>[
            ['about-jr','회사소개 · 제이알','람준파파·NOA·NOEL·별무리의 이야기','/noa-about.php','book','public'],
            ['privacy-page','개인정보처리방침','내 정보와 권리 안내','/noa-privacy.php','book','public'],
            ['terms-page','이용약관','함께 지키는 서비스 이용 약속','/noa-terms.php','book','public'],
        ]],
        'legal'=>['title'=>'기존 서비스 안내','routes'=>[]],
        'admin'=>['title'=>'홈페이지 관리','routes'=>[
            ['libraryAdmin','라이브러리 관리','음악 문서와 변경 이력','/noa-library.php','library','admin'],
            ['editor','음악 등록·편집','음악 문서 작성','/noa-editor.php','edit','admin'],
            ['categoryOrder','사연곡·커버곡 순서','드래그 정렬과 순서 저장','/noa-category-order-admin.php','playlists','admin'],
            ['jukebox','JUKEBOX','음원 업로드와 처리 대기열','/noa-app/jukebox/','music','admin'],
            ['quality','곡정보 검사·정리','전체 검사와 중복·충돌 조치','/noa-quality.php','settings','admin'],
            ['catalogAdmin','원본 가져오기·통합 등록','이전 원본 수집과 등록','/noa-catalog-admin.php','library','admin'],
            ['recovery','원본 복구','보존된 원본과 복구 상태','/noa-recovery.php','book','admin'],
            ['youtubeAdmin','YouTube 관리','채널 수집과 분류 검토','/noa-youtube-admin.php','youtube','admin'],
            ['workStatus','N80 작업 현황','지시·단계·운영 검증 기록','/noa-work-status.php','settings','admin'],
            ['aiLab','AI LAB','영상 제작과 채널 성장','/noa-ai-lab.php','mic','admin'],
            ['themeAdmin','테마 정책','디자인 설정과 변경 이력','/noa-theme-admin.php','settings','admin'],
            ['database','데이터베이스 관리','운영 데이터 현황','/noa-app/database/','library','admin'],
            ['popularity','인기순위 관리','집계 상태와 유효 재생 정책','/noa-app/popularity/','playlists','admin'],
            ['payments','토스 결제 연결','카드·카카오페이 연결과 테스트·운영 설정','/noa-payment-settings.php','settings','admin'],
            ['kcpTest','KCP 테스트 연결','관리자용 카드 결제창 호출·복귀 테스트','/noa-kcp-test.php','settings','admin'],
            ['subscriptions','월 구독 설정','요금·포인트·결제 내역 확인','/noa-subscription-admin.php','settings','admin'],
            ['creatorReview','크리에이터 가입 심사','본인인증·신청 검토와 승인','/noa-creator-review.php','user','admin'],
            ['members','회원 관리','그누보드 회원 서비스','/adm/member_list.php','user','admin'],
            ['boards','게시판 관리','그누보드 게시판 서비스','/adm/board_list.php','community','admin'],
            ['system','시스템 설정','그누보드 기본 설정','/adm/config_form.php','settings','admin'],
            ['nativeTheme','그누보드 테마','게시판 기반 테마 관리','/adm/theme.php','settings','admin'],
        ]],
    ];
}

function noa_sitemap_available(string $href,string $root):bool{
    $parts=parse_url($href);
    if($parts===false||isset($parts['scheme'])||isset($parts['host']))return false;
    $path=$parts['path']??'';
    if($path===''||$path[0]!=='/'||str_contains($path,'..')||str_contains($path,"\0"))return false;
    $base=realpath($root);
    if($base===false)return false;
    $relative=ltrim($path,'/');
    if($relative===''||str_ends_with($relative,'/'))$relative.='index.php';
    if(!str_ends_with($relative,'.php'))return false;
    $actual=realpath($base.'/'.$relative);
    return $actual!==false&&str_starts_with($actual,$base.'/')&&is_file($actual)&&is_readable($actual);
}

function noa_sitemap_role(bool $member,string $admin):string{
    return $member?($admin==='super'?'admin':'member'):'guest';
}

/** Audit-only coverage check: new screen files need an explicit audience decision. */
function noa_sitemap_unlisted_pages(string $root):array{
    // The deploy center has no verified production release yet and stays undiscoverable.
    $known=['/noa-sitemap.php'=>true,'/noa-deploy-center.php'=>true,'/noa-channel.php'=>true,'/noa-music-download.php'=>true,'/noa-download.php'=>true]; // Download is reached through the installation page; channel URLs require an owner ID.
    foreach(noa_sitemap_registry() as $group)foreach($group['routes'] as $route)$known[(string)parse_url($route[3],PHP_URL_PATH)]=true;
    $missing=[];
    foreach(glob(rtrim($root,'/').'/noa-*.php')?:[] as $file){
        $path='/'.basename($file);
        if(isset($known[$path])||str_ends_with($path,'.extend.php')||!noa_sitemap_available($path,$root))continue;
        $source=file_get_contents($file);
        if(is_string($source)&&preg_match('/<!doctype\s+html|<html\b/i',$source))$missing[]=$path;
    }
    sort($missing);
    return $missing;
}

function noa_sitemap_board_allowed(array $board,int $level,bool $member,bool $super,array $account=[]):bool{
    if(!preg_match('/^[A-Za-z0-9_]{1,20}$/D',(string)($board['bo_table']??'')))return false;
    if($super)return true;
    if(max((int)($board['bo_read_level']??10),(int)($board['bo_list_level']??10))>$level)return false;
    if(!empty($board['gr_use_access'])&&(!$member||empty($board['group_allowed'])))return false;
    $cert=(string)($board['bo_use_cert']??'');
    if($cert&&(!$member||empty($account['mb_certify'])))return false;
    if(str_starts_with($cert,'hp-')&&($account['mb_certify']??'')!=='hp')return false;
    if(str_contains($cert,'adult')&&empty($account['mb_adult']))return false;
    return true;
}

function noa_sitemap_visible_groups(string $root,string $role,array $boards=[],array $contents=[]):array{
    $groups=noa_sitemap_registry();
    if($role==='admin'&&is_file(__DIR__.'/noa-workspace.php')){require_once __DIR__.'/noa-workspace.php';$groups['admin']=['title'=>'홈페이지 관리','routes'=>[['libraryAdmin','홈페이지 관리','회원·화면·시스템 운영','/noa-library.php','settings','admin']]];foreach(noa_workspace_groups() as $id=>$group){$groups['admin-'.$id]=['title'=>in_array($id,['content','creation'],true)?'내 채널 · '.$group['title']:$group['title'],'routes'=>array_map(fn($r)=>array_merge($r,['admin']),$group['routes'])];}}
    foreach($boards as $board){
        $id=(string)($board['bo_table']??'');
        if(!preg_match('/^[A-Za-z0-9_]{1,20}$/D',$id))continue;
        $label=trim(strip_tags((string)($board['bo_subject']??'')))?:$id;
        $groups['community']['routes'][]=['board-'.$id,$label,'게시판 읽기','/noa-lounge.php?board='.rawurlencode($id).'#ec-content','community','public',(string)($board['noa_condition']??'')];
    }
    foreach(['privacy'=>'개인정보처리방침','provision'=>'이용약관'] as $id=>$label){
        if(!in_array($id,$contents,true))continue;
        $groups['legal']['routes'][]=['legal-'.$id,$label,'서비스 운영 안내','/bbs/content.php?co_id='.$id,'book','public'];
    }
    foreach($groups as $name=>&$group){
        foreach($group['routes'] as &$route){
            $reason=(string)($route[6]??'');$audience=$route[5];
            if($audience==='admin'&&$role!=='admin')$reason='최고관리자 전용 작업실이에요. 관리자 계정으로 로그인해 주세요.';
            elseif($audience==='member'&&$role==='guest')$reason='로그인한 회원이 이용할 수 있어요. 먼저 로그인해 주세요.';
            elseif($audience==='guest'&&$role!=='guest')$reason='이미 로그인되어 있어요. 계정을 바꾸려면 MY에서 로그아웃해 주세요.';
            elseif(function_exists('nam_requirement')){
                parse_str((string)parse_url($route[3],PHP_URL_QUERY),$query);
                $need=nam_requirement(parse_url($route[3],PHP_URL_PATH)?:'/','GET',$query);
                if(!nam_allowed($GLOBALS['noa_access']??nam_access(),$need))$reason=match($need){'music'=>'음원은 이용 기간이 남은 VIP회원·VIP 크리에이터가 들을 수 있어요. MY에서 이용권을 확인해 주세요.','creator'=>'승인된 크리에이터의 채널 메뉴입니다. MY에서 전환 신청할 수 있어요.','creatorAI'=>'8레벨 크레이터 VIP회원 또는 최고 관리자만 이용할 수 있어요. 기능별 포인트 이용 조건을 확인해 주세요.','admin'=>'최고관리자 계정으로 로그인해 주세요.',default=>'로그인한 회원이 이용할 수 있어요. 먼저 로그인해 주세요.'};
            }
            if(!noa_sitemap_available($route[3],$root))$reason='아직 준비 중인 메뉴예요. 준비가 끝나면 이곳에서 열어드릴게요.';
            $route[6]=$reason;
        }
        unset($route);
        if(!$group['routes'])unset($groups[$name]);
    }
    unset($group);
    return $groups;
}

function noa_sitemap_native_content(array $g5,array $account,bool $member,bool $super):array{
    require_once __DIR__.'/noa-bridge/community-navigation.php';
    $boards=[];$contents=[];
    if(!function_exists('sql_query')||!function_exists('sql_fetch_array'))return [$boards,$contents];
    try{
        if(!empty($g5['board_table'])&&!empty($g5['group_table'])){
            $result=sql_query("SELECT b.bo_table,b.bo_subject,b.bo_read_level,b.bo_list_level,b.bo_use_cert,b.gr_id,g.gr_use_access FROM {$g5['board_table']} b LEFT JOIN {$g5['group_table']} g ON g.gr_id=b.gr_id ORDER BY b.bo_order,b.bo_table",false);
            while($result&&($board=sql_fetch_array($result))){
                if(!noa_community_board_visible((string)$board['bo_table'],(string)$board['bo_subject']))continue;
                $board['bo_subject']=noa_community_board_title((string)$board['bo_table'],(string)$board['bo_subject']);
                $board['group_allowed']=false;
                if(!empty($board['gr_use_access'])&&$member&&!empty($g5['group_member_table'])&&function_exists('sql_real_escape_string')){
                    $group=sql_real_escape_string((string)$board['gr_id']);$id=sql_real_escape_string((string)($account['mb_id']??''));
                    $access=sql_query("SELECT gr_id FROM {$g5['group_member_table']} WHERE gr_id='{$group}' AND mb_id='{$id}' LIMIT 1",false);
                    $board['group_allowed']=$access&&(bool)sql_fetch_array($access);
                }
                $allowed=noa_sitemap_board_allowed($board,$member?(int)($account['mb_level']??1):1,$member,$super,$account);
                if(!$allowed){
                    $level=max((int)$board['bo_read_level'],(int)$board['bo_list_level']);
                    $board['noa_condition']=!$member?'로그인 후 게시판 이용 자격을 확인해 주세요.':($level>(int)($account['mb_level']??1)?'이 게시판은 회원 '.$level.'레벨부터 이용할 수 있어요.':(!empty($board['gr_use_access'])&&empty($board['group_allowed'])?'이 게시판은 이용 그룹 승인이 필요해요. 관리자에게 이용 자격을 확인해 주세요.':(str_contains((string)$board['bo_use_cert'],'adult')?'본인 인증과 성인 확인을 마친 회원이 이용할 수 있어요.':'게시판에서 요구하는 본인 인증을 마친 뒤 이용해 주세요.')));
                }
                $boards[]=$board;
            }
        }
        if(!empty($g5['content_table'])){
            $result=sql_query("SELECT co_id FROM {$g5['content_table']} WHERE co_id IN ('privacy','provision')",false);
            while($result&&($content=sql_fetch_array($result)))$contents[]=(string)$content['co_id'];
        }
    }catch(Throwable $error){error_log('[noa-sitemap] '.get_class($error));}
    return [$boards,$contents];
}

function noa_sitemap_icon(string $name):string{
    // Reuse the exact existing NoaUI icon paths.
    $paths=[
        'home'=>'M3 10l9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z M9 21v-8h6v8',
        'music'=>'M9 18V5l12-2v13 M9 8l12-2 M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M18 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6',
        'youtube'=>'M3 5h18v14H3z M10 9l6 3-6 3z',
        'world'=>'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M3 12h18 M12 3c4 5 4 13 0 18-4-5-4-13 0-18',
        'community'=>'M21 11a8 8 0 0 1-8 8H5l-3 3V11a9 9 0 0 1 19 0',
        'library'=>'M4 3h4v18H4z M12 3h4v18h-4z M20 4l3 16',
        'settings'=>'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z',
        'user'=>'M20 21v-2a6 6 0 0 0-12 0v2 M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
        'book'=>'M12 5C8 2 4 3 2 4v16c4-2 7-1 10 1 3-2 6-3 10-1V4c-2-1-6-2-10 1z M12 5v16',
        'disc'=>'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
        'mail'=>'M3 5h18v14H3z M3 5l9 8 9-8',
        'mic'=>'M9 5a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0z M5 10v1a7 7 0 0 0 14 0v-1 M12 18v4 M8 22h8',
        'search'=>'M21 21l-4.35-4.35 M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
        'edit'=>'M16 3l5 5 M4 20l4-1L21 6l-4-4L4 15z',
        'download'=>'M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4',
        'playlists'=>'M4 6h16 M4 11h12 M4 16h8 M17 14l5 3-5 3z',
    ];
    $path=$paths[$name]??$paths['library'];
    return '<svg aria-hidden="true" focusable="false" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="'.$path.'"/></svg>';
}

if(defined('NOA_SITEMAP_REGISTRY_ONLY'))return;
require_once __DIR__.'/common.php';
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: private, no-store');
header('Vary: Cookie',false);
header('X-Content-Type-Options: nosniff');
if(!in_array($_SERVER['REQUEST_METHOD']??'GET',['GET','HEAD'],true)){header('Allow: GET, HEAD');http_response_code(405);exit;}
$logged=!empty($is_member)&&!empty($member['mb_id']);
$super=$logged&&($is_admin??'')==='super';
[$boards,$contents]=noa_sitemap_native_content($g5??[],$member??[],$logged,$super);
$groups=noa_sitemap_visible_groups(__DIR__,noa_sitemap_role($logged,(string)($is_admin??'')),$boards,$contents);
function noa_sitemap_escape(string $value):string{return htmlspecialchars($value,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');}
?><!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>전체 메뉴 | NOA STUDIO</title><link rel="stylesheet" href="/noa-ui.css?v=20261024-category-complete"><link rel="stylesheet" href="/noa-policy-20261024.css?v=20261024-approved-ui"><script src="/noa-brand.js?v=20261021-brand1" defer></script><script src="/noa-ui.js?v=20261024-approved-ui" defer></script></head><body class="noa-page"><main><h1>전체 메뉴</h1><p class="noa-muted">음악·커뮤니티·계정·관리 기능을 찾아 바로 이동하세요.</p>
<label class="noa-menu-search-label" for="noa-menu-search">메뉴 찾기</label><input id="noa-menu-search" type="search" placeholder="예: 사연, 포인트, 설정" autocomplete="off"><p id="noa-menu-results" role="status" aria-live="polite"></p>
<?php foreach($groups as $name=>$group):?><section class="noa-section noa-site-map" aria-labelledby="map-<?=noa_sitemap_escape($name)?>"><div class="noa-section-head"><h2 id="map-<?=noa_sitemap_escape($name)?>"><?=noa_sitemap_escape($group['title'])?></h2></div><nav class="noa-site-map-grid" aria-label="<?=noa_sitemap_escape($group['title'])?> 바로가기"><?php foreach($group['routes'] as $route):?><a class="noa-site-map-link" data-noa-route="<?=noa_sitemap_escape($route[0])?>" <?php if($route[6]):?>role="button" tabindex="0" aria-disabled="true" data-noa-condition="<?=noa_sitemap_escape($route[6])?>"<?php else:?>href="<?=noa_sitemap_escape($route[3])?>"<?php endif;?>><span aria-hidden="true"><?=noa_sitemap_icon($route[4])?></span><strong><?=noa_sitemap_escape($route[1])?></strong><small><?=noa_sitemap_escape($route[6]?:$route[2])?></small></a><?php endforeach;?></nav></section><?php endforeach;?>
</main><script>
(()=>{'use strict';const search=document.getElementById('noa-menu-search'),status=document.getElementById('noa-menu-results'),sections=[...document.querySelectorAll('.noa-site-map')];
search.addEventListener('input',()=>{const query=search.value.trim().toLocaleLowerCase();let count=0;for(const section of sections){let shown=0;for(const link of section.querySelectorAll('.noa-site-map-link')){const match=link.textContent.toLocaleLowerCase().includes(query);link.hidden=!match;if(match)shown++;}section.hidden=shown===0;count+=shown;}status.textContent=query?(count?count+'개 메뉴를 찾았습니다.':'일치하는 메뉴가 없습니다. 다른 단어로 찾아보세요.') : '';});})();
</script></body></html>
