<?php
declare(strict_types=1);
/** Uses the existing registered Google callback; Notebook permission and tokens are separate. */
function n80_notebook_auth_url(array &$session,string $actor):string {
 $client=n80_notebook_client();$state='n80notebook_'.bin2hex(random_bytes(32));$verifier=rtrim(strtr(base64_encode(random_bytes(48)),'+/','-_'),'=');
 $session['n80_notebook_oauth']=['state'=>$state,'verifier'=>$verifier,'at'=>time(),'actor'=>$actor,'clientHash'=>hash('sha256',$client['client_id']),'revision'=>n80_notebook_read()['revision']??0];
 return 'https://accounts.google.com/o/oauth2/v2/auth?'.http_build_query(['client_id'=>$client['client_id'],'redirect_uri'=>NOA_LAB_ORIGIN.'/noa-bridge/lab-oauth.php','response_type'=>'code','scope'=>N80_NOTEBOOK_SCOPE,'access_type'=>'offline','prompt'=>'consent','state'=>$state,'code_challenge_method'=>'S256','code_challenge'=>rtrim(strtr(base64_encode(hash('sha256',$verifier,true)),'+/','-_'),'=')]);
}
function n80_notebook_oauth_pending(array &$session,array $query,string $actor):array {
 $pending=$session['n80_notebook_oauth']??[];
 if(!is_string($query['state']??null)||!is_string($pending['state']??null)||!hash_equals($pending['state'],$query['state'])||($pending['actor']??'')!==$actor||time()-($pending['at']??0)>600)throw new DomainException('notebook_oauth_expired');
 unset($session['n80_notebook_oauth']);
 if(isset($query['error']))throw new DomainException('notebook_oauth_denied');
 if(!is_string($query['code']??null)||$query['code']===''||strlen($query['code'])>4096)throw new DomainException('notebook_oauth_expired');return $pending;
}
function n80_notebook_oauth_finish(array $pending,string $code):void {
 n80_notebook_locked(function()use($pending,$code):void{
  $s=n80_notebook_read();$client=n80_notebook_client();
  if(($s['revision']??0)!==$pending['revision'])throw new DomainException('notebook_revision_conflict');
  if(!hash_equals($pending['clientHash'],hash('sha256',$client['client_id'])))throw new DomainException('notebook_google_setup_required');
  $r=n80_notebook_http('https://oauth2.googleapis.com/token','POST',['Content-Type: application/x-www-form-urlencoded'],http_build_query($client+['code'=>$code,'redirect_uri'=>NOA_LAB_ORIGIN.'/noa-bridge/lab-oauth.php','grant_type'=>'authorization_code','code_verifier'=>$pending['verifier']]));
  if(empty($r['access_token'])||empty($r['refresh_token']))throw new DomainException('notebook_offline_required');
  if(!in_array(N80_NOTEBOOK_SCOPE,explode(' ',(string)($r['scope']??'')),true))throw new DomainException('notebook_permission_required');
  $s['tokens']=lab_seal(['access_token'=>$r['access_token'],'refresh_token'=>$r['refresh_token'],'expiresAt'=>time()+max(60,(int)($r['expires_in']??3600))]);
  $s['connectionId']=bin2hex(random_bytes(16));$s['clientHash']=$pending['clientHash'];$s['revision']++;unset($s['verifiedAt'],$s['lastError'],$s['mcp'],$s['transport']);n80_notebook_write($s);
  // Authorization is preserved even when the API is not enabled yet.
  try{n80_notebook_api($s,'GET','notebooks',null,['pageSize'=>1]);$s['verifiedAt']=time();}
  catch(Throwable $e){$s['lastError']=n80_notebook_error($e);}
  n80_notebook_write($s);
 });
}
function n80_notebook_oauth_callback():never {
 require_once __DIR__.'/notebooklm.php';$actor=(string)($GLOBALS['member']['mb_id']??'');
 try{$pending=n80_notebook_oauth_pending($_SESSION,$_GET,$actor);n80_notebook_oauth_finish($pending,$_GET['code']);$_SESSION['n80_notebook_notice']='authorization_saved';}
 catch(Throwable $e){$_SESSION['n80_notebook_notice']=n80_notebook_error($e);}
 header('Location: /noa-notebooklm.php',true,303);exit;
}
