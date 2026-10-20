<?php
declare(strict_types=1);
require dirname(__DIR__,2).'/bridge/sound-core.php';
function check($ok,$message){if(!$ok)throw new RuntimeException($message);}
check(noa_sound_suno(['sunoUrl'=>'https://suno.com/song/abc'])==='https://suno.com/song/abc','share reference retained');
foreach(['javascript:alert(1)','https://suno.com.evil.test/song/x','https://x@suno.com/song/x','https://suno.com:443/song/x','https://youtube.com/watch?v=abcdefghijk'] as $url)check(noa_sound_suno(['sunoUrl'=>$url])==='','reject noncanonical shares');
check(noa_sound_visible(['mediaAvailability'=>['status'=>'private']],false),'YouTube private status cannot hide an independently published Suno reference');
check(!noa_sound_visible(['visibility'=>'private'],false),'editorial privacy retained');
check(noa_sound_visible(['visibility'=>'private'],true),'admin review retained');
check(noa_sound_audio(['audioUrl'=>'https://suno.com/song/abc'],sys_get_temp_dir())==='','share cannot become audio');
$root=sys_get_temp_dir().'/noa-sound-'.bin2hex(random_bytes(8));mkdir($root.'/data/noa-audio',0700,true);
try{
 $pcm=str_repeat("\0",1600);$wav='RIFF'.pack('V',36+strlen($pcm)).'WAVEfmt '.pack('VvvVVvv',16,1,1,8000,16000,2,16).'data'.pack('V',strlen($pcm)).$pcm;
 $file=$root.'/data/noa-audio/test.wav';file_put_contents($file,$wav);
 $body=['audioUrl'=>'https://noastudio.ai.kr/data/noa-audio/test.wav'];
 check(noa_sound_audio($body,$root)==='','file existence alone is not verification');
 $body['audioVerification']=['status'=>'verified','sha256'=>hash('sha256',$wav)];check(noa_sound_audio($body,$root)===$body['audioUrl'],'verified original WAV playable');
 file_put_contents($file,'not audio');check(noa_sound_audio($body,$root)==='','modified file fails hash verification');
 $body['audioVerification']['sha256']=hash_file('sha256',$file);check(noa_sound_audio($body,$root)==='','text file with audio suffix rejected');
}finally{unlink($file);rmdir($root.'/data/noa-audio');rmdir($root.'/data');rmdir($root);}
check(noa_sound_cover(['thumbUrl'=>'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg'])==='','YT art cannot stand in for Suno original');
echo "Sound separation, privacy, integrity and format checks passed\n";

$recovered=['song_id'=>str_repeat('a',64),'identity_json'=>json_encode(['song','youtube','UCwYy9xsAqDFat6AV5UKrfgA','abcdefghijk']),'fields_json'=>json_encode(['title'=>'Recovered public song','privacyStatus'=>'public','registrationStatus'=>'needs_information']),'public_verified'=>1,'genre_id'=>'your-story','ep'=>''];
check(noa_sound_recovered($recovered,false)['youtubeId']==='abcdefghijk','public recovered song in shared read model');
$private=$recovered;$private['fields_json']=json_encode(['title'=>'Private','privacyStatus'=>'private']);
check(noa_sound_recovered($private,false)===null,'private recovery never exposed even if a stale public flag exists');
check(noa_sound_recovered($private,true)!==null,'owner can review private recovery');
$other=$recovered;$other['identity_json']=json_encode(['song','single','kpop-original','01']);check(noa_sound_recovered($other,true)===null,'legacy title is never used to match recovery');
echo "Recovered web/Android read model privacy checks passed\n";
