<?php
declare(strict_types=1);

/** A tool is either a panel in the production desk or a separate, lazy-loaded page. */
function n80_lab_tools(): array {
    return [
        'settings'=>['label'=>'AI·YouTube 연결','description'=>'AI 제공자·YouTube 채널과 사용 한도 설정','access'=>'admin','panel'=>'lab-settings','hidden'=>true],
        'text' => ['label'=>'새 가사·콘텐츠 초안', 'description'=>'제작 요청과 장르 규칙으로 가사·Suno 지시문·게시 문구 초안을 만듭니다. 검토 후 곡에 반영하세요.', 'menuHidden'=>true, 'access'=>'admin', 'panel'=>'lab-text'],
        'muvy' => ['label'=>'대본·장면 프롬프트', 'description'=>'등록된 곡 정보로 뮤비 대본과 장면별 제작 지시문을 만듭니다. 영상 파일 제작은 별도 작업입니다.', 'family'=>'video', 'menuHidden'=>true, 'access'=>'admin', 'panel'=>'lab-muvy'],
        'create' => ['label'=>'영상 파일 제작', 'description'=>'실제 음원을 분석하고 캐릭터·영상 구간을 선택해 MP4를 제작합니다. 외부 영상 서비스 연결이 필요합니다.', 'family'=>'video', 'access'=>'admin', 'panel'=>'lab-create'],
        'song' => ['label'=>'한 곡씩 제작', 'description'=>'N80 탐색기에서 한 곡을 골라 필요한 곡 정보 항목을 생성하고 확인합니다.', 'menuHidden'=>true, 'access'=>'admin', 'page'=>'noa-lab-song.php'],
        'creative' => ['label'=>'내 창작 보관함','description'=>'이야기를 사지선다로 구체화하고 곡정보·수정 이력을 저장해, 확인 후 새 창작곡으로 등록합니다.','family'=>'creative','access'=>'creatorAI','page'=>'noa-lab-creative.php'],
        'batch' => ['label'=>'ACT·장르 묶음 제작', 'description'=>'여러 곡·ACT·장르를 선택해 같은 곡 정보 항목을 한 번에 생성하고 처리 상태를 확인합니다.', 'family'=>'batch', 'access'=>'admin', 'page'=>'noa-creator.php'],
        'channel' => ['label'=>'내 채널 곡 초안', 'description'=>'내 채널의 곡을 바탕으로 가사·Suno 지시문·게시 문구를 만듭니다. 이용 포인트 확인 후 요청합니다.', 'menuHidden'=>true, 'access'=>'creatorAI', 'page'=>'noa-creator-ai.php'],
        'chat' => ['label'=>'곡 이야기·AI 대화', 'description'=>'곡을 선택해 이야기를 나누고 제작 아이디어를 정리합니다.', 'family'=>'conversation', 'access'=>'member', 'page'=>'noa-lab-chat.php'],
        'listen' => ['label'=>'음악 추천', 'description'=>'취향과 상황에 맞는 음악을 추천받고 감상할 곡을 찾습니다.', 'family'=>'conversation', 'access'=>'member', 'page'=>'noa-lab-chat.php'],
        'jobs' => ['label'=>'작업 결과·이력', 'description'=>'가사·영상 제작 작업의 진행 상태와 결과를 확인하고 실패한 작업을 재시도합니다.', 'family'=>'jobs', 'access'=>'admin', 'panel'=>'lab-jobs'],
        'growth' => ['label'=>'채널 성과', 'description'=>'AI LAB에서 게시한 영상의 조회수·시청 시간 등 YouTube 제공 성과를 확인합니다.', 'family'=>'growth', 'access'=>'admin', 'panel'=>'lab-growth'],
    ];
}

