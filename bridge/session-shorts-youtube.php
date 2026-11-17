<?php
declare(strict_types=1);
if(!defined('_GNUBOARD_')){http_response_code(403);exit;}
require_once __DIR__.'/lab-oauth-core.php';

/** Fixed read-only Google calls; no upload, settings write, retry or pagination. */
function nd_shorts_youtube_check(array $state,array $policy,?callable $remote=null):array {
 $remote??='noa_oauth_http';$calls=0;
 $result=['ok'=>true,'state'=>'check_failed','processed'=>0,'uploads'=>0,
  'readOnlyCheck'=>['scope'=>'existing_youtube_connection','sourceRevision'=>(int)($state['revision']??0),
   'businessStateWritten'=>false,'providerCalls'=>0,'productionVerified'=>false]];
 $check=&$result['readOnlyCheck'];
 try{
  $channel=(string)($policy['channelId']??'');$playlist=(string)($policy['destinationPlaylistId']??'');
  if(!preg_match('/^UC[A-Za-z0-9_-]{22}$/D',$channel)||!preg_match('/^PL[A-Za-z0-9_-]{10,80}$/D',$playlist))throw new DomainException('youtube_target_invalid');
  $saved=$state['channels'][$channel]??[];$tokens=lab_unseal($saved['tokens']??null);$secrets=lab_unseal($state['secrets']??null);
  if(empty($tokens['refresh_token'])||empty($state['config']['oauthClientId'])||empty($secrets['oauthClientSecret']))throw new DomainException('youtube_offline_connection_required');
  $call=static function(string $url,array $options=[])use($remote,&$calls):array{$calls++;return $remote($url,$options);};
  $token=$call('https://oauth2.googleapis.com/token',[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>http_build_query([
   'client_id'=>$state['config']['oauthClientId'],'client_secret'=>$secrets['oauthClientSecret'],
   'refresh_token'=>$tokens['refresh_token'],'grant_type'=>'refresh_token']),CURLOPT_HTTPHEADER=>['Content-Type: application/x-www-form-urlencoded']]);
  if(!is_string($token['access_token']??null)||$token['access_token']==='')throw new DomainException('youtube_reauthorize_required');
  $headers=[CURLOPT_HTTPHEADER=>['Authorization: Bearer '.$token['access_token']]];
  $mine=$call('https://www.googleapis.com/youtube/v3/channels?'.http_build_query([
   'part'=>'id,snippet,contentDetails','mine'=>'true','maxResults'=>50]),$headers);
  $found=null;foreach($mine['items']??[] as $item)if(($item['id']??null)===$channel){$found=$item;break;}
  if(!$found)throw new DomainException(!empty($mine['nextPageToken'])?'youtube_channel_page_unverified':'youtube_channel_owner_mismatch');
  $uploads=$found['contentDetails']['relatedPlaylists']['uploads']??'';
  if(!is_string($uploads)||!preg_match('/^UU[A-Za-z0-9_-]{22}$/D',$uploads))throw new DomainException('youtube_uploads_playlist_missing');
  $lists=$call('https://www.googleapis.com/youtube/v3/playlists?'.http_build_query([
   'part'=>'id,snippet,status','id'=>$playlist,'maxResults'=>1]),$headers);
  $destination=$lists['items'][0]??[];
  if(($destination['id']??null)!==$playlist)throw new DomainException('youtube_destination_playlist_missing');
  if(($destination['snippet']['channelId']??null)!==$channel)throw new DomainException('youtube_playlist_owner_mismatch');
  $scope=preg_split('/\s+/',trim((string)($token['scope']??$tokens['scope']??'')))?:[];
  $check+=['channelId'=>$channel,'channelTitle'=>mb_substr((string)($found['snippet']['title']??''),0,150),
   'destinationPlaylistId'=>$playlist,'playlistTitle'=>mb_substr((string)($destination['snippet']['title']??''),0,150),
   'channelOwnerVerified'=>true,'destinationOwnerVerified'=>true,
   'uploadScopeRecorded'=>in_array('https://www.googleapis.com/auth/youtube.upload',$scope,true)
     ||in_array('https://www.googleapis.com/auth/youtube',$scope,true)
     ||in_array('https://www.googleapis.com/auth/youtube.force-ssl',$scope,true)];
  $result['state']='checked';
 }catch(NoaOAuthFailure $e){
  $reason=$e->reason;$check['error']=match(true){
   $reason==='invalid_grant'||$e->remoteStatus===401=>'youtube_reauthorize_required',
   $reason==='invalid_client'=>'youtube_client_configuration_invalid',
   in_array($reason,['accessNotConfigured','SERVICE_DISABLED'],true)=>'youtube_api_disabled',
   in_array($reason,['quotaExceeded','dailyLimitExceeded','rateLimitExceeded','userRateLimitExceeded'],true)||$e->remoteStatus===429=>'youtube_quota_limited',
   in_array($reason,['insufficientPermissions','ACCESS_TOKEN_SCOPE_INSUFFICIENT'],true)||$e->remoteStatus===403=>'youtube_permission_required',
   default=>'youtube_connection_failed'};
 }catch(DomainException $e){
  $allowed=['youtube_target_invalid','youtube_offline_connection_required','youtube_reauthorize_required',
   'youtube_channel_page_unverified','youtube_channel_owner_mismatch','youtube_uploads_playlist_missing',
   'youtube_destination_playlist_missing','youtube_playlist_owner_mismatch'];
  $check['error']=in_array($e->getMessage(),$allowed,true)?$e->getMessage():'youtube_connection_failed';
 }catch(Throwable $e){$check['error']='youtube_connection_failed';}
 $check['providerCalls']=$calls;return $result;
}
