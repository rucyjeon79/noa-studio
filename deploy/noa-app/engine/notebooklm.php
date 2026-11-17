<?php
declare(strict_types=1);
/** N80 NotebookLM: on-demand official API adapter. No scheduler or content auto-export. */
require_once __DIR__.'/hub.php';
require_once __DIR__.'/mcp.php';
const N80_NOTEBOOK_SCOPE='https://www.googleapis.com/auth/notebook';
function n80_notebook_read():array {return n80_hub_read(n80_hub_root(),'notebooklm.json',['revision'=>0,'receipts'=>[]]);}
function n80_notebook_write(array $s):void {n80_hub_write(n80_hub_root(),'notebooklm.json',$s);}
function n80_notebook_locked(callable $fn):mixed {
 $root=n80_hub_root();n80_hub_directory($root);$p=$root.'/notebooklm.lock';
 if(is_link($p))throw new RuntimeException('notebook_storage_error');
 $f=fopen($p,'c');if(!$f)throw new RuntimeException('notebook_storage_error');chmod($p,0600);
 if(!flock($f,LOCK_EX|LOCK_NB)){fclose($f);throw new DomainException('notebook_busy');}
 try{return $fn();}finally{flock($f,LOCK_UN);fclose($f);}
}
function n80_notebook_client():array {
 $s=lab_read();$secret=lab_unseal($s['secrets']??null);
 $client=(string)($s['config']['oauthClientId']??'');$secret=(string)($secret['oauthClientSecret']??'');
 if($client===''||$secret==='')throw new DomainException('notebook_google_setup_required');
 return ['client_id'=>$client,'client_secret'=>$secret];
}
function n80_notebook_status(?array $s=null):array {
 $s??=n80_notebook_read();$authorized=!empty($s['tokens']);$verified=(int)($s['verifiedAt']??0);$error=$s['lastError']??null;
 if($authorized){$client=(string)(lab_read()['config']['oauthClientId']??'');if(!hash_equals((string)($s['clientHash']??''),hash('sha256',$client))){$error='notebook_reconnect_required';$verified=0;}}
 $state=!$authorized?'authorization_required':(!empty($error)?'check_required':($verified>time()-3600?'connected':'verification_required'));
 return ['module'=>'N80 NotebookLM','state'=>$state,'authorized'=>$authorized,'verifiedAt'=>$verified?:null,'revision'=>(int)($s['revision']??0),
  'connectionId'=>$s['connectionId']??'', 'lastError'=>$error,'api'=>'official_personal_preview','automaticSync'=>false,
  'capabilities'=>['notebooks.list','notebooks.get','notebooks.create','notebooks.update','sources.list','sources.create','sources.get'],
  'unavailable'=>['query','audio_generation','binary_upload','drive_import'],
  'mcp'=>n80_mcp_status($s,$authorized&&$error!=='notebook_reconnect_required'),
  'receipts'=>array_values(array_reverse(array_slice($s['receipts']??[],-15,null,true)))];
}
function n80_notebook_resource(string $name,bool $source=false):string {
 $uuid='[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}';
 if(!preg_match('~^notebooks/'.$uuid.($source?'/sources/'.$uuid:'').'$~D',$name))throw new InvalidArgumentException('notebook_invalid_resource');return $name;
}
function n80_notebook_title(mixed $title):string {
 if(!is_string($title)||!preg_match('//u',$title)||trim($title)===''||preg_match_all('/./us',$title)>500)throw new InvalidArgumentException('notebook_invalid_title');return trim($title);
}
function n80_notebook_source(array $b):array {
 $out=['displayName'=>n80_notebook_title($b['title']??null)];$kind=$b['kind']??'';
 if($kind==='text'){
  $value=$b['text']??null;if(!is_string($value)||!preg_match('//u',$value)||trim($value)===''||strlen($value)>1000000)throw new InvalidArgumentException('notebook_invalid_text');
  return $out+['mimeType'=>'text/markdown','textContent'=>['content'=>$value]];
 }
 if($kind!=='url'||!is_string($b['url']??null))throw new InvalidArgumentException('notebook_invalid_source');
 $url=trim($b['url']);$u=parse_url($url);$host=strtolower($u['host']??'');
 if(strlen($url)>4096||!filter_var($url,FILTER_VALIDATE_URL)||($u['scheme']??'')!=='https'||isset($u['user'])||isset($u['pass'])||isset($u['port'])||!str_contains($host,'.')||str_ends_with($host,'.local')||filter_var(trim($host,'[]'),FILTER_VALIDATE_IP)||in_array($host,['localhost','docs.google.com','drive.google.com'],true))throw new InvalidArgumentException('notebook_invalid_url');
 return $out+['webContent'=>['url'=>$url]];
}
/** Endpoint allowlist, bounded response, no redirects and no hidden retries of mutations. */
function n80_notebook_http(string $url,string $method,array $headers=[],?string $body=null,string $responseMode='json'):array {
 $u=parse_url($url);if(($u['scheme']??'')!=='https'||!in_array($u['host']??'',['oauth2.googleapis.com','notebook.googleapis.com'],true)||isset($u['user'])||isset($u['port']))throw new InvalidArgumentException('notebook_invalid_endpoint');
 $raw='';$c=curl_init($url);curl_setopt_array($c,[CURLOPT_CUSTOMREQUEST=>$method,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_TIMEOUT=>20,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,CURLOPT_HTTPHEADER=>$headers,CURLOPT_WRITEFUNCTION=>static function($c,string $chunk)use(&$raw):int{if(strlen($raw)+strlen($chunk)>2097152)return 0;$raw.=$chunk;return strlen($chunk);}]);
 if($body!==null)curl_setopt($c,CURLOPT_POSTFIELDS,$body);
 $ok=curl_exec($c);$code=(int)curl_getinfo($c,CURLINFO_RESPONSE_CODE);$error=$ok===false?(curl_errno($c)?:-1):0;curl_close($c);
 return $responseMode==='mcp'?n80_mcp_decode($raw,$code,$error):n80_notebook_response($raw,$code,$error);
}
/** Return bounded public error categories only; never expose provider bodies, URLs or credentials. */
function n80_notebook_response(string $raw,int $code,int $error=0):array {
 if($error!==0)throw new RuntimeException(match($error){
  5,6=>'notebook_dns_failed',7=>'notebook_connection_failed',28=>'notebook_timeout',
  35,51,58,60,77,80,83,90,91=>'notebook_tls_failed',23=>'notebook_response_too_large',default=>'notebook_transport_uncertain'});
 if($code>=500)throw new RuntimeException('notebook_service_unavailable');
 if($code===429)throw new DomainException('notebook_rate_limit');
 $data=json_decode($raw,true);if(!is_array($data))throw new RuntimeException('notebook_response_invalid');
 if($code<200||$code>=300){
  $provider=$data['error']??null;
  if($provider==='invalid_grant')throw new DomainException('notebook_reconnect_required');
  if($provider==='invalid_client')throw new DomainException('notebook_google_setup_required');
  $details=is_array($provider)?json_encode($provider):'';
  if(str_contains($details,'WORKSPACE_ACCOUNT_NOT_SUPPORTED'))throw new DomainException('notebook_personal_account_required');
  if(str_contains($details,'SERVICE_DISABLED'))throw new DomainException('notebook_api_disabled');
  throw new DomainException(match($code){401=>'notebook_reconnect_required',403=>'notebook_permission_required',404=>'notebook_not_found',429=>'notebook_rate_limit',default=>'notebook_request_rejected'});
 }
 return $data;
}
function n80_notebook_token(array &$s):string {
 $token=lab_unseal($s['tokens']??null);if(empty($token['refresh_token']))throw new DomainException('notebook_authorization_required');
 $client=n80_notebook_client();if(!hash_equals((string)($s['clientHash']??''),hash('sha256',$client['client_id'])))throw new DomainException('notebook_reconnect_required');
 if(!empty($token['access_token'])&&($token['expiresAt']??0)>time()+60)return $token['access_token'];
 $r=n80_notebook_http('https://oauth2.googleapis.com/token','POST',['Content-Type: application/x-www-form-urlencoded'],http_build_query($client+['refresh_token'=>$token['refresh_token'],'grant_type'=>'refresh_token']));
 if(empty($r['access_token']))throw new RuntimeException('notebook_response_invalid');
 if(isset($r['scope'])&&!in_array(N80_NOTEBOOK_SCOPE,explode(' ',$r['scope']),true))throw new DomainException('notebook_permission_required');
 $token['access_token']=$r['access_token'];$token['expiresAt']=time()+max(60,(int)($r['expires_in']??3600));
 if(!empty($r['refresh_token']))$token['refresh_token']=$r['refresh_token'];
 $s['tokens']=lab_seal($token);n80_notebook_write($s);return $token['access_token'];
}
function n80_notebook_api(array &$s,string $method,string $path,?array $body=null,array $query=[]):array {
 if(($s['transport']??'rest')==='mcp'){
  if(($s['mcp']['connectionHash']??'')!==n80_mcp_identity($s))throw new DomainException('notebook_mcp_check_required');
  return n80_mcp_notebook_request($s,$method,$path,$body,$query);
 }
 $token=n80_notebook_token($s);
 return n80_notebook_http('https://notebook.googleapis.com/v1/'.$path.($query?'?'.http_build_query($query):''),$method,['Authorization: Bearer '.$token,'Content-Type: application/json'],$body===null?null:json_encode($body,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE));
}
function n80_notebook_public_item(array $row):array {return array_intersect_key($row,array_flip(['name','displayName','state','createTime','mimeType','originalUrl']));}
function n80_notebook_error(Throwable $e):string {return preg_match('/^notebook_[a-z_]+$/D',$e->getMessage())?$e->getMessage():'notebook_internal_error';}
function n80_notebook_mutate(array &$s,array $b,string $path,array $payload,string $kind,string $method='POST'):array {
 $id=$b['requestId']??null;if(!is_string($id)||!preg_match('/^[a-f0-9]{32}$/D',$id))throw new InvalidArgumentException('notebook_request_id_required');
 $fingerprint=hash('sha256',json_encode([$kind,$path,$payload],JSON_THROW_ON_ERROR));$old=$s['receipts'][$id]??null;
 if($old){if(!hash_equals($old['fingerprint'],$fingerprint))throw new DomainException('notebook_request_conflict');if($old['state']==='received')return ['item'=>$old['item'],'duplicate'=>true];throw new DomainException($old['state']==='unconfirmed'||$old['state']==='sending'?'notebook_result_unconfirmed':'notebook_previous_request_failed');}
 if(($b['revision']??null)!==($s['revision']??0))throw new DomainException('notebook_revision_conflict');
 // Keep every unconfirmed receipt. Never silently resend a possibly accepted POST.
 if(count($s['receipts']??[])>=500)throw new DomainException('notebook_receipt_limit');
 $s['receipts'][$id]=['id'=>$id,'fingerprint'=>$fingerprint,'kind'=>$kind,'title'=>$payload['displayName'],'state'=>'sending','at'=>gmdate('c')];$s['revision']++;n80_notebook_write($s);
 try{
  $r=n80_notebook_api($s,$method,$path,$payload,$method==='PATCH'?['updateMask'=>'displayName']:[]);
  if(!is_string($r['name']??null))throw new RuntimeException('notebook_response_invalid');
  n80_notebook_resource($r['name'],$kind==='source');$item=n80_notebook_public_item($r);
  $s['receipts'][$id]['state']='received';$s['receipts'][$id]['item']=$item;$s['verifiedAt']=time();unset($s['lastError']);n80_notebook_write($s);return ['item'=>$item,'duplicate'=>false];
 }catch(Throwable $e){$error=n80_notebook_error($e);$s['receipts'][$id]['state']=($e instanceof DomainException)?'rejected':'unconfirmed';$s['receipts'][$id]['error']=$error;$s['lastError']=$error;n80_notebook_write($s);throw $e;}
}
function n80_notebook_action(array $b):array {
 return n80_notebook_locked(function()use($b):array{
  $s=n80_notebook_read();$action=$b['action']??'';
  try{
   if($action==='mcp_check'){
    if(($b['revision']??null)!==($s['revision']??0))throw new DomainException('notebook_revision_conflict');
    try{$result=n80_mcp_check($s);}catch(Throwable $e){$result=['probeError'=>n80_notebook_error($e)];}
   }elseif($action==='mcp_rest'){
    if(($b['revision']??null)!==($s['revision']??0))throw new DomainException('notebook_revision_conflict');
    if(($s['transport']??'rest')!=='rest'){$s['transport']='rest';$s['revision']++;unset($s['verifiedAt'],$s['lastError']);n80_notebook_write($s);}$result=[];
   }elseif($action==='check'||$action==='list'){
    $q=['pageSize'=>50];if(!empty($b['pageToken'])){if(!is_string($b['pageToken'])||strlen($b['pageToken'])>4096)throw new InvalidArgumentException('notebook_invalid_page');$q['pageToken']=$b['pageToken'];}
    $r=n80_notebook_api($s,'GET','notebooks',null,$q);$s['verifiedAt']=time();unset($s['lastError']);n80_notebook_write($s);
    $result=['notebooks'=>array_map('n80_notebook_public_item',$r['notebooks']??[]),'nextPageToken'=>$r['nextPageToken']??''];
   }elseif($action==='sources'){
    $name=n80_notebook_resource((string)($b['notebook']??''));$q=['pageSize'=>100];if(!empty($b['pageToken'])){if(!is_string($b['pageToken'])||strlen($b['pageToken'])>4096)throw new InvalidArgumentException('notebook_invalid_page');$q['pageToken']=$b['pageToken'];}
    $r=n80_notebook_api($s,'GET',$name.'/sources',null,$q);$result=['sources'=>array_map('n80_notebook_public_item',$r['sources']??[]),'nextPageToken'=>$r['nextPageToken']??''];
   }elseif($action==='source'){$result=['item'=>n80_notebook_public_item(n80_notebook_api($s,'GET',n80_notebook_resource((string)($b['source']??''),true)))];
   }elseif($action==='get'){$result=['item'=>n80_notebook_public_item(n80_notebook_api($s,'GET',n80_notebook_resource((string)($b['notebook']??''))))];
   }elseif($action==='rename'){$result=n80_notebook_mutate($s,$b,n80_notebook_resource((string)($b['notebook']??'')),['displayName'=>n80_notebook_title($b['title']??null)],'rename','PATCH');
   }elseif($action==='create'){$result=n80_notebook_mutate($s,$b,'notebooks',['displayName'=>n80_notebook_title($b['title']??null)],'notebook');
   }elseif($action==='add'){$result=n80_notebook_mutate($s,$b,n80_notebook_resource((string)($b['notebook']??'')).'/sources',n80_notebook_source($b),'source');
   }elseif($action==='disconnect'){
    if(($b['revision']??null)!==($s['revision']??0))throw new DomainException('notebook_revision_conflict');unset($s['tokens'],$s['clientHash'],$s['connectionId'],$s['lastError'],$s['verifiedAt'],$s['mcp'],$s['transport']);$s['revision']++;n80_notebook_write($s);$result=[];
   }else throw new InvalidArgumentException('notebook_invalid_action');
   return ['ok'=>true,'status'=>n80_notebook_status($s)]+$result;
  }catch(Throwable $e){$error=n80_notebook_error($e);if(!($e instanceof InvalidArgumentException)){$s['lastError']=$error;n80_notebook_write($s);}throw $e;}
 });
}
