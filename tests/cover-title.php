<?php
require __DIR__.'/../bridge/music-readmodel.php';
$artist=noa_music_original_artist(['originalArtist'=>' ','originalSinger'=>'  김광석  ']);
foreach([
 ['기다려 줘','cover-reborn',$artist,'기다려 줘 - 김광석'],
 ['기다려 줘 - 김광석','cover-reborn',$artist,'기다려 줘 - 김광석'],
 ['기다려 줘','cover-reborn','','기다려 줘'],
 ['기다려 줘','your-story',$artist,'기다려 줘']
] as [$title,$genre,$originalArtist,$expected]){
 if(noa_music_display_title(compact('title','genre','originalArtist'))!==$expected)throw new RuntimeException('cover title mismatch');
}
echo "COVER_TITLE_ALIAS_DUPLICATE_EMPTY_NONCOVER_OK\n";
