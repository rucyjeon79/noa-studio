<?php
declare(strict_types=1);
// Isolated session/stream-hook fixture. No real account, SQL, audio or production writes.
$root=sys_get_temp_dir().'/noa-play-hook-'.bin2hex(random_bytes(6));
mkdir($root.'/html/noa-app/jukebox',0700,true);mkdir($root.'/html/noa-bridge',0700,true);mkdir($root.'/noa-ai-lab',0700,true);
file_put_contents($root.'/noa-ai-lab/worker.key',str_repeat('a',64));
copy(__DIR__.'/../../deploy/noa-app/jukebox/stream-popularity.php',$root.'/html/noa-app/jukebox/stream-popularity.php');
file_put_contents($root.'/html/noa-bridge/popularity-plays.php', <<<'STUB'
<?php
function np_ready(PDO $db):bool{return true;}
function np_policy(PDO $db):array{return ['values'=>['playbackIntegrationEnabled'=>$GLOBALS['enabled'],'sessionMaxSeconds'=>1800]];}
function nt_annotate_records(PDO $db,array $r):array{return [['catalogSongId'=>$GLOBALS['mapping']]];}
function np_start_play(PDO $db,string $actor,string $sid,string $songKey,bool $admin,int $now):array{$GLOBALS['starts']++;return ['token'=>str_repeat('b',64)];}
function np_stream_started(PDO $db,string $token,string $songKey,bool $admin,int $now):bool{$GLOBALS['hooks']++;return $GLOBALS['hookOk'];}
STUB);
define('_GNUBOARD_',true);define('G5_PATH',$root.'/html');
require $root.'/html/noa-app/jukebox/stream-popularity.php';
$db=new class extends PDO { public function __construct(){} };
$enabled=true;$mapping='catalog-song';$starts=0;$hooks=0;$hookOk=true;$member=[];
function demand(bool $ok,string $message):void{if(!$ok)throw new RuntimeException($message);}
try{
 $s=[];$doc=['_kind'=>'single'];nj_track_verified_audio($db,$doc,'one',false,$s,1000);
 demand($starts===1&&$hooks===1&&isset($s['noa_popularity_active']['one']),'verified stream did not bind session');
 nj_track_verified_audio($db,$doc,'one',false,$s,1001);demand($starts===1&&$hooks===1,'range/seek duplicated session');
 nj_track_verified_audio($db,$doc,'two',true,$s,1001);demand($starts===1,'admin stream counted');
 $enabled=false;nj_track_verified_audio($db,$doc,'two',false,$s,1001);demand($starts===1,'disabled policy bypassed');
 $enabled=true;$mapping=null;nj_track_verified_audio($db,$doc,'two',false,$s,1001);demand($starts===1,'unconfirmed song counted');
 $mapping='catalog-song';$s['noa_popularity_pending']['two']=['token'=>str_repeat('c',64),'createdAt'=>1000];
 $hookOk=false;nj_track_verified_audio($db,$doc,'two',false,$s,1001);demand(isset($s['noa_popularity_pending']['two'])&&!isset($s['noa_popularity_active']['two']),'failed hook consumed pending');
 $hookOk=true;nj_track_verified_audio($db,$doc,'two',false,$s,1002);demand(!isset($s['noa_popularity_pending']['two'])&&$s['noa_popularity_active']['two']['token']===str_repeat('c',64),'legacy pending contract broken');
 nj_track_verified_audio($db,$doc,'one',false,$s,3000);demand($starts===2,'expired session not renewed');
 echo "stream_tracking: 8 isolated assertions passed\n";
}finally{
 foreach(['/html/noa-app/jukebox/stream-popularity.php','/html/noa-bridge/popularity-plays.php','/noa-ai-lab/worker.key']as $p)unlink($root.$p);
 foreach(['/html/noa-app/jukebox','/html/noa-app','/html/noa-bridge','/html','/noa-ai-lab','']as $p)rmdir($root.$p);
}
