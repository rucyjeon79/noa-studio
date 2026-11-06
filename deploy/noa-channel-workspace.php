<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';
require_once __DIR__.'/noa-bridge/member-access.php';
require_once __DIR__.'/noa-channel-menu.php';

$access = nam_access((array)$member, (string)($is_admin ?? ''));
if (!$access['creator']) { http_response_code(403); exit; }
header('Cache-Control: private, no-store');
if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
$escape = static fn($value) => htmlspecialchars((string)$value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
$tools = [
    ['/noa-creator.php', '곡·음원 관리', '곡 정보와 영상 링크 편집, 음원 업로드, 프로필 수정'],
    ['/noa-channel-rules.php', '제작 규칙', '채널 공통 규칙과 장르별 제작 기준'],
    ['/noa-support.php', '후원·정산', '받은 후원 내역과 정산 신청'],
    ['/noa-creator-lab.php', '크리에이터 라운지', '작품 피드백과 협업'],
];
$renderLinks = static function(array $items) use ($escape): void {
    foreach ($items as [$url, $title, $description]) { ?>
        <a href="<?=$escape($url)?>"><span><strong><?=$escape($title)?></strong><small><?=$escape($description)?></small></span></a>
    <?php }
};
?>
<!doctype html><html lang="ko"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>내 채널 작업실 | NOA STUDIO</title><link rel="stylesheet" href="/noa-ui.css">
<link rel="stylesheet" href="/noa-creator.css?v=<?=filemtime(__DIR__.'/noa-creator.css')?>">
<script src="/noa-brand.js" defer></script><script src="/noa-ui.js" defer></script>
</head><body class="noa-page"><main id="noa-my-channel">
<h1 id="workspace-title">내 채널 작업실</h1>
<nav id="workspace-shortcuts" class="creator-actions" aria-label="채널 바로가기" hidden>
<a id="workspace-public" class="noa-button" href="/noa-channel.php?id=<?=hash('sha256',(string)$member['mb_id'])?>">내 채널 보기</a>
<a id="workspace-board" class="noa-button" hidden>채널 게시판</a>
</nav>
<section class="noa-section"><h2>채널 관리</h2>
<nav class="noa-workspace-grid" aria-label="채널 관리"><?php $renderLinks($tools); noa_channel_ai_button($access); ?></nav>
<?php if (!$access['creatorAI']): ?><p class="noa-muted"><a href="/noa-subscription.php">크리에이터 구독 보기</a></p><?php endif; ?>
</section>
<?php if ($access['admin']): ?>
<details class="noa-workspace-advanced"><summary>전체 콘텐츠 관리</summary>
<nav class="noa-workspace-grid" aria-label="전체 콘텐츠 관리"><?php $renderLinks([
    ['/noa-catalog.php', '전체 곡 라이브러리', '곡 검색·수정, 원곡·ACT 등록, 휴지통'],
    ['/noa-music.php', '곡 묶음·순서', '카테고리와 재생 순서 편집'],
    ['/noa-app/jukebox/', '전체 음원 최적화', '곡별 파일 교체와 최적화 상태 확인'],
    ['/noa-youtube-admin.php', 'YouTube 채널 관리', '채널 연결, 영상 매칭, 성과 확인'],
    ['/noa-quality.php', '곡 정보 검사', '입력값 비교와 정리'],
    ['/noa-catalog-admin.php', '원본 가져오기', '기존 원본을 라이브러리에 등록'],
    ['/noa-library.php?view=documents', '문서·변경 이력', '저장 버전과 변경 기록'],
]); ?></nav></details>
<?php endif; ?>
</main></body></html>
