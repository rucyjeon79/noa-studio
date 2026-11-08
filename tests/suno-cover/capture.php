<?php
declare(strict_types=1);
define('_GNUBOARD_', true);
function check($ok, $message) { if (!$ok) throw new RuntimeException($message); }
$base = sys_get_temp_dir().'/noa-cover-test-'.bin2hex(random_bytes(5));
mkdir($base.'/public/noa-bridge', 0700, true);
mkdir($base.'/public/noa-app/jukebox', 0700, true);
copy('bridge/suno-cover.php', $base.'/public/noa-bridge/suno-cover.php');
copy('deploy/noa-app/jukebox/core.php', $base.'/public/noa-app/jukebox/core.php');
copy('deploy/noa-app/jukebox/media-location.php', $base.'/public/noa-app/jukebox/media-location.php');
require 'bridge/sound-core.php';
require $base.'/public/noa-bridge/suno-cover.php';
register_shutdown_function(static function() use ($base) {
    foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($base, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST) as $f) {
        $f->isDir() ? rmdir($f->getPathname()) : unlink($f->getPathname());
    }
    rmdir($base);
});
$id = '12345678-1234-1234-1234-123456789abc';
$a = 'https://suno.com/s/short';
$b = 'https://suno.com/song/'.$id;
$image = 'https://cdn2.suno.ai/card.jpg';
foreach (['https://suno.com@external.test/x','https://www.suno.com:80/x','http://suno.com/x','https://suno.com.example/x','https://cdn2.suno.ai/x'] as $blocked) check(!nsc_allowed($blocked,true), 'unsafe page URL');
check(nsc_metadata($a, "<link href='$b' rel='canonical'><meta content='$image' property='og:image'>") === [$id,$image], 'share link metadata');
try { nsc_metadata($a, "<meta content='$image' property='og:image'>"); throw new LogicException('accepted album card'); } catch (RuntimeException $e) {}
function card(int $red): string { $im=imagecreatetruecolor(80,100);imagefill($im,0,0,imagecolorallocate($im,$red,23,32));ob_start();imagepng($im);return nsc_webp(ob_get_clean()); }
$db=new PDO(getenv('NOA_MYSQL_DSN'), 'root', 'noa-test-only', [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
nj_schema($db);
$key='suno-cover-fixture';
$doc=['title'=>'테스트 곡','body'=>['sunoUrl'=>$a]];
$db->beginTransaction();
$doc=nsc_attach($db,$key,$doc,['source'=>$a,'id'=>$id,'bytes'=>card(10)]);
$db->commit();
$first=nj_find($db,$key);
check(nsc_preview($first,$key,$a)!=='', 'initial verified cover missing');
check($first['cover_path']===$doc['body']['cardImageLocation'], 'record pointer');
$dir=nj_private().'/media/track';
mkdir($dir,0700,true);file_put_contents($dir.'/song.mp3','audio fixture');
$db->prepare("UPDATE noa_jukebox_assets SET source_url=?,audio_path='track/song.mp3',audio_bytes=13,status='ready' WHERE song_key=?")->execute([$a,$key]);
$doc['body']['sunoUrl']=$b;
$db->beginTransaction();
check(nsc_attach($db,$key,$doc,['source'=>$a,'id'=>$id,'bytes'=>card(20)])===$doc, 'stale source applied');
$doc=nsc_attach($db,$key,$doc,['source'=>$b,'id'=>$id,'bytes'=>card(30)]);
$db->commit();
$second=nj_find($db,$key);
check(nsc_preview($second,$key,$b)!=='' && nsc_preview($second,$key,$a)==='', 'replacement provenance');
check($second['cover_sha256']!==$first['cover_sha256'] && dirname($second['cover_path'])==='track', 'replacement file');
check($second['source_url']===$a && $second['audio_path']==='track/song.mp3' && $second['status']==='ready', 'audio modified');
check(nsc_prepare($db,$key,$b)===null, 'existing cover fetched again');
check(nsc_attach($db,$key,$doc,null)===$doc, 'unavailable URL must remain saveable');
echo "SUNO_COVER_STORE_VERIFIED\n";
