<?php
// Real renderers and controls, with disposable catalogue data only.
require __DIR__.'/../monthly/fixture.php';
$collections=file_get_contents($root.'/monthly-collections.php');
$collections=str_replace("title:'하루의 끝에',video:","title:['하루의 끝에','난 다시 살아가','빛으로 널','세상 끝에서도','너와의 모든 순간','Remember'][i%6],thumb:'/cover.jpg',video:",$collections);
file_put_contents($root.'/monthly-collections.php',$collections);
$world=file_get_contents($root.'/noa-world.php');
$world=str_replace('$tracks=[];', '$tracks=[["ep"=>1,"song_id"=>"fixture-song","fields"=>["title"=>"하루의 끝에","summary"=>"하루가 저문 자리에 남은 마음을 담은 노래."]]];', $world);
file_put_contents($root.'/noa-world.php',$world);
$home=json_decode(file_get_contents($root.'/discovery-fixture.json'),true);
foreach($home['discovery'] as &$pool){if(!is_array($pool))continue;foreach($pool as &$row){if($row['videoId']==='video000000'){$row['title']='EP.1 · 하루의 끝에 남겨진 아주 길고 긴 노래의 제목';$row+=['rank'=>1,'previousRank'=>1,'rankDelta'=>0,'rankState'=>'same'];}}unset($row);}unset($pool);
file_put_contents($root.'/discovery-fixture.json',json_encode($home));
echo "ALIGNMENT_FIXTURE_READY\n";
