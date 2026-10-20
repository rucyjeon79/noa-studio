<?php
declare(strict_types=1);if(!defined('_GNUBOARD_')){http_response_code(403);exit;}
class NoaOAuthFailure extends RuntimeException{
 public function __construct(public string $reason,public int $remoteStatus=0){parent::__construct($reason);}
}
function noa_oauth_http(string $url,array $options=[]):array{
 $u=parse_url($url);if(!in_array($u['host']??'',['oauth2.googleapis.com','www.googleapis.com'],true)||($u['scheme']??'')!=='https')throw new NoaOAuthFailure('invalid_provider');
 $c=curl_init($url);curl_setopt_array($c,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_CONNECTTIMEOUT=>3,CURLOPT_TIMEOUT=>8,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS]+$options);$raw=curl_exec($c);$status=(int)curl_getinfo($c,CURLINFO_RESPONSE_CODE);$errno=curl_errno($c);curl_close($c);if($raw===false)throw new NoaOAuthFailure('transport_'.$errno,$status);
 $data=json_decode($raw,true);if(!is_array($data))throw new NoaOAuthFailure('invalid_provider_response',$status);
 if($status<200||$status>=300){$error=$data['error']??'';$reason=is_string($error)?$error:($error['errors'][0]['reason']??$error['status']??'provider_error');if(!is_string($reason)||!preg_match('/^[a-zA-Z0-9_.-]{1,80}$/D',$reason))$reason='provider_error';throw new NoaOAuthFailure($reason,$status);}return $data;
}
function noa_oauth_exchange(string $client,string $secret,string $code,string $redirect,string $verifier,?callable $remote=null):array{
 $remote??='noa_oauth_http';return $remote('https://oauth2.googleapis.com/token',[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>http_build_query(['code'=>$code,'client_id'=>$client,'client_secret'=>$secret,'redirect_uri'=>$redirect,'grant_type'=>'authorization_code','code_verifier'=>$verifier]),CURLOPT_HTTPHEADER=>['Content-Type: application/x-www-form-urlencoded']]);
}
function noa_oauth_validate(array $token):void{
 foreach(['youtube.upload','youtube.readonly','yt-analytics.readonly'] as $scope)if(!in_array('https://www.googleapis.com/auth/'.$scope,explode(' ',trim($token['scope']??'')),true))throw new NoaOAuthFailure('required_oauth_scope_missing');
 if(empty($token['access_token'])||empty($token['refresh_token']))throw new NoaOAuthFailure('offline_authorization_required');
}
function noa_oauth_saved(array $pending,string $actor,string $session):array{
 if(($pending['actor']??'')!==$actor||($pending['session']??'')!==hash('sha256',$session)||($pending['expires']??0)<time())throw new NoaOAuthFailure('authorization_receipt_expired');return lab_unseal($pending['tokens']);
}
function noa_oauth_commit(array &$state,array $channels,array $token,string $receipt,string $actor):void{
 if(empty($channels['items']))throw new NoaOAuthFailure('youtube_channel_missing');foreach($channels['items'] as $c){$id=$c['id']??'';if(!preg_match('/^UC[A-Za-z0-9_-]{22}$/D',$id))throw new NoaOAuthFailure('invalid_channel');$state['channels'][$id]=['title'=>$c['snippet']['title'],'connectedAt'=>gmdate('c'),'autoEnabled'=>false,'tokens'=>lab_seal(['refresh_token'=>$token['refresh_token'],'scope'=>$token['scope']??''])];}
 unset($state['oauthPending'][$receipt],$state['oauthLastError']);lab_event($state,'youtube_connected','',$actor);
}
function noa_oauth_message(string $reason):string{
 return ['invalid_client'=>'Google Client ID와 Client Secret 조합이 유효하지 않습니다. 같은 OAuth 웹 클라이언트의 비밀값인지 확인하세요.','invalid_grant'=>'승인 코드가 만료되었거나 이미 사용되었습니다. 채널 연결을 새로 시작해야 합니다.','accessNotConfigured'=>'YouTube Data API v3가 Google Cloud 프로젝트에서 활성화되지 않았습니다. API를 활성화한 뒤 이 화면을 새로고침하면 보존된 승인 결과로 재시도합니다.','SERVICE_DISABLED'=>'YouTube Data API v3가 비활성 상태입니다. API 활성화 후 새로고침하세요.','authorization_receipt_expired'=>'보존된 승인 결과의 유효 시간이 지났습니다. 채널 연결을 다시 시작하세요.','oauth_state_invalid'=>'인증 요청의 유효 시간이 지났습니다. 채널 연결을 새로 시작하세요.','required_oauth_scope_missing'=>'요청한 세 가지 YouTube 권한이 모두 승인되지 않았습니다.','offline_authorization_required'=>'백그라운드 연동에 필요한 오프라인 승인이 누락되었습니다.'] [$reason]??(str_starts_with($reason,'transport_')?'서버에서 Google로 연결하는 중 통신 시간이 초과되거나 연결 오류가 발생했습니다.':'Google 승인 처리 중 오류가 발생했습니다. 아래 진단 코드를 확인하세요.');
}
