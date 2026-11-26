<?php
require_once dirname(__DIR__,2).'/common.php';
if(!busan_news_split_active()){header('Location: '.G5_BBS_URL.'/board.php?bo_table=busan_news',true,302);exit;}
$g5['title']='OpenAI 뉴스룸';
require G5_PATH.'/head.php';
$esc=static function($s){return htmlspecialchars((string)$s,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');};
?>
<section class="bn-hub" aria-label="뉴스룸">
<h1>OpenAI 뉴스룸</h1>
<p class="bn-hub-intro">부산지부 AI 기자 챗지기자가 전하는 소식입니다. ChatGPT를 활용하며 OpenAI 공식 뉴스룸과는 관계가 없습니다.</p>
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
</div></section>
<?php require G5_PATH.'/tail.php'; ?>
