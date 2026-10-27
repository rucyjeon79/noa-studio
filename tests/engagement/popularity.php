<?php
require __DIR__.'/../popularity/core_test.php';
$metrics=['song:s'=>['likes'=>2,'comments'=>3],'video:00000000000'=>['likes'=>7,'comments'=>4],'playlist:playlist123'=>['likes'=>1,'comments'=>2]];
$r=np_build($raw,$songs,$lists,$members,['s'=>3,'t'=>5],$cats,['s'=>['kpop-original'],'t'=>['collection']],$metrics);
check($r['totals']['likes']===10&&$r['totals']['comments']===9,'reaction sets deduplicate songs/videos/playlists');
check($r['totals']['score']===$b['totals']['score']+19,'one point per active like/comment');
check($r['groups']['playlists'][0]['score']===199+8+19,'playlist includes direct and unique child reactions');
$rank=array_column($r['groups']['songs'],null,'songId');check($rank['s']['likes']===2&&$rank['s']['comments']===3,'song reactions not multiplied by videos');
echo "ENGAGEMENT_RANKING_PASS\n";
