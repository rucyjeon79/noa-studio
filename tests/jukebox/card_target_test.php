<?php
function nj_private(){return '/hosting/noastudio/noa-jukebox-private';}
function nj_file($path){return str_starts_with($path,'legacy/')?'/hosting/noastudio/html/noa-jukebox/'.$path:'/hosting/noastudio/noa-jukebox-private/media/'.$path;}
$code=file_get_contents(__DIR__.'/../../scripts/noa_suno_card_auto.php');
$start=strpos($code,'function nca_target(');$end=strpos($code,'$level=ob_get_level();',$start);
eval(substr($code,$start,$end-$start));
foreach(['사연곡/곡/track.mp3','legacy/곡/track.mp3'] as $path){
 $target=nca_target(['audio_path'=>$path],'song');
 if($target['targetBase'].'/'.$target['coverPath']!==dirname(nj_file($path)).'/cover.webp')throw new RuntimeException('cover_must_share_audio_directory');
}
if(nca_target(null,'one')['coverPath']===nca_target(null,'two')['coverPath'])throw new RuntimeException('cross_song_collision');
echo "AUTO_CARD_SAME_AUDIO_FOLDER_AND_SONG_ISOLATION_OK\n";
