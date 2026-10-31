<?php
require_once dirname(__DIR__).'/common.php';
$space=defined('NOA_ECOSYSTEM_SPACE')?NOA_ECOSYSTEM_SPACE:'lounge';
$meta=['shop'=>['NOA SHOP','음악을, 일상에.','좋아하는 마음을 오래 간직하는 방법.','shop.jpg'],'lounge'=>['별무리 라운지','별 하나가 모이면 별무리가 된다.','노래를 듣고 떠오른 이야기, 별무리에게 들려주세요.','lounge.webp'],'lab'=>['CREATOR LAB','함께 만드는 다음 장면.','한 번의 피드백이 다음 작품을 바꿉니다.','creator.webp']][$space];
$community_groups=['소식 · 안내'=>[],'이야기 · 교류'=>[],'신청 · 참여'=>[]];
if($space==='lounge'){
 if(!defined('NOA_SITEMAP_REGISTRY_ONLY'))define('NOA_SITEMAP_REGISTRY_ONLY',true);
 require_once dirname(__DIR__).'/noa-sitemap.php';
 $logged=!empty($is_member)&&!empty($member['mb_id']);
 [$native_boards]=noa_sitemap_native_content($g5??[],$member??[],$logged,($is_admin??'')==='super');
 foreach($native_boards as $b){
  $id=(string)$b['bo_table'];if(!preg_match('/^[A-Za-z0-9_]{1,20}$/D',$id))continue;
  $label=trim(strip_tags((string)$b['bo_subject']))?:$id;
  $group=preg_match('/notice|공지|안내|소식|news/ui',$id.' '.$label)?'소식 · 안내':(preg_match('/request|신청|문의|제안|event|이벤트/ui',$id.' '.$label)?'신청 · 참여':'이야기 · 교류');
  $community_groups[$group][]=[$label,$id==='song_request'?'/noa-lounge.php?category=story&view=list#ec-content':'/noa-lounge.php?board='.rawurlencode($id).'#ec-content',(string)($b['noa_condition']??'')];
 }
}
$welcomeGuide=null;
if($space==='lounge' && ($_GET['board']??'')==='notice'){
 require_once dirname(__DIR__).'/noa-bridge/notices.php';
 $published=nn_native_notices(1);
 $welcomeGuide=$published['items'][0]['welcomeGuide']??null;
}
function nec_e($x){return htmlspecialchars($x,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');}
$ver=substr(hash('sha256',hash_file('sha256',dirname(__DIR__).'/noa-ecosystem.js').hash_file('sha256',dirname(__DIR__).'/noa-ecosystem.css')),0,24);
?><!doctype html><html lang="ko" data-noa-section="<?=nec_e($space)?>"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="<?=nec_e($meta[2])?>"><title><?=nec_e($meta[0])?> | NOA STUDIO</title><link rel="stylesheet" href="/noa-ui.css"><link rel="stylesheet" href="/noa-ecosystem.css?v=<?=$ver?>"><script src="/noa-ui.js" defer></script><link rel="stylesheet" href="/noa-community.css"><script src="/noa-community.js" defer></script><script src="/noa-ecosystem.js?v=<?=$ver?>" defer></script></head><body class="noa-page"><?php if($welcomeGuide!==null):?><template id="noa-published-welcome" data-guest="<?=empty($member['mb_id'])?'1':'0'?>"><?=$welcomeGuide?></template><?php endif;?><main id="ecosystem" data-space="<?=nec_e($space)?>"><section class="ec-hero"><div><p class="ec-eyebrow"><?=nec_e($meta[0])?></p><h1><?=nec_e($meta[1])?></h1><p><?=nec_e($meta[2])?></p><div class="ec-actions" id="ec-hero-actions"></div></div><img src="/noa-assets/ecosystem/<?=nec_e($meta[3])?>" alt="<?=$space==='shop'?'실제 판매 중인 노아 텀블러':'음악과 함께하는 공간'?>" fetchpriority="high"></section><div id="ec-status" role="status" aria-live="polite"></div><nav class="ec-tools" id="ec-tools" aria-label="콘텐츠 찾기"></nav><section id="ec-content" aria-label="<?=nec_e($meta[0])?> 콘텐츠"><p>불러오는 중입니다.</p></section><?php if($space==='lounge'):?><section id="community-boards" class="noa-board-directory" aria-labelledby="community-boards-title"><h2 id="community-boards-title">게시판 모아보기</h2><p>소식, 이야기, 신청을 한곳에서 찾아보세요.</p><div class="noa-board-groups"><?php foreach($community_groups as $title=>$links):if(!$links)continue;?><section class="noa-board-group"><h3><?=nec_e($title)?></h3><?php foreach($links as [$label,$url,$condition]):?><a href="<?=nec_e($url)?>"><span><?=nec_e($label)?></span><?php if($condition):?><small><?=nec_e($condition)?></small><?php endif;?></a><?php endforeach;?><?php if(!$links):?><p class="noa-muted">등록된 게시판이 없습니다.</p><?php endif;?></section><?php endforeach;?></div></section><?php endif;?><aside class="ec-crosslinks"><a href="/noa-music.php">음악 듣기 ↗</a><?php if(($member['mb_level']??0)>=5):?><a href="/noa-support.php">받은 후원·정산 ↗</a><?php endif;?><a href="/noa-sitemap.php">전체 메뉴 ↗</a></aside></main></body></html>
