<?php
declare(strict_types=1);
require_once dirname(__DIR__,2).'/noa-bridge/browser-control.php';
/** Canonical Google connection manager owned by N80 NotebookLM. No execution on include. */
function n80_google_services():array {
 return [
  'notebooklm'=>['label'=>'NotebookLM','purpose'=>'제작 지침·참고 자료','transport'=>'oauth','route'=>'/noa-notebooklm.php#connection-title','module'=>'notebooklm','check'=>true],
  'gemini'=>['label'=>'Gemini','purpose'=>'캐릭터·장면 이미지 제작','transport'=>'browser','route'=>'/noa-browser-connect.php','module'=>'lab','check'=>false],
  'flow'=>['label'=>'Flow · Veo','purpose'=>'장면 영상 제작','transport'=>'browser','route'=>'/noa-browser-connect.php','module'=>'lab','check'=>false],
  'youtube'=>['label'=>'YouTube','purpose'=>'채널·영상·게시 연결','transport'=>'oauth','route'=>'/noa-bridge/lab-oauth.php?action=start','module'=>'youtube','check'=>true],
  'analytics'=>['label'=>'YouTube Analytics','purpose'=>'채널 성과·통계','transport'=>'oauth','route'=>'/noa-bridge/lab-oauth.php?action=start','module'=>'youtube','check'=>true],
  'drive'=>['label'=>'Google Drive','purpose'=>'제작 이미지·영상 임시저장','transport'=>'oauth','route'=>'/noa-bridge/lab-oauth.php?action=drive','module'=>'lab','check'=>true],
  'signin'=>['label'=>'Google 로그인','purpose'=>'NOA 회원 로그인','transport'=>'social','route'=>'/adm/config_form.php#anc_cf_sns','module'=>'sign','check'=>false],
  'cloud'=>['label'=>'Google Cloud · OAuth','purpose'=>'공통 앱 인증 설정','transport'=>'configuration','route'=>'/noa-notebooklm.php#google-client','module'=>'notebooklm','check'=>false],
 ];
}
function n80_google_route(string $service):string {
 $row=n80_google_services()[$service]??null;if(!$row)throw new InvalidArgumentException('google_unknown_service');return $row['route'];
}
function n80_google_time(mixed $value):?int {if(is_int($value))return $value>0?$value:null;if(!is_string($value)||$value==='')return null;$t=strtotime($value);return $t===false?null:$t;}
/** Exact stored revision for optimistic locking; resealing must still conflict. */
function n80_google_probe_revision(array $s,string $service,string $key=''):string {
 $record=in_array($service,['youtube','analytics'],true)?($s['channels'][$key]['tokens']??''):array_intersect_key($s['driveConnection']??[],array_flip(['id','tokens','parent','owner','clientId']));
 return hash('sha256',json_encode([$s['config']['oauthClientId']??'',(int)($s['googleClientRevision']??0),$service,$key,$record],JSON_THROW_ON_ERROR));
}
/** Stable authorization identity, not a random encryption IV or access-token expiry. */
function n80_google_authorization_fingerprint(?string $sealed):string {
 try{
  $tokens=lab_unseal($sealed);$refresh=$tokens['refresh_token']??null;
  if(!is_string($refresh)||$refresh==='')throw new DomainException('google_authorization_required');
  $scopes=preg_split('/\s+/',trim((string)($tokens['scope']??'')),-1,PREG_SPLIT_NO_EMPTY);
  $scopes=array_values(array_unique($scopes));sort($scopes,SORT_STRING);
  return hash('sha256',json_encode(['refresh'=>$refresh,'scopes'=>$scopes],JSON_THROW_ON_ERROR));
 }catch(Throwable $e){return hash('sha256','unreadable:'.($sealed??''));}
}
function n80_google_fingerprint(array $s,string $service,string $key=''):string {
 if(in_array($service,['youtube','analytics'],true))$record=n80_google_authorization_fingerprint($s['channels'][$key]['tokens']??null);
 else{
  $record=array_intersect_key($s['driveConnection']??[],array_flip(['id','parent','owner','clientId']));ksort($record);
  $record['authorization']=n80_google_authorization_fingerprint($s['driveConnection']['tokens']??null);
 }
 return hash('sha256',json_encode([$s['config']['oauthClientId']??'',(int)($s['googleClientRevision']??0),$service,$key,$record],JSON_THROW_ON_ERROR));
}
/** Successful media ingestion is historical evidence, never a live login or unattended executor. */
function n80_google_session_evidence(array $s,string $service,int $now):?array {
 $latest=null;
 foreach($s['jobs']??[] as $j){
  if(!is_array($j)||($j['state']??'')==='cancelled'||!preg_match('/^[a-f0-9]{32}$/D',(string)($j['id']??'')))continue;
  $assets=[];
  if($service==='flow'&&($j['type']??'')==='browser_clip'&&($j['browser']['provider']??'')==='google_flow'){
   foreach($j['outputs']??[] as $asset)$assets[]=[$asset,$j['browser']['sourceUrl']??'', $j['browser']['receivedAt']??null];
  }elseif(($j['type']??'')==='agent_movie'){
   foreach($j['agent']['scenes']??[] as $scene){$asset=$scene[$service==='flow'?'video':'image']??null;if(is_array($asset))$assets[]=[$asset,$asset['sourceUrl']??'', $j['updatedAt']??null];}
  }
  foreach($assets as [$asset,$url,$recorded]){
   $at=n80_google_time($recorded);$pattern=$service==='flow'?'~^https://flow[.]google[.]com/project/[a-f0-9-]{36}(?:/edit/[a-f0-9-]{36})?$~D':'~^https://gemini[.]google[.]com/(?:app|gem)/[A-Za-z0-9/_-]+$~D';
   if(!is_array($asset)||!is_string($url)||!preg_match($pattern,$url)||!$at||$at>$now||!preg_match('/^[a-f0-9]{64}$/D',(string)($asset['sha256']??''))||($asset['bytes']??0)<256||($asset['width']??0)<128||($asset['height']??0)<128)continue;
   if($service==='flow'&&(($asset['checks']['containerValid']??false)!==true||($asset['duration']??0)<=0))continue;
   if($latest!==null&&$latest['recordedAt']>=$at)continue;
   $latest=['state'=>'asset_received','scope'=>'chatgpt_session','recordedAt'=>$at,'jobId'=>$j['id'],'sourceUrl'=>$url,
    'asset'=>array_intersect_key($asset,array_flip(['sha256','width','height','duration'])),'productionAccepted'=>($asset['accepted']??false)===true,
    'liveSessionVerified'=>false,'unattendedExecutionVerified'=>false];
  }
 }
 return $latest;
}
/** Pure status projection. Never treat a saved cookie or a configured client as verified execution. */
function n80_google_snapshot(array $s,array $notebook,array $native,array $policy,bool $clientReady,int $now):array {
 $rows=n80_google_services();$checks=$s['googleChecks']??[];$channels=[];
 foreach($s['channels']??[] as $id=>$c)if(is_string($id)&&preg_match('/^UC[A-Za-z0-9_-]{22}$/D',$id)&&!empty($c['tokens']))$channels[$id]=['id'=>$id,'title'=>(string)($c['title']??$id),'autoEnabled'=>!empty($c['autoEnabled']),'connectedAt'=>n80_google_time($c['connectedAt']??null)];
 foreach($rows as $id=>&$r){
  $r+=['id'=>$id,'manager'=>'notebooklm','state'=>'authorization_required','verifiedAt'=>null,'executionVerified'=>false,'detail'=>'계정 연결이 필요합니다.'];
  if($id==='notebooklm'){$r['state']=$notebook['state']??'check_required';$r['verifiedAt']=$notebook['verifiedAt']??null;$r['detail']=!empty($notebook['authorized'])?'Notebook 전용 권한 승인됨':'Notebook 전용 권한 승인 대기';}
  elseif(in_array($id,['gemini','flow'],true)){
   $profile=$s['browserProfile']??[];$control=$s['browserControl']??[];$flag=$id.'Connected';$active=($control['state']??'')==='active'&&($control['leaseUntil']??0)>$now&&($control['expiresAt']??0)>$now;
   $r['sessionEvidence']=n80_google_session_evidence($s,$id,$now);
   $r['executionScope']='unattended_browser';
   if(nb_google_rejected($control)){$r['state']='authorization_blocked';$r['detail']='무인 실행용 브라우저: Google 로그인 거부로 입력·저장 중단. 대화 중 사용하는 브라우저와 연결 상태가 별도입니다.';}
   elseif(in_array($control['state']??'',['failed','expired','connection_lost'],true)||(($control['state']??'')==='active'&&!$active)){$r['state']='check_required';$r['detail']='현재 브라우저 연결을 확인할 수 없습니다. 저장된 연결만으로 제작 실행을 확인하지 않습니다.';}
   elseif($active&&!empty($control[$flag])){$r['state']='browser_verified';$r['detail']='현재 연결 화면에서 로그인 확인 · 제작 실행은 별도 검수';$r['verifiedAt']=$now;}
   elseif(!empty($profile[$flag])){$r['state']='connection_saved';$r['detail']='브라우저 연결 저장됨 · 현재 로그인·제작 실행 확인 필요';$r['verifiedAt']=n80_google_time($profile['updatedAt']??null);}
  }elseif(in_array($id,['youtube','analytics'],true)){
   $verified=0;$failed=0;$times=[];
   foreach($channels as $key=>$c){$ck=$checks[$id][$key]??[];if(($ck['fingerprint']??'')!==n80_google_fingerprint($s,$id,$key))continue;if(!empty($ck['error']))$failed++;elseif(($ck['at']??0)>$now-3600){$verified++;$times[]=$ck['at'];}}
   $r['state']=!$channels?'authorization_required':(!$clientReady?'configuration_required':($failed?'check_required':($verified===count($channels)?'connected':($verified?'partly_verified':'authorization_saved'))));
   $r['detail']='연결 저장 '.count($channels).'개 · 최근 API 확인 '.$verified.'개';$r['verifiedAt']=$times?max($times):null;
  }elseif($id==='drive'){
   $c=$s['driveConnection']??[];$parent=$policy['mediaStorage']['temporaryParentFolderId']??'';
   $authorized=$parent!==''&&!empty($c['tokens'])&&($c['parent']??'')===$parent&&($c['clientId']??'')===($s['config']['oauthClientId']??'');
   $ck=$checks['drive']['current']??[];$valid=($ck['fingerprint']??'')===n80_google_fingerprint($s,'drive');
   $r['state']=!$authorized?'authorization_required':(!$clientReady?'configuration_required':($valid&&!empty($ck['error'])?'check_required':($valid&&($ck['at']??0)>$now-3600?'connected':'authorization_saved')));
   $r['verifiedAt']=$valid?($ck['at']??null):null;$r['executionVerified']=$authorized&&!empty($c['workerVerifiedAt']);$r['detail']=$authorized?($r['executionVerified']?'작업 파일 저장 이력 확인됨':'권한 저장됨 · 실제 작업 파일 저장 검증 전'):'Google Drive 전체 파일 권한 승인이 필요합니다. N80의 저장 위치는 지정된 임시저장 폴더로 제한됩니다.';
   $r['storageVerifiedAt']=$authorized&&($c['storageCheck']['state']??'')==='verified'?($c['storageCheck']['verifiedAt']??null):null;
   if($r['storageVerifiedAt']&&!$r['executionVerified'])$r['detail']='서버 파일 저장·다시 읽기 검사 완료 · 실제 제작 작업 자동 저장 검증 전';
  }elseif($id==='signin'){
   $configured=!empty($native['cf_google_clientid'])&&!empty($native['cf_google_secret']);$enabled=!array_key_exists('cf_social_login_use',$native)||!empty($native['cf_social_login_use']);
   $r['state']=$configured&&$enabled?'configured':'configuration_required';$r['detail']=$configured&&$enabled?'회원 로그인 설정됨 · 제작용 권한과 별도':'회원 Google 로그인 설정 확인 필요';
  }elseif($id==='cloud'){$r['state']=$clientReady?'configured':'configuration_required';$r['detail']=$clientReady?'공통 웹 OAuth 설정 저장됨 · 서비스별 API·권한은 별도 승인':'공통 웹 OAuth 설정이 필요합니다.';}
 }
 unset($r);return ['manager'=>'N80 NotebookLM','checkedAt'=>$now,'mode'=>'saved_evidence','services'=>array_values($rows),'channels'=>array_values($channels),'clientConfigured'=>$clientReady,'clientRevision'=>(int)($s['configRevision']??0),'automaticScopeExpansion'=>false,'automaticContentExport'=>false];
}
function n80_google_overview():array {
 require_once dirname(__DIR__,2).'/noa-bridge/lab-core.php';require_once __DIR__.'/notebooklm.php';
 $s=lab_read();$secret=lab_unseal($s['secrets']??null);$policy=json_decode((string)file_get_contents(__DIR__.'/daily-shorts.json'),true)?:[];
 return n80_google_snapshot($s,n80_notebook_status(),is_array($GLOBALS['config']??null)?$GLOBALS['config']:[],$policy,!empty($s['config']['oauthClientId'])&&!empty($secret['oauthClientSecret']),time());
}
/** Shared implementation for the central form and compatible legacy configuration requests. */
function n80_google_apply_client(array &$s,array $b):void {
 if(!array_key_exists('oauthClientId',$b)&&!array_key_exists('oauthClientSecret',$b))return;
 $secrets=lab_unseal($s['secrets']??null);if(($b['oauthClientId']??'')===''&&($b['oauthClientSecret']??'')===''&&empty($s['config']['oauthClientId']))return;$id=$s['config']['oauthClientId']??'';$old=$id;
 if(array_key_exists('oauthClientId',$b)){
  if(!is_string($b['oauthClientId']))throw new InvalidArgumentException('google_invalid_client');$id=trim($b['oauthClientId']);
  if(!preg_match('/^[0-9]+-[A-Za-z0-9_-]+[.]apps[.]googleusercontent[.]com$/D',$id))throw new InvalidArgumentException('google_invalid_client');
 }
 $value=$b['oauthClientSecret']??'';if(!is_string($value)||strlen($value)>4096||preg_match('/[\x00-\x20\x7f]/',$value))throw new InvalidArgumentException('google_invalid_secret');
 if($id!==$old&&$value==='')throw new DomainException('google_secret_required_for_client_change');
 if($value!=='')$secrets['oauthClientSecret']=$value;
 if(empty($secrets['oauthClientSecret']))throw new DomainException('google_secret_required');
 $changed=$id!==$old||$value!=='';
 $s['config']['oauthClientId']=$id;$s['secrets']=lab_seal($secrets);
 if($changed){$s['googleClientRevision']=($s['googleClientRevision']??0)+1;unset($s['googleChecks']);}
}
function n80_google_save_client(array $b,string $actor):array {
 lab_lock(function(&$s)use($b,$actor){if(($b['revision']??null)!==($s['configRevision']??0))throw new DomainException('google_revision_conflict');n80_google_apply_client($s,$b);$s['configRevision']=($s['configRevision']??0)+1;lab_event($s,'google_connection_config_updated','',$actor);});
 return ['ok'=>true,'google'=>n80_google_overview()];
}
/** Credential-free summary for the N80 host status report. */
function n80_google_report():array {
 try{$v=n80_google_overview();$out=[];foreach($v['services']as $r)$out[$r['id']]=array_intersect_key($r,array_flip(['state','verifiedAt','executionVerified','storageVerifiedAt','executionScope','sessionEvidence']));return ['manager'=>'notebooklm','services'=>$out,'automaticScopeExpansion'=>false];}
 catch(Throwable $e){return ['manager'=>'notebooklm','state'=>'inspection_unavailable'];}
}
