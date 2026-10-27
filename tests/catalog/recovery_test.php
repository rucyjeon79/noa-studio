<?php
declare(strict_types=1);define('_GNUBOARD_',true);require __DIR__.'/../../bridge/catalog-recovery.php';
function rcheck(bool $x,string $m):void{if(!$x)throw new RuntimeException($m);}
$v=['id'=>'abcdefghijk','snippet'=>['channelId'=>'owner','title'=>'A song | Cover by AInoa (가사/Lyrics)','description'=>'','categoryId'=>'10'],'contentDetails'=>['duration'=>'PT3M12S'],'status'=>['privacyStatus'=>'private']];
rcheck(nr_kind($v)==='song','explicit owner cover');$e=nr_entity($v,NSC_CHANNEL,['abcdefghijk'=>'cover-reborn']);rcheck(!$e['publicVerified']&&$e['genre']==='cover-reborn','private cover with actual playlist membership');rcheck(nr_entity($v,NSC_CHANNEL)['genre']==='unclassified','cover title alone is not membership');rcheck(!isset($e['fields']['lyricsBlock'])&&!isset($e['fields']['sunoShareUrl'])&&!isset($e['fields']['audioUrl']),'missing fields never fabricated');rcheck($e['id']===nr_entity($v,NSC_CHANNEL)['id'],'platform identity stable');
foreach(['Which Part Is Best? | NOA Dance Vibes','10/11 Noa Dance | AI Artist Noa'] as $t){$v['snippet']['title']=$t;rcheck(nr_kind($v)==='promotion','dance promotion not a song');}
$v['snippet']['title']='Act.1 Playlist EP.1~10';rcheck(nr_kind($v)==='compilation','compilation not new song');$v['snippet']['title']='[세로] External Artist - Title';rcheck(nr_kind($v)==='review','unattributed excerpt held');
rcheck(nr_suno_url('Suno: https://suno.com/s/shortid')==='https://suno.com/s/shortid','short share URL retained exactly');rcheck(nr_suno_url('promotional https://suno.com/song/other')==='','unlabelled links not assumed');
rcheck(nr_title_overlap(['snippet'=>['title'=>'가족 사진 - Artist | Cover by AInoa']],[['fields'=>['title'=>'가족사진']]]),'spacing variant must be held rather than duplicated');
rcheck(nr_title_overlap(['snippet'=>['title'=>'겨울 사랑(OST) - Artist | Cover by AInoa']],[['fields'=>['title'=>'겨울사랑']]]),'OST annotation must not create duplicate');
echo "Recovery classification, private visibility, no fabricated fields, stable IDs, exact Suno share path passed.\n";

$v['snippet']['title']='[세로] AInoa with 람준파파 - 난 새하늘이야 | 새하늘용인대태권도 학원가';rcheck(nr_kind($v)==='song','song retained');rcheck(nr_entity($v,NSC_CHANNEL)['genre']==='unclassified','academy title never invents story membership');rcheck(nr_entity($v,NSC_CHANNEL,['abcdefghijk'=>'your-story'])['genre']==='your-story','actual story membership accepted');
