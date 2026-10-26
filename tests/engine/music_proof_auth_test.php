<?php
declare(strict_types=1);
require_once __DIR__.'/../../bridge/music-proof-auth.php';require_once __DIR__.'/../../bridge/member-access.php';
$key=str_repeat('a',64);$now=1793000000;$count=0;
function mpa(bool $ok,string $label):void{global $count;$count++;if(!$ok)throw new RuntimeException($label);}
function mps(string $target,string $range=''):array{global $key,$now;$ts=(string)$now;$nonce=str_repeat('b',32);return ['REQUEST_METHOD'=>'GET','REQUEST_URI'=>$target,'HTTP_RANGE'=>$range,'HTTP_X_N80_AVAILABILITY_CHECK'=>'1','HTTP_X_N80_MEDIA_TIMESTAMP'=>$ts,'HTTP_X_N80_MEDIA_NONCE'=>$nonce,'HTTP_X_N80_MEDIA_SIGNATURE'=>hash_hmac('sha256',nmr_message($target,$range,$ts,$nonce),$key)];}
foreach([['/noa-music.php',''],['/noa-music-detail.php?key=single%3Atest%3A01',''],['/noa-app/jukebox/stream.php?key=single%3Atest%3A01&type=audio','bytes=0-4095']] as [$path,$range]){
 $s=mps($path,$range);mpa(nmr_verify($s,$key,$now),'valid_scope');
 foreach(['REQUEST_METHOD'=>'POST','REQUEST_URI'=>'/adm/member_form.php','HTTP_RANGE'=>'bytes=0-','HTTP_X_N80_AVAILABILITY_CHECK'=>'0','HTTP_X_N80_MEDIA_SIGNATURE'=>str_repeat('0',64),'HTTP_X_N80_MEDIA_NONCE'=>str_repeat('c',32)]as $field=>$bad){$v=$s;$v[$field]=$bad;mpa(!nmr_verify($v,$key,$now),'bound_'.$field);}
 mpa(!nmr_verify($s,str_repeat('z',64),$now),'wrong_key');mpa(!nmr_verify($s,$key,$now+181),'expired');mpa(!nmr_verify($s,$key,$now-181),'future');
}
foreach(['/bbs/register_form_update.php','/noa-bridge/membership.php?action=vip','/noa-app/jukebox/download.php?key=a','/noa-music.php?qa=1','/noa-music.php/../adm/','//noa-music.php','/noa-music-detail.php?key=a%26extra%3D1','/noa-music-detail.php?key=a&extra=1','/noa-app/jukebox/stream.php?key=a&type=cover']as $path)mpa(!nmr_verify(mps($path),$key,$now),'no_other_route');
mpa(!nmr_verify([], $key,$now),'no_headers');mpa(!nmr_verify(mps('/noa-music.php'),'',$now),'missing_key');
// Pure proof verification never changes native member, session or role state.
$_SESSION=['keep'=>'unchanged'];$member=[];$s=mps('/noa-music.php');nmr_verify($s,$key,$now);mpa($member===[]&&$_SESSION===['keep'=>'unchanged'],'no_authentication_state_mutation');
$_SERVER=['REQUEST_METHOD'=>'GET','REQUEST_URI'=>'/noa-music.php','HTTP_X_N80_AVAILABILITY_CHECK'=>'1'];$access=nam_access();mpa(!$access['music']&&!$access['member']&&!$access['admin']&&!$access['write'],'unsigned_header_never_grants');
$_SERVER['HTTP_X_N80_MEDIA_SIGNATURE']=str_repeat('0',64);mpa(!nam_access()['music'],'forged_header_never_grants');
echo 'N80_SCOPED_MUSIC_READ_AUTH_OK '.$count.PHP_EOL;
