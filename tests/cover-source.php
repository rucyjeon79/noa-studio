<?php
declare(strict_types=1);define('_GNUBOARD_',true);
require __DIR__.'/../bridge/sound-core.php';require __DIR__.'/../deploy/noa-app/jukebox/core.php';
function expect_source($a,$b){if($a!==$b)throw new RuntimeException('cover_audio_source_boundary');}
$old='https://suno.com/s/oldSource';$new='https://suno.com/s/newSource';$a=['source_url'=>$old,'source_evidence'=>json_encode(['permission'=>'original','coverSourceUrl'=>$new])];
expect_source(nj_asset_source($a,'cover'),$new);expect_source(nj_asset_source($a,'audio'),$old);
expect_source(nj_asset_source(['source_url'=>$old],'cover'),$old);
foreach(['https://evil.example/a','http://suno.com/s/a','https://user:password@suno.com/s/a','https://suno.com:443/s/a','javascript:alert(1)'] as $bad)expect_source(nj_asset_source(['source_url'=>$old,'source_evidence'=>json_encode(['coverSourceUrl'=>$bad])],'cover'),$old);
expect_source(nj_asset_source(['source_url'=>$old,'source_evidence'=>'broken'],'cover'),$old);
echo "COVER_PROVENANCE_SEPARATE_FROM_AUDIO_OK\n";
