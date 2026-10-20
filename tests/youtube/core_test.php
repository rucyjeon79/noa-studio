<?php
declare(strict_types=1);define('_GNUBOARD_',true);require __DIR__.'/../../bridge/youtube-core.php';
function check_yt(bool $ok,string $why):void{if(!$ok)throw new RuntimeException($why);}
check_yt(ny_video_id('https://youtu.be/abcdefghijk?t=2')==='abcdefghijk','short link');check_yt(ny_video_id('https://evil.test/watch?v=abcdefghijk')===null,'lookalike host');
$s=['song_id'=>str_repeat('a',64),'genre_id'=>'jpop','ep'=>'1','language'=>'ja','version_name'=>'cover','fields'=>['title'=>'Remember','youtubeUrl'=>'https://youtube.com/watch?v=abcdefghijk','sunoUrl'=>'https://suno.com/song/stable-source']];$v=['id'=>'abcdefghijk','snippet'=>['title'=>'Remember','description'=>'']];
check_yt(ny_match($v,[$s])['songId']===$s['song_id'],'existing video identity');$other=$s;$other['song_id']=str_repeat('b',64);$other['language']='ko';check_yt(ny_match($v,[$s,$other])['status']==='conflict','language variants must not collapse');
$v['id']='newvideo123';check_yt(ny_match($v,[$s])['songId']===null,'title-only cannot auto link');$v['snippet']['description']='https://suno.com/song/stable-source';check_yt(ny_match($v,[$s])['songId']===$s['song_id'],'Suno identity');check_yt(ny_match($v,[$s,$other])['songId']===null,'Suno reused by variants');
$r=[];check_yt(ny_page($r,'items',['nextPageToken'=>'next'])===true,'page token');try{ny_page($r,'items',['nextPageToken'=>'next']);throw new RuntimeException('loop accepted');}catch(DomainException $e){check_yt($e->getMessage()==='pagination_loop','loop detection');}
$m=ny_rollup(['x'=>['views'=>10,'averageViewDuration'=>5,'averageViewPercentage'=>20],'y'=>['views'=>30,'averageViewDuration'=>25,'averageViewPercentage'=>80]],['x','y','y']);check_yt($m['views']===40.0&&$m['averageViewDuration']===20.0&&$m['averageViewPercentage']===65.0,'distinct videos and weighted means');
echo "YouTube: URL identity, Suno identity, variant ambiguity, title-only review, page loops, distinct weighted metrics passed.\n";
