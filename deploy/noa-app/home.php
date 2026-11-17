<?php
declare(strict_types=1);
if (!defined('_GNUBOARD_')) { http_response_code(403); exit; }
require_once __DIR__.'/engine/identity.php';
require_once __DIR__.'/noa-presence.php';
$noaFirst=n80_artist_presence('home');
$noaIdentity=n80_engine_identity();
header('Content-Type: text/html; charset=utf-8');header('Cache-Control: private, no-store');header('X-Content-Type-Options: nosniff');header('Referrer-Policy: strict-origin-when-cross-origin');
function noa_home_e(string $text):string{return htmlspecialchars($text,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');}
if(is_file(dirname(__DIR__).'/noa-bridge/notices.php'))require_once dirname(__DIR__).'/noa-bridge/notices.php';
$noa_notices=function_exists('nn_native_notices')?nn_native_notices(null,true):['items'=>[],'restricted'=>false];

function noa_home_banner(string $kind):void{
 $items=[
  'goods'=>['https://marpple.shop/kr/jr_lifestyle','AI Artist NOA × 람준파파','굿즈 절찬리 판매 중','마플샵에서 노아를 일상으로 만나세요.','굿즈 보러 가기','shop'],
  'youtube'=>['https://youtube.com/@ainoa_ramjunpapa?sub_confirmation=1','AI Artist NOA × 람준파파','유튜브에서 만나요','노아의 새로운 노래와 이야기가 도착하면 가장 먼저 만나보세요.','유튜브 구독하기','youtube'],
  'amt'=>['https://www.aimusictown.com/competition/2?entryId=353','AI MUSIC TOWN','람준파파의 AMT 스튜디오','마음에 머문 노래가 있다면, 따뜻한 응원 한 줄을 남겨 주세요.','스튜디오 응원하기','music'],
 ];
 [$url,$eyebrow,$title,$copy,$cta,$icon]=$items[$kind];
 $art=['goods'=>'/noa-assets/ecosystem/shop.jpg','youtube'=>n80_artist_artwork_url('act03'),'amt'=>'/noa-assets/editorial-starlight-studio.webp'][$kind];
 ?><a class="noa-home-banner" data-home-banner="<?=noa_home_e($kind)?>" href="<?=noa_home_e($url)?>" target="_blank" rel="noopener noreferrer" aria-label="<?=noa_home_e($eyebrow.' · '.$title.' · '.$cta)?> (새 창)"><img class="noa-home-banner-photo" loading="lazy" decoding="async" data-noa-artwork-approved="<?=$kind==='youtube'&&n80_artist_artwork_is_approved('act03')?'true':'false'?>" src="<?=noa_home_e($art)?>" alt=""><span class="noa-home-banner-copy"><small><?=noa_home_e($eyebrow)?></small><strong><?=noa_home_e($title)?></strong><span><?=noa_home_e($copy)?></span><b><?=noa_home_e($cta)?> <span aria-hidden="true">↗</span></b></span></a><?php
}
?><!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="google-site-verification" content="ITP_veSgoV5LrunUOy08ITLPesQCjQkb8WgHLbeNv-c"><meta name="naver-site-verification" content="1698e241d8bd56b9569f50bb12a136bb67d98bde"><meta name="viewport" content="width=device-width,initial-scale=1"><title><?=noa_home_e($noaIdentity['productName'])?></title><meta name="description" content="AI Artist Noa의 음악, EP 시리즈와 ACT 플레이리스트. 별무리와 함께하는 NOA STUDIO."><?php $invitePreview=is_string($_GET['invite']??null)&&preg_match('/^[a-f0-9]{48}$/D',$_GET['invite']); ?>
<meta property="og:type" content="website"><meta property="og:site_name" content="<?=noa_home_e($noaIdentity['productName'])?>">
<meta property="og:title" content="<?=$invitePreview?'별무리 초대장 · 친구도 나도 500P':'NOA STUDIO · 노아의 음악과 별무리의 이야기'?>">
<meta property="og:description" content="<?=$invitePreview?'초대 링크로 가입하면 친구와 나에게 각각 500P. 별무리와 함께 음악을 즐겨요.':'노아의 음악을 듣고, 별무리의 사연이 노래가 되는 곳.'?>">
<?php $noaShare=($invitePreview??false)?'/noa-assets/starlight-invite-v1.jpg':n80_artist_artwork_url('share'); ?>
<meta property="og:image" content="https://noastudio.ai.kr<?=noa_home_e($noaShare)?>"><meta property="og:image:type" content="<?=str_ends_with((string)(parse_url($noaShare,PHP_URL_PATH)?:''),'.webp')?'image/webp':'image/jpeg'?>"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="<?=$invitePreview?'NOA STUDIO 별무리 초대장 · 친구도 나도 500P':'NOA STUDIO 음악 컬렉션'?>">
<meta name="theme-color" content="#17191c"><meta name="artist" content="NOA"><meta name="noa-experience" content="눈으로 느끼고, 노래로 공감한다."><link rel="manifest" href="/noa-manifest.json"><link rel="stylesheet" href="/noa-ui.css?v=<?=hash_file('sha256',dirname(__DIR__).'/noa-ui.css')?>"><link rel="stylesheet" href="/noa-presence.css?v=<?=hash_file('sha256',dirname(__DIR__).'/noa-presence.css')?>"><script src="/noa-brand.js?v=n80-unified-20261110" defer></script><script src="/noa-ui.js?v=<?=hash_file('sha256',dirname(__DIR__) . '/noa-ui.js')?>" defer></script><script src="/noa-browse.js?v=20261021-p0-final" defer></script><script src="/noa-home.js?v=<?=hash_file('sha256',dirname(__DIR__).'/noa-home.js')?>" defer></script><script src="/noa-hero.js?v=<?=hash_file('sha256',dirname(__DIR__) . '/noa-hero.js')?>" defer></script><style id="noa-home-action-layout">
/* Lyrical Voice: keep longer editorial copy legible without moving actions or clipping cards. */
html body .noa-main>.noa-section[data-home-section]>.noa-section-head{
 display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px 12px;min-height:0
}
html body .noa-main>.noa-section[data-home-section]>.noa-section-head>h2{
 min-width:0;max-width:100%;line-height:1.45;word-break:keep-all;overflow-wrap:anywhere
}
html body .noa-main>.noa-section[data-home-section]>.noa-section-head>h2>span{
 min-width:0;overflow-wrap:anywhere;white-space:normal
}
html body .noa-main>.noa-section[data-home-section]>.noa-section-head>a{
 justify-self:end;align-self:start;white-space:nowrap;min-height:44px
}
html body .noa-main>.noa-section[data-home-section]>p.noa-muted{
 min-width:0;max-width:100%;line-height:1.65;white-space:normal;overflow-wrap:anywhere
}
html body .noa-main>.noa-section[data-home-section]>.noa-card-grid>:is(p.noa-muted,p.muted,p.empty,.noa-empty):only-child{
 grid-column:1/-1;max-width:100%;white-space:normal;overflow-wrap:anywhere
}
html body .noa-main>.noa-section[data-home-section] .noa-notice-empty p{
 max-width:100%;white-space:normal;overflow-wrap:anywhere
}
@media(max-width:360px){
 html body .noa-main>.noa-section[data-home-section]>.noa-section-head{column-gap:8px}
 html body .noa-main>.noa-section[data-home-section]>.noa-section-head>h2{font-size:16px}
}
</style><link rel="stylesheet" href="/noa-community.css?v=<?=is_file(dirname(__DIR__).'/noa-community.css')?hash_file('sha256',dirname(__DIR__).'/noa-community.css'):'home-boards-v1'?>"><script src="/noa-community.js?v=<?=is_file(dirname(__DIR__).'/noa-community.js')?hash_file('sha256',dirname(__DIR__).'/noa-community.js'):'home-boards-v1'?>" defer></script><link rel="stylesheet" href="/noa-listening.css?v=20261104-vip-care-1"><script defer src="/noa-listening-model.js?v=<?=hash_file('sha256',dirname(__DIR__) . '/noa-listening-model.js')?>"></script><script defer src="/noa-listening.js?v=<?=hash_file('sha256',dirname(__DIR__) . '/noa-listening.js')?>"></script><link rel="stylesheet" href="/noa-app/home-card-polish.css?v=<?=hash_file('sha256',__DIR__.'/home-card-polish.css')?>"></head><body><div class="noa-layout"><main class="noa-main">
<!-- noa-theme-scene:start -->
<div id="noa-theme-scene" class="noa-home-scene-stack">
 <section id="noa-presence-intro" class="noa-presence-scene" aria-label="AI 아티스트 노아와의 첫 만남">
  <div class="noa-theme-story">
   <p class="noa-presence-eyebrow"><?=noa_home_e($noaFirst['eyebrow']??'AI ARTIST · NOA')?></p>
   <h1 class="noa-presence-title"><?=noa_home_e($noaFirst['headlineFirst']??'눈으로 느끼고,')?><br><em><?=noa_home_e($noaFirst['headlineSecond']??'노래로 공감해요.')?></em></h1>
   <p class="noa-presence-hello"><?=noa_home_e($noaFirst['hello']??'안녕, 나는 노아야.')?></p>
   <p class="noa-presence-message"><?=noa_home_e($noaFirst['message']??'오늘은 내 노래가 네 곁에 머물렀으면 해.')?></p>
   <nav class="noa-scene-actions" aria-label="노아와 함께 시작하기"><a class="noa-button primary" href="/noa-music.php" data-noa-icon="play"><?=noa_home_e($noaFirst['musicAction']??'노아의 노래 듣기')?></a><a class="noa-scene-link" href="/noa-world.php" data-noa-document-link><?=noa_home_e($noaFirst['storyAction']??'노아의 이야기 읽기')?> <span aria-hidden="true">↗</span></a></nav>
   <p class="noa-presence-signature"><?=noa_home_e($noaFirst['signature']??'NOA · MUSIC · STORIES · STARLIGHT')?></p>
  </div>
  <figure class="noa-presence-portrait" data-noa-desktop-approved="<?=n80_artist_artwork_is_approved('homeDesktop')?'true':'false'?>" data-noa-mobile-approved="<?=n80_artist_artwork_is_approved('homeMobile')?'true':'false'?>">
   <picture><source media="(max-width:760px)" srcset="<?=noa_home_e(n80_artist_artwork_url('homeMobile'))?>"><img src="<?=noa_home_e(n80_artist_artwork_url('homeDesktop'))?>" width="1376" height="768" alt="NOA STUDIO의 AI 아티스트 노아 공식 초상" fetchpriority="high"></picture>
   <figcaption>AI ARTIST · NOA</figcaption>
  </figure>
 </section>
 <section class="noa-theme-scene noa-home-theme-card" aria-label="오늘의 테마와 테마 전환">
  <div class="noa-theme-story">
   <p class="noa-theme-kicker">STARLIGHT · 별빛이 모이는 밤</p>
   <h2 class="noa-home-theme-title">하루의 끝, 우리는 별무리가 된다.</h2>
   <p class="noa-theme-caption">일상을 마친 별 하나, 별무리가 되어 밤하늘을 밝히다.</p>
   <div class="noa-home-theme-control"><span class="noa-home-theme-label">테마 전환</span><div id="noa-home-theme-switcher" aria-label="테마 선택"></div></div>
  </div>
  <div class="noa-theme-visual" aria-hidden="true"><div class="noa-theme-art"><span class="noa-theme-celestial"></span><span class="noa-theme-stars"><i></i><i></i><i></i><i></i><i></i></span><span class="noa-theme-mountains"></span><span class="noa-theme-sea"></span></div></div>
 </section>
</div>
<!-- noa-theme-scene:end -->
<section class="noa-hero" data-home-section="hero"><div class="noa-hero-copy"><div class="noa-hero-intro"><span class="noa-eyebrow">노아의 음악, 장르별로 만나기</span><h2 id="noa-hero-genre">K-POP Original</h2><p id="noa-hero-description">한국어로 전하는 노아의 오리지널 음악 이야기.</p></div><div class="noa-hero-actions"><a class="noa-button primary" href="#noa-listening" data-noa-listen-now data-noa-icon="play">내 음악 바로 듣기</a><?php if(is_file(dirname(__DIR__).'/noa-sitemap.php')):?><nav class="noa-hero-services" data-home-section="sitemap" aria-label="사이트맵"><a class="noa-button" data-noa-icon="sitemap" href="/noa-sitemap.php">전체 서비스 보기</a></nav><?php endif;?></div><div class="noa-hero-discover"><h2>음악과 이야기 더 만나기</h2><div id="noa-hero-picks" class="noa-hero-picks"><a class="noa-hero-pick" href="/noa-music.php?group=original"><span><strong>오리지널송</strong><small>노아의 원곡 이야기</small></span></a><a class="noa-hero-pick" href="/noa-youtube.php?group=ep"><span><strong>EP 컬렉션</strong><small>장르와 ACT로 이어 듣기</small></span></a><a class="noa-hero-pick" href="/noa-lounge.php"><span><strong>커뮤니티 최신 소식</strong><small>별무리의 이야기 만나기</small></span></a><a class="noa-hero-pick" href="/noa-world.php"><span><strong>NOA WORLD · 공식 MV</strong><small>음악이 이어지는 세계관</small></span></a></div></div></div><div class="noa-hero-art"><picture><source media="(min-width:761px)" srcset="/noa-assets/splash/kpop-original-g2-a.jpg"><img id="noa-hero-poster" src="/noa-assets/splash/kpop-original-g2-a.jpg" alt="NOA STUDIO 장르 소개 영상 대표 이미지" loading="lazy" decoding="async" fetchpriority="low"></picture><video id="noa-hero-video" muted playsinline preload="none" aria-label="NOA STUDIO 장르 소개 영상" hidden></video><span id="noa-hero-status" class="noa-hero-status" role="status"></span></div></section>
<section id="noa-daily-fortune" aria-labelledby="nl-fortune-heading"><h2 id="nl-fortune-heading">오늘의 운세</h2><p>생년월일을 입력하면 나에게 맞는 음악과 오늘의 운세를 볼 수 있어요. 원하면 매일 오전 8시(한국 시간)에 운세 알림도 받을 수 있어요.</p><div class="nl-fortune-actions"><a href="/?setup=fortune#noa-daily-fortune" data-fortune-setup>생년월일 설정하기</a></div></section>
<section class="noa-section noa-notices" data-home-section="notices" aria-labelledby="noa-notices-heading"><div class="noa-section-head"><h2 id="noa-notices-heading">공지사항</h2><a href="/bbs/board.php?bo_table=notice" data-noa-icon="notice">전체 보기</a></div>
<?php if(!$noa_notices['items']):?><div class="noa-notice-empty"><p><?=$noa_notices['restricted']?'공지사항을 보려면 로그인해 주세요.':'아직 전해드릴 소식이 없어요. 새로운 이야기가 오면 이곳에 담아둘게요.'?></p></div><?php else:?>
<div class="noa-notice-list"><?php foreach($noa_notices['items'] as $i=>$notice):?><details class="noa-notice <?=$i===0?'noa-notice-featured':''?>" id="noa-notice-<?=$notice['id']?>" data-noa-disclosure>
<summary data-noa-document-link><span class="noa-notice-summary"><?php if($i===0):?><small>최근 공지 · <time datetime="<?=noa_home_e($notice['date'])?>"><?=noa_home_e($notice['date'])?></time></small><?php endif;?><strong><?=noa_home_e($notice['title'])?></strong><?php if($i===0):?><span class="noa-notice-excerpt"><?=noa_home_e($notice['excerpt'])?></span><?php endif;?></span><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m6 9 6 6 6-6"/></svg></summary>
<div class="noa-notice-body" data-noa-document-link><?php if(!empty($notice['welcomeGuide'])): echo $notice['welcomeGuide']; else:?><p><?=nl2br(noa_home_e($notice['body']))?></p><?php endif;?><a href="/bbs/board.php?bo_table=notice&amp;wr_id=<?=$notice['id']?>">게시판에서 보기</a><button class="noa-button" type="button" data-noa-collapse>접기</button></div></details><?php endforeach;?></div><?php endif;?></section>
<?php noa_home_banner('goods');?>

<?php noa_home_banner('youtube');?>
<section class="noa-section noa-story-entrance" id="noa-world" data-home-section="world" aria-labelledby="noa-story-title"><div><p class="noa-eyebrow">THE MUSIC STORY</p><h2 id="noa-story-title">한 곡의 끝에서,<br>다음 이야기가 시작됩니다.</h2><p>처음 사랑을 알게 된 순간부터 다시 마음을 여는 날까지.<br>네 개의 ACT, 마흔 개의 EP로 이어지는 노아의 음악 이야기.</p><a href="<?=empty($is_member)?'/bbs/login.php?url=%2Fnoa-world.php':'/noa-world.php'?>" data-noa-document-link>NOA WORLD 읽기 <span aria-hidden="true">↗</span></a><a href="/noa-about.php" data-noa-document-link>노아·노엘과 창작자 소개</a><a href="/noa-origin.php" data-noa-document-link>노아가 태어난 이야기</a></div><img src="<?=noa_home_e(n80_artist_artwork_url('homeStory'))?>" data-noa-artwork-approved="<?=n80_artist_artwork_is_approved('homeStory')?'true':'false'?>" alt="빛나는 길로 이어지는 음악 이야기의 문" loading="lazy"></section>
<section id="noa-listening" data-noa-listening="home" aria-label="맞춤 음원 추천"></section>
<?php if(is_file(__DIR__.'/monthly-banner.php'))require __DIR__.'/monthly-banner.php';?>
<section class="noa-section" data-home-section="recommendations"><div class="noa-section-head"><h2>오늘, 마음에 닿는 노래</h2><a href="/noa-youtube.php">전체 보기</a></div><p class="noa-muted">많은 마음이 머물렀던 노래를 만나보세요.</p><p id="noa-ranking-status" class="noa-muted" role="status">마음에 닿는 노래를 고르고 있어요.</p><div class="noa-card-grid" id="noa-featured"><p class="noa-muted" role="status">공개 영상 순위를 불러오는 중입니다.</p></div></section>
<section class="noa-section" data-home-section="ep"><div class="noa-section-head"><h2>EP 시리즈</h2><a href="/noa-youtube.php">전체 보기</a></div><p class="noa-muted">한 곡씩 이어지는 노아의 이야기를 EP로 만나보세요.</p><div class="noa-card-grid" id="noa-ep"><p class="noa-muted" role="status">공개 영상 순위를 불러오는 중입니다.</p></div></section>
<section class="noa-section" data-home-section="stories"><div class="noa-section-head"><h2>당신의 이야기, 우리의 음악</h2><a href="/noa-youtube.php?playlist=PLEPMKciKgvch9TGMAcBdKzhVt1QeYsfKB">전체 보기</a></div><p class="noa-muted">당신의 이야기가 음악이 되는 순간.</p><div class="noa-card-grid" id="noa-stories"><p class="noa-muted" role="status">공개 영상 순위를 불러오는 중입니다.</p></div></section>
<section class="noa-section" data-home-section="covers"><div class="noa-section-head"><h2>AInoa의 유명곡 커버</h2><a href="/noa-youtube.php?playlist=PLEPMKciKgvcjGmuO2ZcqrkHGfD5Qbb_Eb">전체 보기</a></div><p class="noa-muted">익숙한 선율이 노아의 목소리로 다시 피어납니다.</p><div class="noa-card-grid" id="noa-covers"><p class="noa-muted" role="status">공개 영상 순위를 불러오는 중입니다.</p></div></section>
<section class="noa-section" data-home-section="playlists"><div class="noa-section-head"><h2>플레이리스트</h2><a href="/noa-youtube.php#youtube-playlists">전체 보기</a></div><p class="noa-muted">이어 듣고 싶은 이야기와 ACT 플레이리스트.</p><div class="noa-card-grid" id="noa-acts"><p class="noa-muted" role="status">공개 영상 순위를 불러오는 중입니다.</p></div></section>
<p id="noa-playlist-basis" class="noa-muted"></p>
<?php noa_home_banner('amt');?>
<section class="noa-section" data-home-section="collections"><div class="noa-section-head"><div><p class="noa-eyebrow">FIND YOUR SOUND</p><h2>마음 따라 고르는 음악</h2></div></div><div class="noa-genres" id="noa-genres"></div></section>
<section class="noa-section noa-home-community" data-home-section="community" aria-labelledby="noa-home-community-heading"><div class="noa-section-head"><h2 id="noa-home-community-heading" data-noa-i18n="커뮤니티 최신 소식">커뮤니티 최신 소식</h2><a href="/noa-lounge.php">전체 보기</a></div><div id="noa-home-community" data-noa-community-home><p class="noa-muted" role="status">게시판 최신 글을 불러오는 중입니다.</p></div></section>
<?php require __DIR__.'/footer.php'; ?></main></div></body></html>
