<?php
declare(strict_types=1);define('_GNUBOARD_',true);require __DIR__.'/../../bridge/catalog-recovery.php';
function rcheck(bool $x,string $m):void{if(!$x)throw new RuntimeException($m);}
$v=['id'=>'abcdefghijk','snippet'=>['channelId'=>'owner','title'=>'A song | Cover by AInoa (가사/Lyrics)','description'=>'','categoryId'=>'10'],'contentDetails'=>['duration'=>'PT3M12S'],'status'=>['privacyStatus'=>'private']];
rcheck(nr_kind($v)==='song','explicit owner cover');$e=nr_entity($v,'owner');rcheck(!$e['publicVerified']&&$e['genre']==='cover-reborn','private cover preserved');rcheck(!isset($e['fields']['lyricsBlock'],$e['fields']['sunoShareUrl'],$e['fields']['audioUrl']),'missing fields never fabricated');rcheck($e['id']===nr_entity($v,'owner')['id'],'platform identity stable');
foreach(['Which Part Is Best? | NOA Dance Vibes','10/11 Noa Dance | AI Artist Noa'] as $t){$v['snippet']['title']=$t;rcheck(nr_kind($v)==='promotion','dance promotion not a song');}
$v['snippet']['title']='Act.1 Playlist EP.1~10';rcheck(nr_kind($v)==='compilation','compilation not new song');$v['snippet']['title']='[세로] External Artist - Title';rcheck(nr_kind($v)==='review','unattributed excerpt held');
rcheck(nr_suno_url('Suno: https://suno.com/s/shortid')==='https://suno.com/s/shortid','short share URL retained exactly');rcheck(nr_suno_url('promotional https://suno.com/song/other')==='','unlabelled links not assumed');
echo "Recovery classification, private visibility, no fabricated fields, stable IDs, exact Suno share path passed.\n";
