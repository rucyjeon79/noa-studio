<?php
// Called by core.php. Use the same cleaned, edited fields as the music page.
require_once dirname(__DIR__,2).'/bridge/sound-core.php';
function song_moods(string $title,string $lyrics,array $metadata=[]):array{
    return n80_listening_mood_scores(['title'=>$title,'lyrics'=>noa_sound_lyrics($lyrics)],$metadata);
}
$examples = [
    'calm'=>['잠시 쉬어 가','고요한 창가에서 숨을 고르네'],
    'focus'=>['한 음씩','잡념을 비우고 한 가지에 마음을 모아'],
    'energy'=>['다시 일어나','쓰러져도 끝까지 달려'],
    'comfort'=>['작은 위로','오늘은 네 곁에 있을게'],
];
foreach ($examples as $mood=>[$title,$lyrics]) {
    $fromTitle=song_moods($title,'')[$mood]??0;
    $fromLyrics=song_moods('',$lyrics)[$mood]??0;
    check($fromTitle>0 && $fromLyrics>0,"title-only and lyric-only: $mood");
    check(song_moods($title,$lyrics)[$mood]>max($fromTitle,$fromLyrics),"independent evidence: $mood");
    check(song_moods('',str_repeat($lyrics."\n",15))[$mood]===$fromLyrics,"repeated chorus: $mood");
}
check(song_moods('그 밤','달빛이 파도 위로 번지네')===[],'directional 위로 is not consolation');
check(song_moods('','[Verse: focus, not alone] (vocal: rise again)')===[],'production cues are not sung words');
check(song_moods('',"(네 곁에 있을게)")['comfort']>0,'sung parenthetical counts');
foreach (['comfort'=>['By Your Side','ひとりじゃない','ไม่เป็นไร'],'calm'=>['静かな夜'],'focus'=>['Clear My Mind'],'energy'=>['ลุกขึ้นอีกครั้ง']] as $mood=>$lines)
    foreach ($lines as $line) check((song_moods('',$line)[$mood]??0)>0,'multilingual motif: '.$mood);

// Exercise legacy source packages using only song words, without style metadata.
$folder=dirname(__DIR__,2).'/deploy/noastudio/noa/data/live/곡/your-story/기본';
$counts=array_fill_keys(array_keys($examples),0);$files=glob($folder.'/*.json');
foreach ($files as $path) {
    $record=json_decode(file_get_contents($path),true,512,JSON_THROW_ON_ERROR);
    $pkg=$record['pkg'];$scores=song_moods($record['title'],$pkg['lyricsBlock']??'');
    foreach (array_keys($scores) as $mood) $counts[$mood]++;
}
check(count($files)>0 && min($counts)>0,'all four moods found in story collection');
echo 'STORY_WORD_MATCHES '.json_encode(['songs'=>count($files),'matches'=>$counts])."\n";
