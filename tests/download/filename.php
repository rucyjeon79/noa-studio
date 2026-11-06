<?php
declare(strict_types=1);
define('_GNUBOARD_', true);
require __DIR__.'/../../deploy/noa-app/jukebox/core.php';
require __DIR__.'/../../bridge/music-download-core.php';
$db=new PDO('sqlite::memory:');
$db->exec('CREATE TABLE noa_jukebox_uploads(id TEXT,song_key TEXT,status TEXT,filename TEXT)');
$id=str_repeat('a',32);
$asset=['song_key'=>'song','source_evidence'=>json_encode(['upload_id'=>$id])];
function same($got,$want){if($got!==$want)throw new RuntimeException("Expected $want, got $got");}
$add=$db->prepare("INSERT INTO noa_jukebox_uploads VALUES(?,?,'ready',?)");
$add->execute([$id,'song','별빛 (최종).v2.MP3']);
$add->execute([str_repeat('b',32),'song','replacement.wav']);
same(nmd_filename($db,$asset,'곡 제목'),'별빛 (최종).v2.MP3');
$db->exec("UPDATE noa_jukebox_uploads SET filename='demo.final.wav' WHERE filename LIKE '%MP3'");
same(nmd_filename($db,$asset,'곡 제목'),'demo.final.mp3');
same(nmd_filename($db,[],'곡 제목'),'곡 제목.mp3');
same(nmd_receipt_filename(['filename'=>'원본.mp3','sha'=>'old'],'new','새 파일.mp3'),'원본.mp3');
same(nmd_receipt_filename(['title'=>'예전 곡','sha'=>'old'],'new','새 파일.mp3'),'예전 곡.mp3');
