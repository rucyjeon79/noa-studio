<?php
declare(strict_types=1);
define('_GNUBOARD_',true);
// Transport is injected: no credential or network is used in this fixture.
foreach(['CURLOPT_POST'=>47,'CURLOPT_POSTFIELDS'=>10015,'CURLOPT_HTTPHEADER'=>10023] as $k=>$v)if(!defined($k))define($k,$v);
function lab_unseal(?string $sealed):array{return $sealed?json_decode($sealed,true,512,JSON_THROW_ON_ERROR):[];}
require __DIR__.'/../../bridge/session-shorts-youtube.php';
function must(bool $condition,string $why):void{if(!$condition)throw new RuntimeException($why);}
$p=['channelId'=>'UC'.str_repeat('a',22),'destinationPlaylistId'=>'PL'.str_repeat('b',20)];
$s=['revision'=>19,'config'=>['oauthClientId'=>'client','workerEnabled'=>false],
 'secrets'=>json_encode(['oauthClientSecret'=>'private-secret']),
 'channels'=>[$p['channelId']=>['autoEnabled'=>false,'tokens'=>json_encode(['refresh_token'=>'private-refresh','scope'=>'https://www.googleapis.com/auth/youtube.upload'])]],
 'jobs'=>['old'=>['state'=>'cancelled']],'campaigns'=>['daily_shorts'=>['enabled'=>false]]];
$baseline=$s;$calls=[];$mode='ok';
$remote=static function(string $url,array $options)use(&$calls,&$mode,$p):array{
 $calls[]=$url;$n=count($calls);
 if($mode==='expired')throw new NoaOAuthFailure('invalid_grant',400);
 if($mode==='quota')throw new NoaOAuthFailure('quotaExceeded',403);
 if($mode==='raw')throw new RuntimeException('private-secret access_token private-refresh');
 if($n===1){must($url==='https://oauth2.googleapis.com/token','fixed token endpoint');parse_str($options[CURLOPT_POSTFIELDS],$fields);must($fields['grant_type']==='refresh_token'&&$fields['refresh_token']==='private-refresh','refresh existing authorization');return ['access_token'=>'private-access'];}
 must(!isset($options[CURLOPT_POST],$options[CURLOPT_POSTFIELDS]),'YouTube must be GET');
 must($options[CURLOPT_HTTPHEADER]===['Authorization: Bearer private-access'],'same in-memory token');
 $parts=parse_url($url);parse_str($parts['query'],$query);must($parts['host']==='www.googleapis.com','fixed YouTube host');
 if($n===2){must($parts['path']==='/youtube/v3/channels'&&$query['mine']==='true'&&!isset($query['id']),'ownership cannot be inferred from public ID lookup');return ['items'=>[['id'=>$mode==='wrong_channel'?'UC'.str_repeat('z',22):$p['channelId'],'snippet'=>['title'=>'<b>fixture channel</b>'],'contentDetails'=>['relatedPlaylists'=>['uploads'=>'UU'.str_repeat('a',22)]]]]];}
 must($n===3&&$parts['path']==='/youtube/v3/playlists'&&$query['id']===$p['destinationPlaylistId'],'fixed destination and at most 3 calls');
 return ['items'=>[['id'=>$p['destinationPlaylistId'],'snippet'=>['channelId'=>$mode==='wrong_playlist'?'UC'.str_repeat('z',22):$p['channelId'],'title'=>'Fixture playlist']]]];
};
$r=nd_shorts_youtube_check($s,$p,$remote);
must($r['state']==='checked'&&$r['readOnlyCheck']['providerCalls']===3&&$r['readOnlyCheck']['channelOwnerVerified']&&$r['readOnlyCheck']['destinationOwnerVerified'],'real adapter verifies both identities');
must($r['readOnlyCheck']['uploadScopeRecorded']&&!$r['readOnlyCheck']['productionVerified']&&$r['uploads']===0,'scope record is not publication');
must($s===$baseline&&!str_contains(json_encode($r),'private-'),'original unchanged and credentials not returned');
foreach(['wrong_channel'=>['youtube_channel_owner_mismatch',2],'wrong_playlist'=>['youtube_playlist_owner_mismatch',3],
 'expired'=>['youtube_reauthorize_required',1],'quota'=>['youtube_quota_limited',1],'raw'=>['youtube_connection_failed',1]] as $m=>[$error,$count]){
 $mode=$m;$calls=[];$r=nd_shorts_youtube_check($s,$p,$remote);
 must($r['state']==='check_failed'&&$r['readOnlyCheck']['error']===$error&&count($calls)===$count,'bounded failure '.$m);
 must($s===$baseline&&!str_contains(json_encode($r),'private-'),'failure preserves state and redacts secrets');
}
$calls=[];$noAuth=$s;unset($noAuth['channels']);$r=nd_shorts_youtube_check($noAuth,$p,$remote);
must(!$calls&&$r['readOnlyCheck']['error']==='youtube_offline_connection_required','absent credentials no network');
$calls=[];$r=nd_shorts_youtube_check($s,['channelId'=>'https://other.invalid','destinationPlaylistId'=>'PLbad'],$remote);
must(!$calls&&$r['readOnlyCheck']['error']==='youtube_target_invalid','no client-directed target');
echo "N80_SHORTS_YOUTUBE_CHECK_PASS owner and playlist identity, fixed bounded calls, no mutation, no credential leak\n";
