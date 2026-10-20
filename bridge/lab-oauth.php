<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/common.php';require_once __DIR__.'/lab-core.php';if(empty($is_member)&&($_GET['action']??'')==='start'){header('Location: /bbs/login.php?url='.rawurlencode('/noa-bridge/lab-oauth.php?action=start'));exit;}lab_admin();
header('Cache-Control: no-store');header('Referrer-Policy: no-referrer');
try {
 $s=lab_read();$secrets=lab_unseal($s['secrets']??null);$client=$s['config']['oauthClientId'];if(!$client||empty($secrets['oauthClientSecret']))throw new DomainException('oauth_configuration_required');$redirect=NOA_LAB_ORIGIN.'/noa-bridge/lab-oauth.php';
 if(($_GET['action']??'')==='start'){
  // The link is same-origin; account authorization happens on Google's consent screen.
  $_SESSION['noa_oauth_state']=bin2hex(random_bytes(32));$_SESSION['noa_oauth_started']=time();$_SESSION['noa_oauth_verifier']=rtrim(strtr(base64_encode(random_bytes(48)),'+/','-_'),'=');
  $query=['client_id'=>$client,'redirect_uri'=>$redirect,'response_type'=>'code','scope'=>'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly','access_type'=>'offline','prompt'=>'consent','include_granted_scopes'=>'true','state'=>$_SESSION['noa_oauth_state'],'code_challenge_method'=>'S256','code_challenge'=>rtrim(strtr(base64_encode(hash('sha256',$_SESSION['noa_oauth_verifier'],true)),'+/','-_'),'=')];header('Location: https://accounts.google.com/o/oauth2/v2/auth?'.http_build_query($query));exit;
 }
 if(!is_string($_GET['state']??null)||!hash_equals($_SESSION['noa_oauth_state']??'invalid',$_GET['state'])||time()-($_SESSION['noa_oauth_started']??0)>600||!is_string($_GET['code']??null))throw new DomainException('oauth_state_invalid');
 $verifier=$_SESSION['noa_oauth_verifier'];unset($_SESSION['noa_oauth_state'],$_SESSION['noa_oauth_started'],$_SESSION['noa_oauth_verifier']);
 $token=lab_https('https://oauth2.googleapis.com/token',[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>http_build_query(['code'=>$_GET['code'],'client_id'=>$client,'client_secret'=>$secrets['oauthClientSecret'],'redirect_uri'=>$redirect,'grant_type'=>'authorization_code','code_verifier'=>$verifier]),CURLOPT_HTTPHEADER=>['Content-Type: application/x-www-form-urlencoded']]);
 foreach(['youtube.upload','youtube.readonly','yt-analytics.readonly'] as $scope)if(!str_contains($token['scope']??'',$scope))throw new DomainException('required_oauth_scope_missing');
 if(empty($token['access_token'])||empty($token['refresh_token']))throw new DomainException('offline_authorization_required');
 $channels=lab_https('https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true',[CURLOPT_HTTPHEADER=>['Authorization: Bearer '.$token['access_token']]]);if(empty($channels['items']))throw new DomainException('youtube_channel_missing');
 lab_lock(function(&$state)use($channels,$token){foreach($channels['items'] as $c){$id=$c['id'];if(!preg_match('/^UC[A-Za-z0-9_-]{22}$/D',$id))throw new DomainException('invalid_channel');$state['channels'][$id]=['title'=>$c['snippet']['title'],'connectedAt'=>gmdate('c'),'autoEnabled'=>false,'tokens'=>lab_seal(['refresh_token'=>$token['refresh_token'],'scope'=>$token['scope']??''])];}lab_event($state,'youtube_connected','',(string)$GLOBALS['member']['mb_id']);});
 header('Location: /noa-ai-lab.php?connected=1');exit;
}catch(DomainException $e){http_response_code(400);echo 'YouTube 연결을 완료하지 못했습니다: '.htmlspecialchars($e->getMessage(),ENT_QUOTES,'UTF-8');}catch(Throwable $e){error_log('[noa-lab-oauth] '.get_class($e));http_response_code(503);echo 'YouTube 연결에 실패했습니다. 관리자 화면에서 설정과 Google 승인 범위를 확인해 주세요.';}
