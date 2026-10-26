<?php
declare(strict_types=1);
if (!defined('_GNUBOARD_')) { http_response_code(403); exit; }
header('Content-Type: text/html; charset=utf-8');header('Cache-Control: private, no-store');header('X-Content-Type-Options: nosniff');header('Referrer-Policy: strict-origin-when-cross-origin');
function noa_home_e(string $text):string{return htmlspecialchars($text,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');}
if(is_file(dirname(__DIR__).'/noa-bridge/notices.php'))require_once dirname(__DIR__).'/noa-bridge/notices.php';
$noa_notices=function_exists('nn_native_notices')?nn_native_notices():['items'=>[],'restricted'=>false];
?><!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NOA STUDIO | AI Artist Noa</title><meta name="description" content="AI Artist Noa의 음악, EP 시리즈와 ACT 플레이리스트. 별무리와 함께하는 NOA STUDIO."><meta property="og:title" content="NOA STUDIO"><meta property="og:description" content="Music. Stories. Starlight."><meta property="og:image" content="https://noastudio.ai.kr/noa-bridge/characters/cast-pair.jpg"><meta name="theme-color" content="#17191c"><link rel="manifest" href="/noa-manifest.json"><link rel="stylesheet" href="/noa-ui.css?v=20261026-home-notices"><script src="/noa-brand.js?v=20261021-p0-final" defer></script><script src="/noa-ui.js?v=20261026-home-notices" defer></script><script src="/noa-browse.js?v=20261021-p0-final" defer></script><script src="/noa-home.js?v=20261024-popularity-metrics" defer></script><script src="/noa-hero.js?v=20261025-hero-genre-deck" defer></script><style id="noa-home-action-layout">
/* Home-only geometry: media first in both orientations, with shared card edges. */
html .noa-hero[data-home-section=hero]{--noa-hero-gap:8px;--noa-hero-pad:clamp(16px,3cqi,32px);container-type:inline-size;display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,1fr) minmax(0,1fr);grid-template-areas:'media' 'copy';gap:0;width:100%;block-size:auto;aspect-ratio:1/1;min-height:0;align-items:stretch;border:1px solid var(--noa-line);border-radius:var(--noa-card-radius,var(--noa-radius));overflow:hidden;box-sizing:border-box}
html .noa-hero[data-home-section=hero]>.noa-hero-art{grid-area:media;display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,1fr);width:100%;inline-size:100%;block-size:100%;min-block-size:0;aspect-ratio:auto;align-self:stretch;overflow:hidden;contain:size;min-width:0;margin:0;position:relative;box-sizing:border-box}
html .noa-hero[data-home-section=hero] .noa-hero-art>:is(picture,video){grid-area:1/1;position:absolute;inset:0;inline-size:100%;block-size:100%;min-inline-size:0;min-block-size:0;max-block-size:none;aspect-ratio:auto;object-fit:cover;object-position:center 25%}
html .noa-hero[data-home-section=hero]>.noa-hero-art::before{content:none;display:none;background-image:none}
html .noa-hero[data-home-section=hero] .noa-hero-art picture img{display:block;position:static;inline-size:100%;block-size:100%;max-block-size:none;aspect-ratio:auto;object-fit:cover;object-position:center 25%;transform:none}
html .noa-hero[data-home-section=hero]>.noa-hero-copy{grid-area:copy;display:flex;flex-direction:column;justify-content:space-between;align-items:stretch;gap:8px;inline-size:100%;min-inline-size:0;min-block-size:0;margin:0;padding:12px;overflow:hidden;box-sizing:border-box}
html .noa-hero[data-home-section=hero] h1{font-size:clamp(20px,2.7cqi,32px);font-weight:600;letter-spacing:-.02em;line-height:1.2;margin:0;overflow-wrap:anywhere}
html .noa-hero[data-home-section=hero] h1 br{display:none}
html .noa-hero[data-home-section=hero] .noa-hero-copy p{margin:0;line-height:1.5}
html .noa-hero[data-home-section=hero] .noa-hero-actions{container-type:inline-size;container-name:noa-hero-actions;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-items:stretch;gap:var(--noa-hero-gap);width:100%;max-width:100%;margin-top:0}
html .noa-hero[data-home-section=hero] .noa-hero-services{display:flex;min-width:0;margin:0}
html .noa-hero[data-home-section=hero] .noa-hero-actions .noa-button{display:inline-flex;flex-direction:column;align-items:center;justify-content:center;box-sizing:border-box;min-width:0;width:100%;min-height:48px;margin:0;white-space:normal;text-align:center}
@media(orientation:landscape){
 html .noa-hero[data-home-section=hero]{grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr);grid-template-rows:minmax(0,1fr);grid-template-areas:'media copy';aspect-ratio:2/1}
}
/* Media always covers its frame. Supporting content fills the remaining card. */
html .noa-hero[data-home-section=hero] .noa-hero-intro{min-width:0;display:grid;gap:4px}
html .noa-hero[data-home-section=hero] .noa-hero-intro .noa-eyebrow{font-size:10px;letter-spacing:.08em;line-height:1.3}
html .noa-hero[data-home-section=hero] .noa-hero-copy p{font-size:12px;line-height:1.4;max-width:none}
html .noa-hero[data-home-section=hero] .noa-hero-actions .noa-button{padding:6px;gap:3px;font-size:11px}
html .noa-hero[data-home-section=hero] .noa-hero-actions svg{width:18px;height:18px}
html .noa-hero[data-home-section=hero] .noa-hero-discover{display:none}
html .noa-hero[data-home-section=hero] .noa-hero-art video{transform-origin:center 25%;animation:noa-hero-framing 12s ease-in-out infinite;animation-play-state:paused}
html .noa-hero[data-home-section=hero] .noa-hero-art:is([data-media-state=playing],[data-media-state=ended]) video{animation-play-state:running;will-change:transform}
html .noa-hero[data-home-section=hero] .noa-hero-play{position:absolute;inset:auto 12px 12px auto;z-index:4;gap:6px;min-height:44px}
html .noa-hero[data-home-section=hero] #noa-hero-status:not(:empty){position:absolute;inset:12px 12px auto;max-width:calc(100% - 24px);margin:0;padding:8px;z-index:3}
@keyframes noa-hero-framing{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
@media(orientation:landscape){
 html .noa-hero[data-home-section=hero]>.noa-hero-copy{padding:clamp(12px,2cqi,28px)}
 html .noa-hero[data-home-section=hero] .noa-hero-copy p{font-size:clamp(12px,1.3cqi,15px)}
 html .noa-hero[data-home-section=hero] .noa-hero-discover{display:flex;flex:1;min-height:0;flex-direction:column;gap:6px;overflow:hidden}
 html .noa-hero[data-home-section=hero] .noa-hero-discover h2{font-size:12px;line-height:1.3;margin:0;color:var(--noa-muted)}
 html .noa-hero[data-home-section=hero] .noa-hero-picks{display:flex;flex:1;min-height:0;flex-direction:column;gap:4px}
 html .noa-hero[data-home-section=hero] .noa-hero-pick{display:flex;flex:1;align-items:center;gap:10px;min-height:44px;min-width:0;text-decoration:none;border-top:0;padding:4px 0}
 html .noa-hero[data-home-section=hero] .noa-hero-pick img{position:static;flex:none;width:52px;height:36px;object-fit:cover;max-height:none;border-radius:4px}
 html .noa-hero[data-home-section=hero] .noa-hero-pick span{min-width:0;display:grid;gap:2px}
 html .noa-hero[data-home-section=hero] .noa-hero-pick strong{font-size:12px;font-weight:500;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
 html .noa-hero[data-home-section=hero] .noa-hero-pick small{font-size:10px;color:var(--noa-muted)}
 html .noa-hero[data-home-section=hero] .noa-hero-actions .noa-button{min-height:52px;font-size:12px}
}
@media(orientation:portrait){
 html .noa-hero[data-home-section=hero]>.noa-hero-copy{padding:8px 16px;gap:4px}
 html .noa-hero[data-home-section=hero] .noa-hero-actions{order:2}
 html .noa-hero[data-home-section=hero] .noa-hero-actions .noa-button{min-height:44px;padding:4px;line-height:1.2}
 html .noa-hero[data-home-section=hero] .noa-hero-actions svg{width:16px;height:16px}
 html .noa-hero[data-home-section=hero] .noa-hero-discover{display:flex;order:1;flex:1;min-height:0;overflow:hidden}
 html .noa-hero[data-home-section=hero] .noa-hero-discover h2{display:none}
 html .noa-hero[data-home-section=hero] .noa-hero-picks{display:flex;flex:1;min-height:0;flex-direction:column;gap:4px}
 html .noa-hero[data-home-section=hero] .noa-hero-pick{display:flex;flex:1;align-items:center;gap:8px;min-height:44px;min-width:0;text-decoration:none;border-top:0;padding:4px 0}
 html .noa-hero[data-home-section=hero] .noa-hero-pick img{position:static;flex:none;width:44px;height:30px;object-fit:cover;max-height:none;border-radius:4px}
 html .noa-hero[data-home-section=hero] .noa-hero-pick span{min-width:0;display:grid;gap:2px}
 html .noa-hero[data-home-section=hero] .noa-hero-pick strong{font-size:12px;font-weight:500;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
 html .noa-hero[data-home-section=hero] .noa-hero-pick small{font-size:10px;color:var(--noa-muted)}
}
/* One genre heading and one quiet list; no repeated decorative category labels. */
@media(orientation:landscape){
 html .noa-hero[data-home-section=hero] .noa-hero-pick+.noa-hero-pick{border-top:1px solid var(--noa-line)}
 html .noa-hero[data-home-section=hero] .noa-hero-pick small{display:none}
}
/* Reflow the icon and label only when each action has enough actual space. */
@container noa-hero-actions (min-width:280px){
 html .noa-hero[data-home-section=hero] .noa-hero-actions .noa-button{flex-direction:row;gap:8px;min-height:44px;padding:8px 12px;font-size:12px;line-height:1.3;white-space:nowrap}
 html .noa-hero[data-home-section=hero] .noa-hero-actions .noa-button svg{width:18px;height:18px;flex:none}
}
@media(prefers-reduced-motion:reduce){html .noa-hero[data-home-section=hero] .noa-hero-art video{animation:none;transform:none;will-change:auto}}
/* Portrait media extends behind the translucent lower copy, preserving the full frame. */
@media(orientation:portrait){
 html .noa-hero[data-home-section=hero]{grid-template-rows:minmax(0,1fr);grid-template-areas:'stage';position:relative}
 html .noa-hero[data-home-section=hero]>.noa-hero-art{grid-area:stage;z-index:0}
 html .noa-hero[data-home-section=hero]>.noa-hero-copy{grid-area:stage;align-self:end;z-index:1;block-size:48%;min-block-size:170px;background:rgba(24,28,34,.10);background:color-mix(in srgb,var(--noa-surface) 10%,transparent);backdrop-filter:none;border-top:1px solid color-mix(in srgb,var(--noa-line) 20%,transparent);padding:12px 14px;gap:8px}
 html .noa-hero[data-home-section=hero] .noa-hero-play{inset:12px 12px auto auto}
 html .noa-hero[data-home-section=hero] :is(.noa-hero-intro,.noa-hero-pick,.noa-hero-copy p,.noa-hero-pick small){color:#fff;text-shadow:0 1px 3px #000,0 0 10px #0009}
}
</style></head><body><div class="noa-layout"><main class="noa-main"><header class="noa-topbar"><a class="noa-logo" href="/">NOA STUDIO</a><div class="noa-account"><?php if(!empty($is_member)):?><span class="noa-muted"><?=noa_home_e((string)$member['mb_nick'])?></span><a href="/bbs/logout.php" data-noa-i18n="로그아웃">로그아웃</a><?php else:?><a href="/bbs/login.php" data-noa-i18n="로그인">로그인</a><?php endif;?></div></header>
<section class="noa-hero" data-home-section="hero"><div class="noa-hero-copy"><div class="noa-hero-intro"><span class="noa-eyebrow">지금 보는 장르 소개 영상</span><h1 id="noa-hero-genre">K-POP Original</h1><p id="noa-hero-description">한국어로 전하는 노아의 오리지널 음악 이야기.</p></div><div class="noa-hero-actions"><a class="noa-button primary" href="/noa-youtube.php">음악 영상 둘러보기</a><?php if(is_file(dirname(__DIR__).'/noa-sitemap.php')):?><nav class="noa-hero-services" data-home-section="sitemap" aria-label="사이트맵"><a class="noa-button" data-noa-icon="sitemap" href="/noa-sitemap.php">전체 서비스 보기</a></nav><?php endif;?></div><div class="noa-hero-discover"><h2>음악과 이야기 더 만나기</h2><div id="noa-hero-picks" class="noa-hero-picks"><a class="noa-hero-pick" href="/noa-music.php?group=original"><span><strong>오리지널송</strong><small>노아의 원곡 이야기</small></span></a><a class="noa-hero-pick" href="/noa-youtube.php?group=ep"><span><strong>EP 컬렉션</strong><small>장르와 ACT로 이어 듣기</small></span></a><a class="noa-hero-pick" href="/bbs/board.php?bo_table=free"><span><strong>커뮤니티 최신 소식</strong><small>별무리의 이야기 만나기</small></span></a><a class="noa-hero-pick" href="/noa-world.php"><span><strong>NOA WORLD · 공식 MV</strong><small>음악이 이어지는 세계관</small></span></a></div></div></div><div class="noa-hero-art"><picture><source media="(orientation:landscape)" srcset="/noa-assets/splash/kpop-original-g2-a.jpg"><img id="noa-hero-poster" src="/noa-assets/splash/kpop-original-g2-a.jpg" alt="NOA STUDIO · 원본 메인 영상 포스터" fetchpriority="high"></picture><video id="noa-hero-video" muted playsinline preload="none" aria-label="NOA STUDIO 원본 메인 영상" hidden></video><button id="noa-hero-play" class="noa-button noa-hero-play" type="button" data-noa-icon="play" hidden>영상 재생</button><span id="noa-hero-status" class="noa-hero-status" role="status"></span></div></section>
<section class="noa-section noa-notices" data-home-section="notices" aria-labelledby="noa-notices-heading"><div class="noa-section-head"><h2 id="noa-notices-heading">공지사항</h2><a href="/bbs/board.php?bo_table=notice" data-noa-icon="notice">전체 보기</a></div>
<?php if(!$noa_notices['items']):?><div class="noa-notice-empty"><p><?=$noa_notices['restricted']?'공지사항을 보려면 로그인해 주세요.':'아직 등록된 공지사항이 없습니다.'?></p></div><?php else:?>
<div class="noa-notice-list"><?php foreach($noa_notices['items'] as $i=>$notice):?><details class="noa-notice <?=$i===0?'noa-notice-featured':''?>" id="noa-notice-<?=$notice['id']?>" data-noa-disclosure>
<summary data-noa-document-link><span class="noa-notice-summary"><?php if($i===0):?><small>최근 공지 · <time datetime="<?=noa_home_e($notice['date'])?>"><?=noa_home_e($notice['date'])?></time></small><?php endif;?><strong><?=noa_home_e($notice['title'])?></strong><?php if($i===0):?><span class="noa-notice-excerpt"><?=noa_home_e($notice['excerpt'])?></span><?php endif;?></span><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m6 9 6 6 6-6"/></svg></summary>
<div class="noa-notice-body" data-noa-document-link><p><?=nl2br(noa_home_e($notice['body']))?></p><a href="/bbs/board.php?bo_table=notice&amp;wr_id=<?=$notice['id']?>">게시판에서 보기</a><button class="noa-button" type="button" data-noa-collapse>접기</button></div></details><?php endforeach;?></div><?php endif;?></section>
<section class="noa-section" data-home-section="community"><div class="noa-section-head"><h2 data-noa-i18n="커뮤니티 최신 소식">커뮤니티 최신 소식</h2><a href="/bbs/board.php?bo_table=free" data-noa-i18n="전체 보기">전체 보기</a></div><p class="noa-muted">커뮤니티에서 별무리의 이야기를 만나보세요.</p></section>
<p id="noa-ranking-status" class="noa-muted" role="status">인기 음악을 불러오는 중입니다.</p>
<section class="noa-section" data-home-section="recommendations"><div class="noa-section-head"><h2>추천 음악</h2><a href="/noa-youtube.php">전체 보기</a></div><p class="noa-muted">별무리가 많이 찾은 음악을 만나보세요.</p><div class="noa-card-grid" id="noa-featured"><p class="noa-muted" role="status">공개 영상 순위를 불러오는 중입니다.</p></div></section>
<section class="noa-section" data-home-section="ep"><div class="noa-section-head"><h2>EP 시리즈</h2><a href="/noa-youtube.php">전체 보기</a></div><p class="noa-muted">추천 음악과 겹치지 않는 EP 시리즈.</p><div class="noa-card-grid" id="noa-ep"><p class="noa-muted" role="status">공개 영상 순위를 불러오는 중입니다.</p></div></section>
<section class="noa-section" data-home-section="stories"><div class="noa-section-head"><h2>당신의 이야기, 우리의 음악 🎧</h2><a href="/noa-youtube.php?playlist=PLEPMKciKgvch9TGMAcBdKzhVt1QeYsfKB">전체 보기</a></div><p class="noa-muted">당신의 이야기가 음악이 되는 순간.</p><div class="noa-card-grid" id="noa-stories"><p class="noa-muted" role="status">공개 영상 순위를 불러오는 중입니다.</p></div></section>
<section class="noa-section" data-home-section="covers"><div class="noa-section-head"><h2>🎤 AInoa의 유명곡 커버</h2><a href="/noa-youtube.php?playlist=PLEPMKciKgvcjGmuO2ZcqrkHGfD5Qbb_Eb">전체 보기</a></div><p class="noa-muted">익숙한 노래, 노아의 새로운 목소리.</p><div class="noa-card-grid" id="noa-covers"><p class="noa-muted" role="status">공개 영상 순위를 불러오는 중입니다.</p></div></section>
<section class="noa-section" data-home-section="playlists"><div class="noa-section-head"><h2>플레이리스트</h2><a href="/noa-youtube.php#youtube-playlists">전체 보기</a></div><p class="noa-muted">이어 듣고 싶은 이야기와 ACT 플레이리스트.</p><div class="noa-card-grid" id="noa-acts"><p class="noa-muted" role="status">공개 영상 순위를 불러오는 중입니다.</p></div></section>
<p id="noa-playlist-basis" class="noa-muted"></p>
<section class="noa-section" id="noa-world" data-home-section="world"><div class="noa-section-head"><div><p class="noa-eyebrow">THE ARTISTS</p><h2>NOA WORLD</h2><a href="/noa-world.php">세계관과 공식 MV 보기 →</a></div></div><div class="noa-world"><article class="noa-character"><div class="noa-face-window"><img src="/noa-bridge/characters/noa-sheet.png" alt="Noa" loading="lazy"></div><div><span class="noa-eyebrow">AI ARTIST</span><h3>Noa</h3><p><span data-noa-i18n="노아 · 여성 보컬">노아 · 여성 보컬</span><br><span data-noa-i18n="별무리와 이어가는 음악 이야기.">별무리와 이어가는 음악 이야기.</span></p></div></article><article class="noa-character"><div class="noa-face-window"><img src="/noa-bridge/characters/noel-sheet.png" alt="Noel" loading="lazy"></div><div><span class="noa-eyebrow">AI ARTIST</span><h3>Noel</h3><p><span data-noa-i18n="노엘 · 남성 보컬">노엘 · 남성 보컬</span><br><span data-noa-i18n="노아와 함께하는 또 하나의 목소리.">노아와 함께하는 또 하나의 목소리.</span></p></div></article></div></section>
<section class="noa-section" data-home-section="collections"><div class="noa-section-head"><div><p class="noa-eyebrow">FIND YOUR SOUND</p><h2>음악 컬렉션</h2></div></div><div class="noa-genres" id="noa-genres"></div></section>
<footer class="noa-footer"><span>NOA STUDIO · Music. Stories. Starlight.</span><a href="/bbs/content.php?co_id=privacy">개인정보처리방침</a><a href="/bbs/content.php?co_id=provision">이용약관</a><a href="/noa-settings.php" data-noa-i18n="설정">설정</a></footer></main></div><script id="noa-home-hero-size">
/* Reuse actual home recommendations; never request or invent another ranking. */
(()=>{'use strict';const picks=document.getElementById('noa-hero-picks');if(!picks)return;const fit=()=>{const host=picks.parentElement;if(!host.clientHeight)return;const heading=host.querySelector('h2'),space=host.clientHeight-(matchMedia('(orientation:portrait)').matches?0:22),count=Math.max(0,Math.min(4,Math.floor((space+4)/48)));picks.querySelectorAll('a').forEach((a,i)=>a.hidden=i>=count);heading.hidden=count===0;};window.addEventListener('noa-hero-picks',fit);if(window.ResizeObserver)new ResizeObserver(fit).observe(picks.parentElement);else window.addEventListener('resize',fit);fit();})();
</script></body></html>
