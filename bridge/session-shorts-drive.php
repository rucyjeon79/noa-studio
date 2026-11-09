<?php
declare(strict_types=1);
if(!defined('_GNUBOARD_')){http_response_code(403);exit;}
require_once __DIR__.'/lab-oauth-core.php';
require_once __DIR__.'/session-shorts.php';
const NSD_SCOPE='https://www.googleapis.com/auth/drive';

function nsd_parent(array $policy):string {
 $id=$policy['mediaStorage']['temporaryParentFolderId']??'';
 if(!is_string($id)||!preg_match('/^[A-Za-z0-9_-]{10,200}$/D',$id))throw new NoaOAuthFailure('drive_policy_required');
 return $id;
}
function nsd_client(array $s):array {
 $secret=lab_unseal($s['secrets']??null);$id=$s['config']['oauthClientId']??'';
 if(!is_string($id)||$id===''||empty($secret['oauthClientSecret']))throw new NoaOAuthFailure('oauth_configuration_required');
 return ['id'=>$id,'secret'=>$secret['oauthClientSecret']];
}
function nsd_start(array $s,array $p,string $owner,string $session,int $now):array {
 $client=nsd_client($s);$verifier=rtrim(strtr(base64_encode(random_bytes(48)),'+/','-_'),'=');
 $request=['state'=>'drive_'.bin2hex(random_bytes(32)),'verifier'=>$verifier,'actor'=>$owner,'session'=>hash('sha256',$session),
  'expires'=>$now+600,'clientId'=>$client['id'],'parent'=>nsd_parent($p),'previousId'=>$s['driveConnection']['id']??null];
 $query=['client_id'=>$client['id'],'redirect_uri'=>NOA_LAB_ORIGIN.'/noa-bridge/lab-oauth.php','response_type'=>'code',
  'scope'=>NSD_SCOPE,'access_type'=>'offline','prompt'=>'consent','include_granted_scopes'=>'false','state'=>$request['state'],
  'code_challenge_method'=>'S256','code_challenge'=>rtrim(strtr(base64_encode(hash('sha256',$verifier,true)),'+/','-_'),'=')];
 return ['request'=>$request,'url'=>'https://accounts.google.com/o/oauth2/v2/auth?'.http_build_query($query)];
}
function nsd_request(array $request,array $s,array $p,string $owner,string $session,string $state,int $now):void {
 if(($request['actor']??'')!==$owner||($request['session']??'')!==hash('sha256',$session)||($request['expires']??0)<=$now||
  !preg_match('/^drive_[a-f0-9]{64}$/D',$state)||!hash_equals($request['state']??'',$state))throw new NoaOAuthFailure('oauth_state_invalid');
 if(($request['clientId']??'')!==($s['config']['oauthClientId']??'')||($request['parent']??'')!==nsd_parent($p)||
  ($request['previousId']??null)!==($s['driveConnection']['id']??null))throw new NoaOAuthFailure('drive_connection_changed');
}
function nsd_token(array $token,bool $refreshRequired=true):void {
 if(!in_array(NSD_SCOPE,explode(' ',trim($token['scope']??'')),true))throw new NoaOAuthFailure('drive_scope_missing');
 if(!is_string($token['access_token']??null)||!preg_match('#^[A-Za-z0-9._~+/-]{1,8192}$#D',$token['access_token'])||
  ($refreshRequired&&(!is_string($token['refresh_token']??null)||$token['refresh_token']===''))||
  !is_numeric($token['expires_in']??null)||(int)$token['expires_in']<180)throw new NoaOAuthFailure('offline_authorization_required');
}
function nsd_folder(array $folder,string $parent):void {
 if(($folder['id']??'')!==$parent||($folder['mimeType']??'')!=='application/vnd.google-apps.folder'||
  ($folder['trashed']??true)!==false||($folder['shared']??true)!==false||($folder['ownedByMe']??false)!==true||
  ($folder['capabilities']['canAddChildren']??false)!==true)throw new NoaOAuthFailure('drive_folder_unavailable');
}
function nsd_refresh(array $client,array $saved,int $now,?callable $remote=null):array {
 $remote??='noa_oauth_http';
 $token=$remote('https://oauth2.googleapis.com/token',[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>http_build_query([
  'client_id'=>$client['id'],'client_secret'=>$client['secret'],'refresh_token'=>$saved['refresh_token'],'grant_type'=>'refresh_token']),
  CURLOPT_HTTPHEADER=>['Content-Type: application/x-www-form-urlencoded']]);
 $token['scope']??=$saved['scope'];nsd_token($token,false);
 return ['refresh_token'=>$token['refresh_token']??$saved['refresh_token'],'scope'=>$token['scope'],
  'access_token'=>$token['access_token'],'expires_at'=>$now+min(3600,(int)$token['expires_in'])];
}
/** Verify an actual refresh and the fixed private destination before committing. */
function nsd_verify(array $client,array $token,string $parent,int $now,?callable $remote=null,?callable $preserve=null):array {
 nsd_token($token);$remote??='noa_oauth_http';$saved=nsd_refresh($client,$token,$now,$remote);
 if($preserve)$preserve($saved+['expires_in'=>$saved['expires_at']-$now]);
 $folder=$remote('https://www.googleapis.com/drive/v3/files/'.rawurlencode($parent).'?fields=id,name,mimeType,trashed,shared,ownedByMe,capabilities(canAddChildren)',
  [CURLOPT_HTTPHEADER=>['Authorization: Bearer '.$saved['access_token']]]);
 nsd_folder($folder,$parent);return ['tokens'=>$saved,'folderName'=>(string)($folder['name']??'업로드 임시저장')];
}
function nsd_commit(array &$s,array $p,array $request,array $verified,string $owner,string $session,int $now):void {
 nsd_request($request,$s,$p,$owner,$session,$request['state'],$now);
 $s['driveConnection']=['id'=>bin2hex(random_bytes(16)),'owner'=>$owner,'parent'=>nsd_parent($p),'clientId'=>$request['clientId'],
  'folderName'=>$verified['folderName'],'tokens'=>lab_seal($verified['tokens']),'authorizedAt'=>gmdate('c',$now),'workerVerifiedAt'=>null];
 unset($s['driveOAuthPending'][hash('sha256',$request['state'])]);lab_event($s,'drive_authorized','',$owner);
}
function nsd_status(array $s,array $p,string $owner):array {
 $c=$s['driveConnection']??[];
 $connected=($c['owner']??'')===$owner&&($c['parent']??'')===nsd_parent($p)&&($c['clientId']??'')===($s['config']['oauthClientId']??'')&&!empty($c['tokens']);
 return ['ok'=>true,'connected'=>$connected,'state'=>$connected?'authorized':'drive_authorization_required',
  'folderName'=>$connected?($c['folderName']??''):null,'authorizedAt'=>$connected?($c['authorizedAt']??null):null,
  'workerVerifiedAt'=>$connected?($c['workerVerifiedAt']??null):null];
}
/** Called only after the worker's job/source/lease has been checked. */
function nsd_access(array $s,array $p,string $owner,int $now,?callable $remote=null):array {
 if(!nsd_status($s,$p,$owner)['connected'])throw new NoaOAuthFailure('drive_authorization_required');
 $c=$s['driveConnection'];$saved=lab_unseal($c['tokens']);
 if(($saved['expires_at']??0)<$now+120)$saved=nsd_refresh(nsd_client($s),$saved,$now,$remote);
 return ['connectionId'=>$c['id'],'tokens'=>$saved];
}
function nsd_access_commit(array &$s,array $p,string $owner,array $access):array {
 if(!nsd_status($s,$p,$owner)['connected']||($s['driveConnection']['id']??'')!==$access['connectionId'])throw new NoaOAuthFailure('drive_connection_changed');
 $s['driveConnection']['tokens']=lab_seal($access['tokens']);
 // Never send the refresh token or OAuth client secret to the runner.
 return ['ok'=>true,'access_token'=>$access['tokens']['access_token'],'expires_at'=>$access['tokens']['expires_at'],'folder_id'=>nsd_parent($p)];
}
function nsd_message(string $reason):string {
 return ['oauth_configuration_required'=>'기존 Google 연결 설정을 먼저 확인해 주세요.','drive_policy_required'=>'임시저장 폴더 설정을 확인해 주세요.',
  'drive_scope_missing'=>'Drive 권한이 승인되지 않았습니다.','drive_folder_unavailable'=>'지정된 비공개 임시저장 폴더에 접근할 수 없습니다. 폴더 소유 계정인지 확인해 주세요.',
  'drive_connection_changed'=>'연결 설정이 바뀌었습니다. 현재 화면에서 연결을 다시 시작해 주세요.','oauth_state_invalid'=>'연결 요청이 만료되었거나 현재 로그인과 일치하지 않습니다.',
  'access_denied'=>'Google 연결 승인이 취소되었습니다.','drive_authorization_required'=>'Google Drive 연결이 필요합니다.',
  'accessNotConfigured'=>'Google Cloud에서 이 OAuth 클라이언트의 Google Drive API를 켠 뒤 승인 결과를 다시 확인해 주세요.',
  'SERVICE_DISABLED'=>'Google Cloud에서 이 OAuth 클라이언트의 Google Drive API를 켠 뒤 승인 결과를 다시 확인해 주세요.',
  'request_verification_failed'=>'요청을 확인하지 못했습니다. 화면을 다시 열어 주세요.'] [$reason]??noa_oauth_message($reason);
}
function nsd_form_check(array $session,array $server,array $post):void {
 if(($server['REQUEST_METHOD']??'')!=='POST'||($server['HTTP_ORIGIN']??'')!==NOA_LAB_ORIGIN||
  !is_string($post['csrf']??null)||empty($session['noa_lab_csrf'])||!hash_equals($session['noa_lab_csrf'],$post['csrf']))throw new NoaOAuthFailure('request_verification_failed');
}
/** Admin-only page, served through the already registered OAuth callback URL. */
function nsd_page():never {
 global $member;$owner=(string)$member['mb_id'];$reason='';$notice='';$p=nd_shorts_policy();
 header('Cache-Control: no-store');header('Referrer-Policy: no-referrer');header('X-Frame-Options: DENY');
 $_SESSION['noa_lab_csrf']??=bin2hex(random_bytes(32));$url='/noa-bridge/lab-oauth.php?action=drive';
 try{
  $s=lab_read();$now=time();
  if(($_SERVER['REQUEST_METHOD']??'GET')==='POST'){
   nsd_form_check($_SESSION,$_SERVER,$_POST);
   if(($_POST['operation']??'')==='connect'){
    $start=nsd_start($s,$p,$owner,session_id(),$now);$_SESSION['noa_drive_oauth']=$start['request'];
    header('Location: '.$start['url']);exit;
   }
   if(($_POST['operation']??'')!=='retry')throw new NoaOAuthFailure('request_verification_failed');
  }
  $request=$_SESSION['noa_drive_oauth']??[];
  $callback=isset($_GET['state']);$retry=($_POST['operation']??'')==='retry';
  if($callback||$retry){
   $state=$callback?(is_string($_GET['state'])?$_GET['state']:''):($request['state']??'');
   nsd_request($request,$s,$p,$owner,session_id(),$state,$now);$receipt=hash('sha256',$state);
   if(isset($_GET['error']))throw new NoaOAuthFailure('access_denied');
   $pending=$s['driveOAuthPending'][$receipt]??null;
   if($pending){$token=noa_oauth_saved($pending,$owner,session_id());}
   else{
    if(!$callback||!is_string($_GET['code']??null)||strlen($_GET['code'])>8192)throw new NoaOAuthFailure('oauth_state_invalid');
    $client=nsd_client($s);$token=noa_oauth_exchange($client['id'],$client['secret'],$_GET['code'],NOA_LAB_ORIGIN.'/noa-bridge/lab-oauth.php',$request['verifier']);nsd_token($token);
    lab_lock(function(&$current)use($request,$p,$owner,$token,$receipt){
     nsd_request($request,$current,$p,$owner,session_id(),$request['state'],time());
     $current['driveOAuthPending']=array_filter($current['driveOAuthPending']??[],fn($r)=>($r['expires']??0)>time());
     $current['driveOAuthPending'][$receipt]=['tokens'=>lab_seal($token),'actor'=>$owner,'session'=>hash('sha256',session_id()),'expires'=>$request['expires']];
    });
   }
   // Provider I/O is outside the shared N80 state lock.
   $verified=nsd_verify(nsd_client($s),$token,nsd_parent($p),time(),null,function($refreshed)use($request,$p,$owner,$receipt){
    lab_lock(function(&$current)use($request,$p,$owner,$receipt,$refreshed){
     nsd_request($request,$current,$p,$owner,session_id(),$request['state'],time());
     $current['driveOAuthPending'][$receipt]['tokens']=lab_seal($refreshed);
    });
   });
   lab_lock(fn(&$current)=>nsd_commit($current,$p,$request,$verified,$owner,session_id(),time()));
   unset($_SESSION['noa_drive_oauth']);$_SESSION['noa_drive_notice']='Google Drive 연결을 확인했습니다. 실제 파일 저장 결과는 N80 자동 실행 후 표시됩니다.';
   header('Location: '.$url);exit;
  }
 }catch(NoaOAuthFailure $e){$reason=$e->reason;}catch(Throwable $e){$reason='internal_operation_failed';error_log('[n80-drive] '.get_class($e));}
 if(isset($_GET['state'])){$_SESSION['noa_drive_error']=$reason;header('Location: '.$url);exit;}
 $reason=$reason?:($_SESSION['noa_drive_error']??'');$notice=$_SESSION['noa_drive_notice']??'';unset($_SESSION['noa_drive_error'],$_SESSION['noa_drive_notice']);
 $s=lab_read();$status=nsd_status($s,$p,$owner);$request=$_SESSION['noa_drive_oauth']??[];
 $retry=($request['expires']??0)>time()&&isset($s['driveOAuthPending'][hash('sha256',$request['state']??'')]);
 $e=static fn($v)=>htmlspecialchars((string)$v,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');
 require __DIR__.'/session-shorts-drive-view.php';exit;
}
