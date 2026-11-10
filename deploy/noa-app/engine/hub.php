<?php
declare(strict_types=1);
/** N80 Hub owns host-side execution metadata; business queues stay with their modules. */
function n80_hub_module():array {
 return ['label'=>'N80 Hub','owner'=>'hub','entry'=>'/noa-hub.php','events'=>['operation.requested','deploy.verified','work.completed']];
}
function n80_hub_operations():array {
 return [
  'hub.verify'=>['module'=>'hub','label'=>'호스트 연결 점검','interval'=>60,'timeout'=>20],
  'ai.text'=>['module'=>'lab','label'=>'AI 텍스트 작업','interval'=>60,'timeout'=>110],
  'ai.batch'=>['module'=>'creator_lab','label'=>'묶음 작업 복구','interval'=>300,'timeout'=>30],
  'catalog.index'=>['module'=>'catalog','label'=>'곡 색인 갱신','interval'=>900,'timeout'=>110],
  'notifications.dispatch'=>['module'=>'notifications','label'=>'알림 전달','interval'=>60,'timeout'=>30],
  'popularity.calculate'=>['module'=>'personalization','label'=>'인기 집계','interval'=>3600,'timeout'=>110],
  'members.maintain'=>['module'=>'sign','label'=>'회원 등급·갱신 정리','interval'=>900,'timeout'=>110],
  'covers.refresh'=>['module'=>'jukebox','label'=>'누락된 곡 카드 이미지 보완','interval'=>180,'timeout'=>90],
  'ai.daily_shorts_clock'=>['module'=>'lab','label'=>'쇼츠 일정·준비 상태','interval'=>900,'timeout'=>30],
 ];
}
function n80_hub_root():string { return dirname(__DIR__,3).'/noa-hub'; }
function n80_hub_directory(string $root):void {
 if(is_link($root)||!is_dir($root)||realpath($root)!==$root||(fileperms($root)&0077)!==0)throw new RuntimeException('hub_private_directory_required');
}
function n80_hub_read(string $root,string $name,array $default=[]):array {
 n80_hub_directory($root);
 if(!preg_match('/^[a-z][a-z0-9-]*[.]json$/D',$name))throw new InvalidArgumentException('hub_state_name');
 $p=$root.'/'.$name;if(!file_exists($p))return $default;
 if(is_link($p)||!is_file($p)||filesize($p)>16777216)throw new RuntimeException('hub_unsafe_state');
 $v=json_decode((string)file_get_contents($p),true,64,JSON_THROW_ON_ERROR);
 if(!is_array($v))throw new RuntimeException('hub_invalid_state');return $v;
}
function n80_hub_write(string $root,string $name,array $value):void {
 n80_hub_directory($root);
 if(!preg_match('/^[a-z][a-z0-9-]*[.]json$/D',$name)||is_link($root.'/'.$name))throw new RuntimeException('hub_unsafe_state');
 $tmp=$root.'/.hub-'.bin2hex(random_bytes(12));$f=fopen($tmp,'x');
 try{chmod($tmp,0600);$data=json_encode($value,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);if(fwrite($f,$data)!==strlen($data)||!fflush($f))throw new RuntimeException('hub_write_failed');if(function_exists('fsync'))fsync($f);}finally{fclose($f);}
 if(!rename($tmp,$root.'/'.$name)){unlink($tmp);throw new RuntimeException('hub_write_failed');}
}
function n80_hub_locked(string $root,callable $fn):mixed {
 n80_hub_directory($root);$p=$root.'/state.lock';if(is_link($p))throw new RuntimeException('hub_unsafe_lock');$f=fopen($p,'c');chmod($p,0600);
 if(!$f||!flock($f,LOCK_EX|LOCK_NB)){if($f)fclose($f);throw new DomainException('hub_busy');}
 try{return $fn();}finally{flock($f,LOCK_UN);fclose($f);}
}
function n80_hub_owner(string $operation,?string $root=null):string {
 $s=n80_hub_read($root??n80_hub_root(),'control.json');
 return in_array($operation,$s['activeOperations']??[],true)?'n80_hub':'legacy';
}
function n80_hub_legacy_action(string $action,?string $root=null):?string {
 $op=['n80_tick'=>'ai.text','n80_text_tick'=>'ai.text','n80_batch_watchdog'=>'ai.batch','n80_listening_index'=>'catalog.index'][$action]??null;
 return $op===null?null:n80_hub_owner($op,$root);
}
function n80_hub_request(string $operation,?string $root=null):string {
 $root??=n80_hub_root();if(!isset(n80_hub_operations()[$operation]))return 'unsupported';
 return n80_hub_locked($root,function()use($root,$operation){
  $c=n80_hub_read($root,'control.json');if(!in_array($operation,$c['activeOperations']??[],true))return 'not_migrated';
  $s=n80_hub_read($root,'requests.json');$s[$operation]=time();n80_hub_write($root,'requests.json',$s);return 'requested';
 });
}
function n80_hub_auth(string $raw,array $headers,string $key,int $now,int $limit=65536):bool {
 $ts=$headers['time']??'';$nonce=$headers['nonce']??'';$sig=$headers['signature']??'';
 return $limit<=12582912&&strlen($raw)<=$limit&&strlen($key)===64&&is_string($ts)&&ctype_digit($ts)&&abs($now-(int)$ts)<=180
 &&is_string($nonce)&&preg_match('/^[a-f0-9]{32}$/D',$nonce)&&is_string($sig)&&preg_match('/^[a-f0-9]{64}$/D',$sig)
 &&hash_equals(hash_hmac('sha256',"N80-HUB-1\n".hash('sha256',$raw)."\n".$ts."\n".$nonce,$key),$sig);
}
function n80_hub_nonce(string $root,string $nonce,int $now):void {
 n80_hub_locked($root,function()use($root,$nonce,$now){$s=n80_hub_read($root,'nonces.json');if(isset($s[$nonce]))throw new DomainException('hub_replay');$s=array_filter($s,fn($v)=>$v>$now-360);if(count($s)>10000)throw new RuntimeException('hub_nonce_limit');$s[$nonce]=$now;n80_hub_write($root,'nonces.json',$s);});
}
function n80_hub_status(string $root):array {
 $c=n80_hub_read($root,'control.json');$s=n80_hub_read($root,'status.json');$last=(int)($s['heartbeatAt']??0);
 $ops=[];$history=n80_hub_read($root,'receipts.json');
 foreach(n80_hub_operations()as $id=>$row){$recent=array_values(array_filter($history,fn($r)=>($r['operation']??'')===$id));$ops[]=['id'=>$id,'label'=>$row['label'],'owner'=>in_array($id,$c['activeOperations']??[],true)?'n80_hub':'legacy','last'=>$recent?end($recent):null];}
 return ['ok'=>true,'module'=>'N80 Hub','revision'=>(int)($c['revision']??0),'paused'=>!empty($c['paused']),'heartbeatAt'=>$last,
  'runnerState'=>$last&&time()-$last<180?'running':'not_verified','source'=>n80_hub_read($root,'source.json'),
  'operations'=>$ops,'dependencies'=>n80_hub_read($root,'dependencies.json'),'receipts'=>array_slice($history,-30)];
}
/** One request identifier cannot run twice, including after an interrupted response. */
function n80_hub_execute(string $root,string $operation,string $id,callable $execute):array {
 if(!isset(n80_hub_operations()[$operation])||!preg_match('/^[a-f0-9]{32}$/D',$id))throw new InvalidArgumentException('hub_invalid_operation');
 $prior=n80_hub_locked($root,function()use($root,$operation,$id){
  $c=n80_hub_read($root,'control.json');if(!in_array($operation,$c['activeOperations']??[],true)||(!empty($c['paused'])&&$operation!=='hub.verify'))throw new DomainException('hub_operation_not_active');
  $s=n80_hub_read($root,'receipts.json');foreach($s as $r)if($r['id']===$id){if($r['operation']!==$operation)throw new DomainException('hub_identity_conflict');return $r;}
  $issued=(int)hexdec(substr($id,0,8));if($issued>time()+30||$issued<time()-180)throw new DomainException('hub_invocation_expired');
  foreach($s as $r)if($r['operation']===$operation&&$r['state']==='running')throw new DomainException('hub_previous_execution_unconfirmed');
  $s[]=['id'=>$id,'operation'=>$operation,'state'=>'running','startedAt'=>time()];
  // Never prune unresolved execution evidence.
  if(count($s)>500){$running=array_values(array_filter($s,fn($r)=>$r['state']==='running'));$done=array_values(array_filter($s,fn($r)=>$r['state']!=='running'));if(count($running)>100)throw new DomainException('hub_receipt_limit');$s=array_merge(array_slice($done,-(500-count($running))),$running);}
  n80_hub_write($root,'receipts.json',$s);return null;
 });
 if($prior)return ['ok'=>true,'duplicate'=>true,'receipt'=>$prior];
 try{$result=$execute($operation);if(!is_array($result)||($result['ok']??false)!==true)throw new RuntimeException('hub_specialist_failed');$state='succeeded';$error=null;}
 catch(Throwable $e){$result=[];$state='failed';$error=preg_match('/^[a-z][a-z0-9_]{1,90}$/D',$e->getMessage())?$e->getMessage():'hub_execution_failed';}
 return n80_hub_locked($root,function()use($root,$operation,$id,$result,$state,$error){
  $s=n80_hub_read($root,'receipts.json');foreach($s as &$r)if($r['id']===$id){$r+=['finishedAt'=>time(),'resultSha256'=>hash('sha256',json_encode($result,JSON_THROW_ON_ERROR))];$r['state']=$state;if($error)$r['error']=$error;$receipt=$r;break;}unset($r);
  n80_hub_write($root,'receipts.json',$s);return ['ok'=>true,'receipt'=>$receipt];
 });
}

