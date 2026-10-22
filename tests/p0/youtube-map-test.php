<?php
// Run the operating view's actual mapping code against isolated SQL-shaped rows.
declare(strict_types=1);define('_GNUBOARD_',true);$root=dirname(__DIR__,2);require $root.'/bridge/youtube-core.php';require $root.'/bridge/sound-core.php';
$source=file_get_contents($root.'/deploy/noa-youtube.php');$start=strpos($source,'function noa_video_legacy_lyrics(');$end=strpos($source,'$legacyLyrics=[];',$start);eval(substr($source,$start,$end-$start));
function row(string $key,string $id,string $lyrics,array $extra=[]):array{return ['doc_key'=>$key,'payload'=>json_encode($extra+['body'=>['youtubeUrl'=>'https://www.youtube.com/watch?v='.$id,'lyricsBlock'=>$lyrics]])];}
$raw="[Verse]\n원문\n\n[Chorus]\n후렴";$rows=[row('one','AAAAAAAAAAA',$raw),row('two','BBBBBBBBBBB','different'),row('private','CCCCCCCCCCC','private',['visibility'=>'private']),row('dup1','DDDDDDDDDDD','one'),row('dup2','DDDDDDDDDDD','two')];
$map=noa_video_legacy_lyrics($rows,false);if($map['AAAAAAAAAAA']['one']!==$raw||isset($map['CCCCCCCCCCC'])||count($map['DDDDDDDDDDD'])!==2)throw new RuntimeException('legacy mapping/visibility/original preservation failed');
$videos=[];foreach(['AAAAAAAAAAA'=>'review','BBBBBBBBBBB'=>'rejected','DDDDDDDDDDD'=>'review','EEEEEEEEEEE'=>'conflict'] as $id=>$status)$videos[$id]=['status'=>['privacyStatus'=>'public','embeddable'=>true],'match'=>['status'=>$status]];
$songIndex=[];$admin=false;$legacyLyrics=$map;$start=strpos($source,'$mediaDetails=[];');$end=strpos($source,'function nye(',$start);eval(substr($source,$start,$end-$start));
if($mediaDetails['AAAAAAAAAAA']['lyrics']!==$raw||$mediaDetails['BBBBBBBBBBB']['lyrics']!==''||$mediaDetails['DDDDDDDDDDD']['lyrics']!==''||$mediaDetails['EEEEEEEEEEE']['lyrics']!=='')throw new RuntimeException('exact ID/rejection/ambiguity mapping failed');
echo "YOUTUBE_ORIGINAL_LYRIC_MAPPING_OK\n";