/** Menu families only; execution, ownership and tool URLs remain unchanged. */
function n80_lab_families(): array {
    return [
        'creative'=>['label'=>'내 창작 보관함','description'=>'사연 입력·사지선다·개별 수정·영구 초안 저장·최종 등록','section'=>'production'],
        'batch'=>['label'=>'ACT·장르 묶음 제작','description'=>'여러 곡·ACT·장르를 선택해 필요한 항목을 한 번에 생성','section'=>'production'],
        'video'=>['label'=>'뮤직비디오 제작','description'=>'음원·캐릭터·구간을 선택해 MP4 영상 파일 제작','section'=>'production'],
        'conversation'=>['label'=>'AI 대화·음악 추천','description'=>'곡 이야기·제작 아이디어 상담과 취향에 맞는 음악 추천','section'=>'conversation'],
        'jobs'=>['label'=>'작업 결과·이력','description'=>'가사·영상 제작 진행 상황, 생성 결과, 실패 작업 재시도','section'=>'results'],
        'growth'=>['label'=>'채널 성과','description'=>'AI LAB에서 게시한 영상의 조회수·시청 시간 등 성과 확인','section'=>'results'],
    ];
}

/** Only standalone tasks appear here. Song-editor actions keep their contextual routes. */
function n80_lab_menu_tools(?array $access=null): array {
    $tools=n80_lab_tools();$menu=[];
    foreach(n80_lab_families() as $family=>$definition){
        $variants=array_filter($tools,static fn($tool)=>empty($tool['hidden'])&&empty($tool['menuHidden'])&&($tool['family']??'')===$family);
        $available=$access===null?$variants:array_filter($variants,static fn($tool)=>!empty($access[$tool['access']]));
        // Locked directory entries retain their existing access requirement.
        $id=$available?array_key_first($available):array_key_last($variants);
        if($id!==null)$menu[$id]=array_merge($tools[$id],$definition,['family'=>$family]);
    }
    return $menu;
}

// Compatibility for existing callers; the workspace itself now opens the menu.
function n80_lab_default(array $access): string {
    return !empty($access['admin'])?'batch':'chat';
}

function n80_lab_nav(array $access, string $current): void {
    $e=static fn($v)=>htmlspecialchars((string)$v,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');
    $tools=n80_lab_tools();$active=$tools[$current]??[];$family=$active['family']??'';
    $families=n80_lab_families();$title=!empty($active['menuHidden'])?($active['label']??''):($families[$family]['label']??($active['label']??''));
    echo '<nav class="lab-tabs" style="display:flex;flex-wrap:wrap;align-items:center;gap:8px 20px" aria-label="AI LAB 메뉴"><a href="/noa-ai-lab.php">AI LAB</a>';
    if(isset($tools[$current])&&empty($tools[$current]['hidden'])&&!empty($access[$tools[$current]['access']])){
        echo '<a href="/noa-ai-lab.php?tool='.$e($current).'" aria-current="page">'.$e($title).'</a>';
    }
    $otherTools=array_filter(n80_lab_menu_tools($access),static fn($tool)=>$tool['family']!==$family&&!empty($access[$tool['access']]));
    if($otherTools){
        echo '<details class="lab-tool-switch" data-noa-local-disclosure><summary>다른 도구</summary><div class="lab-tool-links">';
        foreach ($otherTools as $id => $tool) echo '<a href="/noa-ai-lab.php?tool='.$e($id).'">'.$e($tool['label']).'</a> ';
        echo '</div></details>';
    }
    echo '</nav>';
    $modes=array_filter($tools,static fn($tool)=>$family!==''&&empty($tool['hidden'])&&empty($tool['menuHidden'])&&($tool['family']??'')===$family&&!empty($access[$tool['access']]));
    if(count($modes)>1){
        echo '<nav class="creator-actions" style="display:flex;flex-wrap:wrap;gap:8px" data-n80-lab-modes="'.$e($family).'" aria-label="'.$e($title).' 작업 선택">';
        foreach($modes as $id=>$tool)echo '<a class="noa-button" href="/noa-ai-lab.php?tool='.$e($id).'"'.($id===$current?' aria-current="page"':'').'>'.($id===$current?'<strong>'.$e($tool['label']).'</strong>':$e($tool['label'])).'</a>';
        echo '</nav>';
    }
    if(!empty($active['description'])&&!empty($access[$active['access']]))echo '<p class="noa-muted" data-n80-tool-description>'.$e($active['description']).'</p>';
}
