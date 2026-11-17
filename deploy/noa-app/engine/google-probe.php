<?php
declare(strict_types=1);
require_once __DIR__.'/google-connections.php';
function n80_google_error(Throwable $e):string {
 $s=$e->getMessage();return preg_match('/^(?:google|notebook)_[a-z_]+$/D',$s)?$s:'google_connection_check_failed';
}
function n80_google_remote(string $url,string $method,array $headers,?string $body=null):array {
 $u=parse_url($url);if(($u['scheme']??'')!=='https'||!in_array($u['host']??'',['oauth2.googleapis.com','www.googleapis.com','youtubeanalytics.googleapis.com'],true)||isset($u['user'])||isset($u['port']))throw new InvalidArgumentException('google_invalid_endpoint');
 $raw='';$c=curl_init($url);curl_setopt_array($c,[CURLOPT_CUSTOMREQUEST=>$method,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_CONNECTTIMEOUT=>4,CURLOPT_TIMEOUT=>12,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,CURLOPT_HTTPHEADER=>$headers,CURLOPT_WRITEFUNCTION=>static function($c,string $v)use(&$raw):int{if(strlen($raw)+strlen($v)>1048576)return 0;$raw.=$v;return strlen($v);}]);if($body!==null)curl_setopt($c,CURLOPT_POSTFIELDS,$body);
 $ok=curl_exec($c);$status=(int)curl_getinfo($c,CURLINFO_RESPONSE_CODE);curl_close($c);$out=json_decode($raw,true);
 if($ok===false||!is_array($out))throw new RuntimeException('google_transport_failed');
 if($status<200||$status>=300)throw new DomainException(match($status){401=>'google_reconnect_required',403=>'google_permission_or_api_required',429=>'google_rate_limit',default=>($out['error']??'')==='invalid_grant'?'google_reconnect_required':'google_connection_check_failed'});
 return $out;
}
/** Bounded read-only probe. The caller persists a rotated token only after a concurrent-change guard. */
function n80_google_probe_remote(array $s,string $service,string $channel,string $actor,array $policy,?callable $remote=null):array {
 $remote??='n80_google_remote';$secrets=lab_unseal($s['secrets']??null);$client=(string)($s['config']['oauthClientId']??'');
 if($client===''||empty($secrets['oauthClientSecret']))throw new DomainException('google_configuration_required');
 $record=in_array($service,['youtube','analytics'],true)?($s['channels'][$channel]??[]):($s['driveConnection']??[]);
 if($service==='drive'){
  $parent=$policy['mediaStorage']['temporaryParentFolderId']??'';
  if(!is_string($parent)||!preg_match('/^[A-Za-z0-9_-]{10,200}$/D',$parent)||($record['parent']??'')!==$parent||($record['owner']??'')!==$actor||($record['clientId']??'')!==$client)throw new DomainException('google_drive_connection_required');
 }elseif(!in_array($service,['youtube','analytics'],true)||!preg_match('/^UC[A-Za-z0-9_-]{22}$/D',$channel))throw new InvalidArgumentException('google_select_channel');
 $saved=lab_unseal($record['tokens']??null);if(empty($saved['refresh_token']))throw new DomainException('google_authorization_required');
 $r=$remote('https://oauth2.googleapis.com/token','POST',['Content-Type: application/x-www-form-urlencoded'],http_build_query(['client_id'=>$client,'client_secret'=>$secrets['oauthClientSecret'],'refresh_token'=>$saved['refresh_token'],'grant_type'=>'refresh_token']));
 if(!is_string($r['access_token']??null)||$r['access_token']==='')throw new DomainException('google_reconnect_required');
 $updated=$saved;if(!empty($r['refresh_token']))$updated['refresh_token']=$r['refresh_token'];if(isset($r['scope']))$updated['scope']=$r['scope'];
 if($service==='drive'){$updated['access_token']=$r['access_token'];$updated['expires_at']=time()+min(3600,max(60,(int)($r['expires_in']??3600)));}
 $error=null;
 try{
  $headers=['Authorization: Bearer '.$r['access_token']];
  if($service==='youtube'){$result=$remote('https://www.googleapis.com/youtube/v3/channels?'.http_build_query(['part'=>'id','mine'=>'true','maxResults'=>50]),'GET',$headers);if(!in_array($channel,array_column($result['items']??[],'id'),true))throw new DomainException('google_channel_mismatch');}
  elseif($service==='analytics'){
   $query=['ids'=>'channel=='.$channel,'startDate'=>gmdate('Y-m-d',time()-7*86400),'endDate'=>gmdate('Y-m-d',time()-86400),'metrics'=>'views'];
   $result=$remote('https://youtubeanalytics.googleapis.com/v2/reports?'.http_build_query($query),'GET',$headers);if(!isset($result['columnHeaders'])||!is_array($result['columnHeaders']))throw new DomainException('google_invalid_response');
  }else{
   $result=$remote('https://www.googleapis.com/drive/v3/files/'.rawurlencode($parent).'?fields=id,mimeType,trashed,shared,ownedByMe,capabilities(canAddChildren)','GET',$headers);
   if(($result['id']??'')!==$parent||($result['mimeType']??'')!=='application/vnd.google-apps.folder'||($result['trashed']??true)!==false||($result['shared']??true)!==false||($result['ownedByMe']??false)!==true||($result['capabilities']['canAddChildren']??false)!==true)throw new DomainException('google_drive_folder_unavailable');
  }
 }catch(Throwable $e){$error=n80_google_error($e);}
 return ['error'=>$error,'rotatedTokens'=>$updated!==$saved?$updated:null];
}
function n80_google_commit_probe(array &$s,array $initial,string $service,string $key,array $result):void {
 if(($initial['configRevision']??0)!==($s['configRevision']??0)||!hash_equals(n80_google_probe_revision($initial,$service,$key),n80_google_probe_revision($s,$service,$key)))throw new DomainException('google_revision_conflict');
 if(!empty($result['rotatedTokens'])){if($service==='drive')$s['driveConnection']['tokens']=lab_seal($result['rotatedTokens']);else $s['channels'][$key]['tokens']=lab_seal($result['rotatedTokens']);}
 $s['googleChecks'][$service][$key?:'current']=['at'=>time(),'fingerprint'=>n80_google_fingerprint($s,$service,$key),'error'=>$result['error']??null];
}
function n80_google_check(array $b,string $actor):array {
 $service=$b['service']??'';if(!is_string($service)||empty(n80_google_services()[$service]['check']))throw new InvalidArgumentException('google_check_requires_browser');
 if($service==='notebooklm'){
  $error=null;try{n80_notebook_action(['action'=>'check']);}catch(Throwable $e){$error=n80_google_error($e);}
  return ['ok'=>true,'probeError'=>$error,'google'=>n80_google_overview(),'status'=>n80_notebook_status()];
 }
 $s=lab_read();$key=in_array($service,['youtube','analytics'],true)?(string)($b['channel']??''):'';$policy=json_decode((string)file_get_contents(__DIR__.'/daily-shorts.json'),true)?:[];
 if(in_array($service,['youtube','analytics'],true)&&(!preg_match('/^UC[A-Za-z0-9_-]{22}$/D',$key)||!isset($s['channels'][$key])))throw new InvalidArgumentException('google_select_channel');
 try{$result=n80_google_probe_remote($s,$service,$key,$actor,$policy);}catch(Throwable $e){$result=['error'=>n80_google_error($e),'rotatedTokens'=>null];}
 lab_lock(fn(&$current)=>n80_google_commit_probe($current,$s,$service,$key,$result));
 return ['ok'=>true,'probeError'=>$result['error'],'google'=>n80_google_overview()];
}
