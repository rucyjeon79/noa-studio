<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';
require_once __DIR__.'/noa-bridge/storage.php';
require_once __DIR__.'/noa-bridge/lounge-discovery.php';
header('Cache-Control: private, no-store');
$views=nld_views();
$view=is_string($_GET['view']??null)?$_GET['view']:'new';
$query=is_string($_GET['q']??'')?trim($_GET['q']??''):'';
$by=is_string($_GET['by']??'all')?($_GET['by']??'all'):'all';
$fields=['all'=>'제목과 내용','title'=>'제목','body'=>'내용','name'=>'작성자 이름'];
if (!isset($fields[$by])||!mb_check_encoding($query,'UTF-8')||mb_strlen($query)>80){http_response_code(400);exit('검색 조건을 확인해 주세요.');}
$viewUrl=static fn($next)=>'?'.http_build_query(array_filter(['view'=>$next,'q'=>$query,'by'=>$query!==''?$by:''],static fn($v)=>$v!==''));
$viewer=!empty($is_member)?(string)($member['mb_id']??''):'';
$own=in_array($view,['mine','replies'],true);
$login=$own && $viewer==='';$rows=[];$error=false;
if (!isset($views[$view])) {http_response_code(404);exit('찾을 수 없는 목록입니다.');}
if (!$login) {
    try {$rows=nld_read(noa_bridge_pdo(),$g5,$view,$viewer,time(),$query,$by);}
    catch(Throwable $e){http_response_code(503);$error=true;error_log('[lounge-discovery] '.get_class($e));}
}
$e=static fn($s)=>htmlspecialchars((string)$s,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');
$descriptions=['new'=>'최근 올라온 공개 글 10개를 확인하세요.','week'=>'최근 7일에 올라온 공개 글을 공감과 공개 댓글이 많은 순서로 보여드려요.','month'=>'최근 30일에 올라온 공개 글을 공감과 공개 댓글이 많은 순서로 보여드려요.','likes'=>'공감을 받은 공개 글을 공감 수가 많은 순서로 보여드려요.','comments'=>'최근 공개 댓글을 누르면 대화가 이어지는 원문으로 이동해요.','mine'=>'라운지와 공개 게시판에 내가 쓴 최근 글 10개예요.','replies'=>'공개 글에 내가 남긴 최근 공개 댓글 10개예요.'];
?><!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title><?=$e($views[$view])?> · 라운지 둘러보기 | NOA STUDIO</title><link rel="stylesheet" href="/noa-ui.css"><link rel="stylesheet" href="/noa-lounge-discovery.css?v=1"><script defer src="/noa-ui.js"></script></head>
<body class="noa-page"><main class="nld-main"><a class="noa-button" href="/noa-lounge.php">별무리 라운지로</a><h1><?=$own?'내 커뮤니티 활동':'라운지 둘러보기'?></h1>
<nav class="nld-tabs" aria-label="글 모아보기"><?php foreach($views as $id=>$label):if(in_array($id,['mine','replies'],true)!==$own)continue;?><a href="<?=$e($viewUrl($id))?>" <?=$id===$view?'aria-current="page"':''?>><?=$e($label)?></a><?php endforeach;?></nav>
<?php if(!$login):?><form class="nld-search" method="get" role="search" aria-label="라운지 글·댓글 검색"><input type="hidden" name="view" value="<?=$e($view)?>"><label>검색 범위<select name="by"><?php foreach($fields as $id=>$label):?><option value="<?=$e($id)?>" <?=$by===$id?'selected':''?>><?=$e($label)?></option><?php endforeach;?></select></label><label>검색어<input type="search" maxlength="80" name="q" value="<?=$e($query)?>" placeholder="찾고 싶은 이야기"></label><button type="submit">검색</button><?php if($query!==''):?><a href="?view=<?=$e($view)?>">검색 해제</a><?php endif;?></form><?php endif;?>
<section aria-labelledby="nld-heading"><h2 id="nld-heading"><?=$e($views[$view])?></h2><p class="noa-muted"><?=$e($descriptions[$view])?></p>
<?php if($login):?><a class="noa-button" href="/noa-login.php?url=<?=rawurlencode('/noa-lounge-discovery.php?view='.$view)?>">로그인하고 보기</a>
<?php elseif($error):?><p role="status">목록을 불러오지 못했어요. 잠시 후 다시 열어 주세요.</p>
<?php elseif(!$rows):?><p class="nld-empty"><?=$query!==''?'검색어와 일치하는':'아직 표시할'?> <?=$view==='comments'||$view==='replies'?'공개 댓글':'글'?>이 없어요.</p>
<?php else:?><ol class="nld-list"><?php foreach($rows as $row):?><li><a href="<?=$e(nld_destination($row))?>" data-noa-document-link><strong><?=$e(mb_substr(nld_plain($row['title']),0,120))?></strong><?php if($row['excerpt']!==''):?><span><?=$e(mb_substr(nld_plain($row['excerpt']),0,110))?></span><?php endif;?><small><?=$e($row['board_name'])?> · <?=gmdate('Y.m.d',(int)$row['stamp']+32400)?><?=$view==='likes'?' · 공감 '.(int)$row['score']:''?></small></a></li><?php endforeach;?></ol><?php endif;?></section>
<?php if($own):?><a class="noa-button" href="/noa-my.php#noa-my-activity">MY 내 활동</a><?php endif;?></main></body></html>
