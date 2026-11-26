<?php
require_once dirname(__DIR__,2).'/common.php';
if(!busan_news_split_active()){header('Location: '.G5_BBS_URL.'/board.php?bo_table=busan_news',true,302);exit;}
$g5['title']='OpenAI 인사이트';
require G5_PATH.'/head.php';
$esc=static function($s){return htmlspecialchars((string)$s,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');};
?>
<section class="bn-hub" aria-label="OpenAI 인사이트">
<header class="bn-insight-header">
<h1>OpenAI INSIGHT</h1>
<p class="bn-insight-tagline">소식을 넘어, 권리를 이해하다.</p>
<p class="bn-hub-intro">부산지부 AI 기자 챗지기자와 함께하는 지식정보 공간입니다. ChatGPT를 활용하는 부산지부 자체 서비스이며 OpenAI의 공식 서비스가 아닙니다.</p>
</header>
<div class="bn-hub-grid">
<?php foreach(busan_news_sections() as $id=>$name):
    $b=sql_fetch("SELECT * FROM {$g5['board_table']} WHERE bo_table='$id'",false);
    $group=!empty($b['gr_id'])?get_group($b['gr_id']):[];
    if((int)($b['bo_list_level']??99)!==1||(int)($b['bo_read_level']??99)!==1||empty($group)||!empty($group['gr_use_access'])||!empty($b['bo_use_cert']))continue;
    $table=$g5['write_prefix'].$id;
    $url=G5_BBS_URL.'/board.php?bo_table='.$id;
    $rows=sql_query("SELECT wr_id,wr_subject,wr_1,ca_name FROM `$table` WHERE wr_is_comment=0 AND wr_3<>'' AND FIND_IN_SET('secret',wr_option)=0 ORDER BY wr_1 DESC,wr_id DESC LIMIT 6",false);
?>
<section class="bn-hub-section"><h2><a href="<?=$esc($url)?>"><?=$esc($name)?></a></h2>
<div class="bn-hub-list">
<?php if($rows)while($r=sql_fetch_array($rows)):?>
<a href="<?=$esc($url.'&wr_id='.(int)$r['wr_id'])?>"><span><?=$esc($r['wr_subject'])?></span><small><?=$esc(($r['ca_name']?$r['ca_name'].' · ':'').$r['wr_1'])?></small></a>
<?php endwhile;?>
</div><a class="bn-hub-more" href="<?=$esc($url)?>">전체 기사 보기</a></section>
<?php endforeach;?>
<section class="bn-hub-section bn-rights-section"><h2><a href="<?=$esc(G5_BBS_URL.'/board.php?bo_table=note')?>">권리노트</a></h2>
<p>챗지기자가 전하는 현장 노동권 정보와 실무 상담 준비 안내입니다. 기존 회원 전용 열람 권한을 그대로 적용합니다.</p>
<a class="bn-hub-more" href="<?=$esc(G5_BBS_URL.'/board.php?bo_table=note')?>">권리노트 보기</a></section>
</div></section>
<?php require G5_PATH.'/tail.php'; ?>
