<?php
declare(strict_types=1);
require_once __DIR__.'/ai-lab.php';

/** Navigation metadata only: never connect storage, scan media or start workers. */
function n80_workspaces(): array {
    return [
        'admin'=>['label'=>'홈페이지 설정','entry'=>'/noa-library.php','access'=>'admin'],
        'creator_lab'=>['label'=>'CREATOR LAB','entry'=>'/noa-channel-workspace.php','access'=>'creator'],
        'ai_lab'=>['label'=>'AI LAB','entry'=>'/noa-ai-lab.php','access'=>'member'],
    ];
}

/** A specialist route has one owning workspace. Tuple: id, label, help, URL, icon, access. */
function n80_workspace_groups(string $workspace, ?array $access=null): array {
    $groups = [
        'creator_lab'=>[
            'channel'=>['title'=>'내 채널','routes'=>[
                ['creator','곡·음원 관리','N80 탐색기에서 곡 선택·편집·업로드','/noa-creator.php','music','creator'],
                ['channelRules','제작 규칙','채널 공통·장르별 제작 기준','/noa-channel-rules.php','playlists','creator'],
                ['support','후원·정산','받은 후원과 정산 신청','/noa-support.php','user','creator'],
                ['collaboration','작품·협업','작품 피드백과 협업','/noa-creator-lab.php','community','creator'],
            ]],
            'catalog'=>['title'=>'전체 콘텐츠','routes'=>[
                ['catalog','N80 탐색기','전체 곡 검색·편집·휴지통','/noa-catalog.php','library','admin'],
                ['editor','새 곡 등록','원곡·ACT·플레이리스트 등록','/noa-editor.php','edit','admin'],
                ['order','곡 묶음·순서','카테고리·장르별 묶음과 순서','/noa-music.php','playlists','admin'],
                ['jukebox','음원 최적화','곡별 파일 교체와 처리 상태','/noa-app/jukebox/','music','admin'],
                ['youtubeAdmin','YouTube 관리','영상 수집·원곡 연결·성과','/noa-youtube-admin.php','youtube','admin'],
            ]],
            'contentTools'=>['title'=>'콘텐츠 점검','advanced'=>true,'routes'=>[
                ['taxonomy','공통 분류·제작 규칙','전체 분류 기준과 곡 연결 검토','/noa-app/taxonomy/','playlists','admin'],
                ['quality','곡 정보 검사','필요한 때 전체 정보 검사·정리','/noa-quality.php','settings','admin'],
                ['catalogAdmin','원본 가져오기','기존 자료를 라이브러리에 등록','/noa-catalog-admin.php','library','admin'],
                ['categoryOrder','사연·커버 순서','사연곡·커버곡 순서 편집','/noa-category-order-admin.php','playlists','admin'],
            ]],
        ],
        'admin'=>[
            'operation'=>['title'=>'회원·운영','routes'=>[
                ['members','회원 관리','회원 상태와 권한','/adm/member_list.php','user','admin'],
                ['creatorReview','크리에이터 가입 심사','신청 검토·승인·채널 개설','/noa-creator-review.php','user','admin'],
                ['boards','게시판 관리','공지·커뮤니티 설정','/adm/board_list.php','community','admin'],
                ['subscriptions','구독·포인트','이용 정책과 결제 내역','/noa-subscription-admin.php','user','admin'],
                ['themeAdmin','화면·테마','공통 디자인과 테마','/noa-theme-admin.php','settings','admin'],
            ]],
            'connections'=>['title'=>'서비스 연결','routes'=>[
                ['social','Google·Kakao 로그인','소셜 가입 인증 설정','/adm/config_form.php#anc_cf_sns','user','admin'],
                ['aiSettings','AI·YouTube 연결','제작 서비스·채널·사용 한도','/noa-ai-lab.php?tool=settings','settings','admin'],
                ['payments','결제 연결','결제 서비스 설정과 운영 모드','/noa-payment-settings.php','settings','admin'],
                ['kcpTest','KCP 연결 확인','관리자용 결제창 테스트','/noa-kcp-test.php','settings','admin'],
            ]],
            'advanced'=>['title'=>'시스템·점검','advanced'=>true,'routes'=>[
                ['workStatus','N80 Engine 작업 현황','지시·처리 단계·검증 결과','/noa-work-status.php','settings','admin'],
                ['documents','문서·변경 이력','저장 버전과 변경 기록','/noa-library.php?view=documents','book','admin'],
                ['recovery','원본 복구','보존 자료와 복구 상태','/noa-recovery.php','book','admin'],
                ['database','자료 저장소','자료 관계와 저장 상태','/noa-app/database/','library','admin'],
                ['popularity','인기 집계','유효 재생과 순위 집계','/noa-app/popularity/','playlists','admin'],
                ['system','시스템 기본 설정','회원·게시판 기반 설정','/adm/config_form.php','settings','admin'],
                ['nativeTheme','게시판 테마','게시판 기반 테마 유지보수','/adm/theme.php','settings','admin'],
            ]],
        ],
    ];
    if ($workspace === 'ai_lab') {
        $ai = ['production'=>['title'=>'음악·영상 제작','routes'=>[]], 'conversation'=>['title'=>'대화·음악 추천','routes'=>[]], 'results'=>['title'=>'결과·성과','routes'=>[]]];
        foreach (n80_lab_menu_tools($access) as $id=>$tool) {
            $group = $tool['section'];
            $ai[$group]['routes'][] = [$id,$tool['label'],$tool['description']??'', '/noa-ai-lab.php?tool='.$id,'mic',$tool['access']];
        }
        return $ai;
    }
    return $groups[$workspace] ?? [];
}

function n80_workspace_render(string $workspace, array $access): void {
    $e=static fn($v)=>htmlspecialchars((string)$v,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');
    foreach (n80_workspace_groups($workspace,$access) as $id=>$group) {
        $routes=array_filter($group['routes'],static fn($row)=>!empty($access[$row[5]]));
        if (!$routes) continue;
        $advanced=!empty($group['advanced']);
        echo $advanced ? '<details class="noa-workspace-advanced"><summary>'.$e($group['title']).'</summary>' : '<section class="noa-section"><h2>'.$e($group['title']).'</h2>';
        echo '<nav class="noa-workspace-grid" aria-label="'.$e($group['title']).'">';
        foreach ($routes as $row) echo '<a data-n80-module="'.$e($row[0]).'" data-noa-icon="'.$e($row[4]).'" href="'.$e($row[3]).'"><span><strong>'.$e($row[1]).'</strong>'.($row[2]!==''?'<small>'.$e($row[2]).'</small>':'').'</span></a>';
        echo '</nav>'.($advanced?'</details>':'</section>');
    }
}