/** Administrator starts the installed fixed runtime; HTTP cannot supply executable arguments. */
function n80_hub_start(string $root):string {
 n80_hub_directory($root);$args=n80_hub_read($root,'node-command.json');
 if(count($args)<1||count($args)>4||!is_file($root.'/runtime/launch.mjs')||is_link($root.'/runtime/launch.mjs'))throw new RuntimeException('hub_runtime_not_installed');
 foreach($args as $value)if(!is_string($value)||($value!=='--library-path'&&!preg_match('~^/hosting/noastudio/noa-ai-lab/host-runtime/(?:node-[a-f0-9]{16}|lib-[a-f0-9]{16}(?:/ld-linux-x86-64[.]so[.]2)?)$~D',$value)))throw new RuntimeException('hub_runtime_command_invalid');
 if(!function_exists('proc_open'))throw new RuntimeException('hub_process_start_unavailable');
 $proc=proc_open([...$args,$root.'/runtime/launch.mjs'],[0=>['pipe','r'],1=>['pipe','w'],2=>['pipe','w']],$pipes,$root);
 if(!is_resource($proc))throw new RuntimeException('hub_process_start_failed');fclose($pipes[0]);$result=stream_get_contents($pipes[1],1024);fclose($pipes[1]);fclose($pipes[2]);$code=proc_close($proc);
 if($code!==0||!str_contains($result,'N80_HUB_'))throw new RuntimeException('hub_process_start_failed');return 'requested';
}
