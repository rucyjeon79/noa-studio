<?php
declare(strict_types=1);
define('_GNUBOARD_',true);require __DIR__.'/../../bridge/youtube-store.php';require __DIR__.'/../../bridge/world-mv.php';
function sep_check($value,$message){if(!$value)throw new RuntimeException($message);}
$run=['run_id'=>'fixture','channel_id'=>NWM_CHANNEL];$playlist=['id'=>NWM_PLAYLIST,'snippet'=>['channelId'=>NWM_CHANNEL],'status'=>['privacyStatus'=>'public']];
$items=[['video_id'=>'abcdefghijk'],['video_id'=>'abcdefghijk'],['video_id'=>'12345678901'],['video_id'=>'invalid']];
$ids=ny_verified_official_members($run,$playlist,$items);sep_check(count($ids)===2,'membership must deduplicate and reject invalid IDs');
$videos=['abcdefghijk'=>['id'=>'abcdefghijk','snippet'=>['title'=>'Unmatched official','channelId'=>NWM_CHANNEL],'status'=>['privacyStatus'=>'public','embeddable'=>true]],'12345678901'=>['id'=>'12345678901','snippet'=>['title'=>'EP.2 | Official MV','channelId'=>NWM_CHANNEL],'status'=>['privacyStatus'=>'public','embeddable'=>true]],'unofficial1'=>['id'=>'unofficial1','snippet'=>['title'=>'EP.3 ordinary music']]];
$ordinary=array_diff_key($videos,$ids);sep_check(array_keys($ordinary)===['unofficial1'],'title text must not exclude an ordinary video');
$world=nwm_build($playlist,$items,$videos);sep_check(count($world['videos'])===2,'official member without catalog match must remain visible in WORLD');sep_check($world['videos'][0]['songId']===null,'never invent a catalog link');
foreach(['wrong_channel','wrong_playlist','private']as$case){$p=$playlist;$r=$run;if($case==='wrong_channel')$r['channel_id']='other';if($case==='wrong_playlist')$p['id']='other';if($case==='private')$p['status']['privacyStatus']='private';try{ny_verified_official_members($r,$p,$items);throw new RuntimeException('unverified identity accepted');}catch(DomainException $e){}}
echo "NOA_OFFICIAL_MEMBERSHIP_AND_WORLD_PRESERVATION_OK\n";
