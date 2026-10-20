<?php
declare(strict_types=1);require __DIR__.'/../../bridge/world-core.php';
function check(bool $v):void{if(!$v)throw new RuntimeException('world visibility regression');}
check(nw_public(['public_verified'=>1,'owner_id'=>null]));check(!nw_public(['public_verified'=>0]));check(!nw_public(['public_verified'=>1,'owner_id'=>'member-one']));
$v=['classification'=>'official_mv','status'=>['privacyStatus'=>'public','embeddable'=>true],'snippet'=>['channelId'=>'UCwYy9xsAqDFat6AV5UKrfgA']];check(nw_video($v));
foreach(['private','unlisted'] as $status){$p=$v;$p['status']['privacyStatus']=$status;check(!nw_video($p));}
$p=$v;$p['status']['embeddable']=false;check(!nw_video($p));$p=$v;$p['snippet']['channelId']='other-owner';check(!nw_video($p));$p=$v;$p['classification']='music';check(!nw_video($p));
check(nw_text(['worldChapter'=>' 원문 '],'worldChapter')==='원문');check(nw_text(['worldChapter'=>['malformed']],'worldChapter')==='');check(nw_text(['lyricsBlock'=>'가사는 소설이 아님'],'worldChapter')==='');echo "World visibility, owner MV and prose isolation checks passed\n";
