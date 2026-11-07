<?php
declare(strict_types=1);

/** A tool is either a panel in the production desk or a separate, lazy-loaded page. */
function n80_lab_tools(): array {
    return [
        'settings'=>['label'=>'AI·YouTube 연결','access'=>'admin','panel'=>'lab-settings','hidden'=>true],
        'text' => ['label'=>'가사·콘텐츠 초안', 'access'=>'admin', 'panel'=>'lab-text'],
        'muvy' => ['label'=>'뮤비 대본·프롬프트', 'access'=>'admin', 'panel'=>'lab-muvy'],
        'create' => ['label'=>'영상 제작', 'access'=>'admin', 'panel'=>'lab-create'],
        'song' => ['label'=>'곡별 AI 제작', 'access'=>'admin', 'page'=>'noa-lab-song.php'],
        'batch' => ['label'=>'여러 곡 한 번에 제작', 'access'=>'admin', 'page'=>'noa-creator.php'],
        'channel' => ['label'=>'내 채널 초안', 'access'=>'creatorAI', 'page'=>'noa-creator-ai.php'],
        'chat' => ['label'=>'AI 대화', 'access'=>'member', 'page'=>'noa-lab-chat.php'],
        'listen' => ['label'=>'AI 음악 추천', 'access'=>'member', 'page'=>'noa-lab-chat.php'],
        'jobs' => ['label'=>'작업 결과·이력', 'access'=>'admin', 'panel'=>'lab-jobs'],
        'growth' => ['label'=>'채널 성과', 'access'=>'admin', 'panel'=>'lab-growth'],
    ];
}

// Compatibility for existing callers; the workspace itself now opens the menu.
function n80_lab_default(array $access): string {
    return !empty($access['admin'])?'text':(!empty($access['creatorAI'])?'channel':'chat');
}

function n80_lab_nav(array $access, string $current): void {
    echo '<nav class="lab-tabs" aria-label="AI LAB 메뉴"><a href="/noa-ai-lab.php">AI LAB</a>';
    foreach (n80_lab_tools() as $id => $tool) {
        if (!empty($tool['hidden']) || empty($access[$tool['access']])) continue;
        echo '<a href="/noa-ai-lab.php?tool='.$id.'"'.($id===$current?' aria-current="page"':'').'>'.$tool['label'].'</a> ';
    }
    echo '</nav>';
}
