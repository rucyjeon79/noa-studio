<?php
/**
 * NOA STUDIO progressive home shell for GnuBoard 5.
 * Install as /html/noa2.php; after verifying, use an explicit root routing decision.
 * Does not modify g5_* tables or legacy application data.
 */
declare(strict_types=1);
$base = __DIR__;
if (!is_file($base . '/common.php')) {
    http_response_code(503);
    exit('NOA STUDIO requires the existing GnuBoard installation.');
}
require_once $base . '/common.php';
header('Content-Type: text/html; charset=UTF-8');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');
$loggedIn = !empty($is_member);
$displayName = $loggedIn ? (string)($member['mb_nick'] ?? $member['mb_name'] ?? '별무리') : '방문자';
$loginUrl = defined('G5_BBS_URL') ? G5_BBS_URL . '/login.php' : '/bbs/login.php';
$communityUrl = defined('G5_BBS_URL') ? G5_BBS_URL . '/board.php?bo_table=free' : '/bbs/board.php?bo_table=free';
$logoutUrl = defined('G5_BBS_URL') ? G5_BBS_URL . '/logout.php' : '/bbs/logout.php';
function e(string $s): string { return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
?>
<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>NOA STUDIO | AI Artist Noa</title>
<style>
:root{color-scheme:dark;--bg:#08090d;--panel:#14151a;--line:#303036;--gold:#d7ad62;--muted:#a6a5a8}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:#f4f0e9;font:15px/1.6 system-ui,-apple-system,"Malgun Gothic",sans-serif}
a{color:inherit;text-decoration:none}button{font:inherit;cursor:pointer}.shell{display:grid;grid-template-columns:240px 1fr;min-height:100vh}
aside{padding:32px 18px;border-right:1px solid var(--line);background:#0e0f13}.brand{font:700 25px Georgia,serif;letter-spacing:2px;color:var(--gold)}
.small{color:var(--muted);font-size:12px;letter-spacing:2px}.nav{display:grid;gap:7px;margin-top:40px}.nav a{padding:12px 14px;border-radius:9px}.nav a:hover,.nav a.active{background:#272219;color:var(--gold)}
main{padding:32px clamp(20px,5vw,80px)}header{display:flex;justify-content:space-between;align-items:center;gap:20px}
.pill{border:1px solid #685231;border-radius:40px;padding:8px 16px;color:var(--gold)}
.hero{margin-top:45px;padding:clamp(25px,5vw,70px);border:1px solid #4d3c23;border-radius:20px;background:radial-gradient(ellipse at 85% 20%,#4b3621 0,transparent 48%),linear-gradient(135deg,#181a20,#0e0e12)}
.hero h1{font:normal clamp(36px,5vw,66px)/1.14 Georgia,serif;margin:16px 0;color:#f4e4c7}
.hero p{max-width:570px;color:#c4c0bc}.btn{display:inline-block;background:var(--gold);color:#15100b;border:0;border-radius:9px;padding:12px 22px;font-weight:700;margin-top:15px}
section{margin-top:40px}h2{font-size:19px;font-weight:600}.cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.card{background:var(--panel);border:1px solid var(--line);padding:25px;border-radius:14px;min-height:170px}.card strong{display:block;font-size:19px;color:var(--gold);margin:9px 0}.card p{color:var(--muted);margin:0}
.note{color:var(--muted);font-size:13px;margin-top:35px}
@media(max-width:760px){.shell{display:block}aside{padding:17px;border-right:0;border-bottom:1px solid var(--line)}.nav{display:flex;overflow:auto;margin-top:12px}.nav a{white-space:nowrap}main{padding:20px}.cards{grid-template-columns:1fr}.hero{margin-top:22px}}
</style>
</head>
<body><div class="shell"><aside><div class="brand">NOA STUDIO</div><div class="small">AI ARTIST NOA</div>
<nav class="nav" aria-label="주요 메뉴"><a class="active" href="/noa2.php">홈</a><a href="/noa-music.php">음악 라이브러리</a><a href="https://noa-studio.grok.me/" rel="noopener noreferrer">기존 음악 스튜디오 ↗</a><?php if (!empty($is_admin)): ?><a href="/noa-library.php">라이브러리 관리</a><?php endif; ?><a href="https://youtube.com/@ainoa_ramjunpapa" rel="noopener noreferrer">음악 감상 ↗</a><a href="<?=e($communityUrl)?>">커뮤니티 ↗</a></nav>
</aside><main><header><span class="small">MUSIC · STORIES · CREATION</span><span class="pill"><?=e($displayName)?> · <?= $loggedIn ? '<a href="'.e($logoutUrl).'">로그아웃</a>' : '<a href="'.e($loginUrl).'">로그인</a>' ?></span></header>
<div class="hero"><div class="small">THE NEXT CHAPTER</div><h1>Music beyond<br>imagination.</h1><p>노아의 음악과 이야기가 이어지는 공간. 음악을 만들고, 감상하고, 별무리와 마음을 나눕니다.</p><a class="btn" href="https://noa-studio.grok.me/" rel="noopener noreferrer">음악 스튜디오 열기 ↗</a></div>
<section><h2>NOA STUDIO</h2><div class="cards">
<a class="card" href="https://noa-studio.grok.me/"><div class="small">01 / CREATE</div><strong>Music Studio</strong><p>기존 음악 생성 및 EP·ACT 관리 기능으로 이동합니다.</p></a>
<a class="card" href="/noa-music.php"><div class="small">02 / LISTEN</div><strong>NOA Music</strong><p>이관된 음악 목록에서 곡을 고르고 바로 감상합니다.</p></a>
<a class="card" href="<?=e($communityUrl)?>"><div class="small">03 / COMMUNITY</div><strong>Starlight</strong><p>기존 그누보드 회원 및 커뮤니티를 유지합니다.</p></a>
</div></section><p class="note">별무리와 함께 이어가는 노아의 음악 이야기.</p>
</main></div></body></html>
