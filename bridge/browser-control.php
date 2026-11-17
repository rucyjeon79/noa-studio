<?php
declare(strict_types=1);
/** N80 AI LAB owns one bounded, administrator-operated browser connection. */
function nb_url(string $url):bool {
 $p=parse_url($url);return ($p['scheme']??'')==='https'&&!isset($p['user'])&&!isset($p['pass'])&&!isset($p['port'])
  &&in_array($p['host']??'',['gemini.google.com','accounts.google.com','labs.google','labs.google.com','flow.google.com'],true);
}
function nb_queue_expired(array $r,int $now):bool {
 return ($r['state']??'')==='queued'&&($r['requestedAt']??0)+180<=$now;
}
function nb_google_rejected(array $r):bool {
 $p=parse_url((string)($r['url']??''));
 return ($r['error']??'')==='google_browser_rejected'||(($p['host']??'')==='accounts.google.com'&&($p['path']??'')==='/v3/signin/rejected');
}
function nb_stop_rejected(array &$r):array {
 $r['state']='failed';$r['error']='google_browser_rejected';unset($r['frame'],$r['input']);
 return ['ok'=>true,'stop'=>true,'save'=>false,'state'=>'authorization_blocked'];
}
/** Reserve a bounded wake under the existing state lock; dispatch happens after unlock. */
function nb_reserve_wake(array &$r,int $now):bool {
 if(($r['state']??'')!=='queued'||nb_queue_expired($r,$now)||($r['wakeAttempts']??0)>=3||($r['retryAt']??0)>$now)return false;
 $r['wakeAttempts']=($r['wakeAttempts']??0)+1;$r['retryAt']=$now+60;return true;
}
function nb_view(array $s,string $owner,int $now):array {
 $r=$s['browserControl']??[];
 if(($r['owner']??'')!==$owner)return ['state'=>'disconnected'];
 $out=array_intersect_key($r,array_flip(['id','state','expiresAt','frameSeq','url','geminiConnected','flowConnected','error']));
 if(($r['expiresAt']??0)<=$now&&!in_array($r['state']??'',['saved','closed','failed'],true))$out['state']='expired';
 if(($out['state']??'')==='active'&&($r['leaseUntil']??0)<=$now)$out['state']='connection_lost';
 if(nb_queue_expired($r,$now)){$out['state']='failed';$out['error']='browser_start_timeout';}
 if(nb_google_rejected($r)){$out['state']='authorization_blocked';$out['error']='google_browser_rejected';}
 $out['retryAllowed']=($out['state']??'')==='queued'&&($r['wakeAttempts']??0)<3&&($r['retryAt']??0)<=$now;
 $out['phase']=(($out['state']??'')==='active'&&empty($r['frame']))?'starting':($out['state']??'disconnected');
 $out['inputReady']=($out['state']??'')==='active'&&!empty($r['frame'])&&empty($r['input']);
 $out['waitSeconds']=isset($r['requestedAt'])?max(0,$now-$r['requestedAt']):null;
 if(($out['state']??'')==='active'&&!empty($r['frame']))$out['frame']=lab_unseal($r['frame'])['image']??null;
 $out['profileStored']=!empty($s['browserProfile']);
 $out['serverNow']=$now;
 // A non-secret receipt lets a client reconcile a lost POST response without replaying input.
 if(isset($r['inputReceipt']))$out['inputReceipt']=$r['inputReceipt']+['ack'=>(int)($r['ack']??0)];
 $out['productionReady']=false;
 return $out;
}
function nb_admin(array &$s,array $b,string $owner,int $now):array {
 $command=$b['command']??'';
 if($command==='open'){
  $prior=$s['browserControl']??[];
  if(($prior['expiresAt']??0)>$now&&!nb_queue_expired($prior,$now)&&in_array($prior['state']??'',['queued','active','closing'],true)){
   if(($prior['owner']??'')!==$owner)throw new DomainException('browser_in_use');
   return ['ok'=>true]+nb_view($s,$owner,$now);
  }
  $s['browserControl']=['id'=>bin2hex(random_bytes(16)),'owner'=>$owner,'state'=>'queued','requestedAt'=>$now,'expiresAt'=>$now+1200,
   'frameSeq'=>0,'nextInput'=>0,'ack'=>0,'input'=>null,'geminiConnected'=>false,'flowConnected'=>false];
  $dispatch=nb_reserve_wake($s['browserControl'],$now);
  return ['ok'=>true,'dispatchWake'=>$dispatch]+nb_view($s,$owner,$now);
 }
 $r=&$s['browserControl'];
 if(!$r||($r['owner']??'')!==$owner||($b['id']??'')!==$r['id'])throw new DomainException('browser_session_changed');
 if($command==='retry')return ['ok'=>true,'dispatchWake'=>nb_reserve_wake($r,$now)]+nb_view($s,$owner,$now);
 if($command==='close'){$r['state']='closed';unset($r['frame'],$r['input']);return ['ok'=>true,'state'=>'closed'];}
 if(nb_google_rejected($r))throw new DomainException('google_browser_rejected');
 if($r['expiresAt']<=$now||$r['state']!=='active'||($r['leaseUntil']??0)<=$now)throw new DomainException('browser_not_connected');
 if(empty($r['frame']))throw new DomainException('browser_not_ready');
 if($command==='save'){$r['state']='closing';$r['input']=null;return ['ok'=>true,'state'=>'closing'];}
 $requestId=$b['requestId']??null;
 if($requestId!==null&&(!is_string($requestId)||!preg_match('/^[a-f0-9]{32}$/D',$requestId)))throw new InvalidArgumentException('browser_request_id');
 if($command==='input'&&$requestId!==null&&($r['inputReceipt']['id']??null)===$requestId)return ['ok'=>true,'state'=>'input_accepted','replayed'=>true];
 if($command!=='input'||!empty($r['input'])||($b['frameSeq']??null)!==$r['frameSeq'])throw new DomainException('browser_frame_changed');
 $event=$b['event']??[];$kind=$event['kind']??'';
 if($kind==='click'){
  if(!is_int($event['x']??null)||!is_int($event['y']??null)||$event['x']<0||$event['x']>=1280||$event['y']<0||$event['y']>=900)throw new InvalidArgumentException('browser_coordinates');
  $event=array_intersect_key($event,array_flip(['kind','x','y']));
 }elseif($kind==='type'){
  if(!is_string($event['text']??null)||strlen($event['text'])>4096||str_contains($event['text'],"\0"))throw new InvalidArgumentException('browser_text');
  $event=['kind'=>$kind,'text'=>$event['text']];
 }elseif($kind==='key'){
  if(!in_array($event['key']??'',['Enter','Tab','Backspace','Escape','ArrowDown','ArrowUp','Control+a'],true))throw new InvalidArgumentException('browser_key');
  $event=['kind'=>$kind,'key'=>$event['key']];
 }elseif($kind==='navigate'){
  if(!in_array($event['target']??'',['gemini','flow'],true))throw new InvalidArgumentException('browser_target');
  $event=['kind'=>$kind,'target'=>$event['target']];
 }elseif($kind==='scroll'){
  if(!in_array($event['y']??0,[-600,600],true))throw new InvalidArgumentException('browser_scroll');
  $event=['kind'=>$kind,'y'=>$event['y']];
 }else throw new InvalidArgumentException('browser_input');
 $r['nextInput']++;$r['input']=lab_seal(['seq'=>$r['nextInput'],'event'=>$event]);
 if($requestId!==null)$r['inputReceipt']=['id'=>$requestId,'seq'=>$r['nextInput']];else unset($r['inputReceipt']);
 return ['ok'=>true,'state'=>'input_pending'];
}
function nb_worker(array &$s,array $b,int $now):array {
 $command=$b['command']??'';$r=&$s['browserControl'];
 if($command==='claim'){
  // A delayed dispatch must never consume a newer administrator session.
  if(!is_string($b['id']??null)||!preg_match('/^[a-f0-9]{32}$/D',$b['id'])||!$r||!hash_equals((string)($r['id']??''),$b['id']))return ['ok'=>true,'claimed'=>false,'state'=>'session_changed'];
  if(!$r||$r['state']!=='queued'||$r['expiresAt']<=$now||nb_queue_expired($r,$now))return ['ok'=>true,'claimed'=>false,'state'=>'idle'];
  $r['state']='active';$r['startedAt']=$now;$r['lease']=bin2hex(random_bytes(24));$r['leaseUntil']=$now+180;$r['expiresAt']=min($r['expiresAt'],$now+900);
  return ['ok'=>true,'claimed'=>true,'id'=>$r['id'],'lease'=>$r['lease'],'expiresAt'=>$r['expiresAt'],'profile'=>$s['browserProfile']??null];
 }
 if(!$r||($b['id']??'')!==$r['id']||!is_string($b['lease']??null)||!hash_equals($r['lease']??'',$b['lease']))throw new DomainException('browser_lease_changed');
 if($r['state']==='closed')return ['ok'=>true,'stop'=>true,'save'=>false];
 if(nb_google_rejected($r))return nb_stop_rejected($r);
 if($r['expiresAt']+60<=$now||($r['leaseUntil']??0)<=$now)throw new DomainException('browser_lease_expired');
 if($command==='fail'){if(in_array($r['state'],['saved','failed'],true))return ['ok'=>true,'state'=>$r['state']];$r['state']='failed';$r['error']='browser_connection_failed';unset($r['frame'],$r['input']);return ['ok'=>true,'state'=>'failed'];}
 if($command==='finish'){
  $profile=$b['profile']??null;
  if($r['state']!=='closing'||!is_array($profile)||!preg_match('/^[a-f0-9]{64}$/D',$profile['sha256']??'')||!is_int($profile['bytes']??null)||$profile['bytes']<28||$profile['bytes']>4194304)throw new DomainException('browser_profile_unverified');
  $file=lab_root().'/browser-profile-'.$profile['sha256'].'.enc';
  if(is_link($file)||!is_file($file)||filesize($file)!==$profile['bytes']||hash_file('sha256',$file)!==$profile['sha256'])throw new DomainException('browser_profile_checksum');
  $s['browserProfile']=['sha256'=>$profile['sha256'],'bytes'=>$profile['bytes'],'updatedAt'=>gmdate('c',$now),
   'geminiConnected'=>$r['geminiConnected'],'flowConnected'=>$r['flowConnected']];
  $r['state']='saved';unset($r['frame'],$r['input']);return ['ok'=>true,'state'=>'saved','productionReady'=>false];
 }
 if($command!=='exchange')throw new InvalidArgumentException('browser_command');
 if(!in_array($r['state'],['active','closing'],true))throw new DomainException('browser_not_active');
 $ack=$b['ack']??null;
 if(!is_int($ack)||$ack<$r['ack']||$ack>$r['nextInput'])throw new DomainException('browser_ack_invalid');
 $r['ack']=$ack;if($ack===$r['nextInput'])$r['input']=null;
 $r['leaseUntil']=$now+90;
 if($r['state']==='closing'||$r['expiresAt']<=$now){$r['state']='closing';return ['ok'=>true,'stop'=>true,'save'=>true];}
 $frame=$b['frame']??null;
 if(is_array($frame)){
  if(!nb_url($frame['url']??'')||!is_string($frame['image']??null)||strlen($frame['image'])>700000||!preg_match('~^data:image/jpeg;base64,[A-Za-z0-9+/=]+$~D',$frame['image']))throw new InvalidArgumentException('browser_frame_invalid');
  $digest=hash('sha256',$frame['url']."\n".$frame['image']);
  if(($r['frameDigest']??'')!==$digest){$r['frameSeq']++;$r['frameDigest']=$digest;}
  $r['url']=$frame['url'];$r['frame']=lab_seal(['image'=>$frame['image']]);
  if(nb_google_rejected($r))return nb_stop_rejected($r);
  $r['firstFrameAt']??=$now;
  foreach(['gemini','flow'] as $provider)if(($frame[$provider.'Connected']??false)===true)$r[$provider.'Connected']=true;
 }
 return ['ok'=>true,'stop'=>false,'input'=>empty($r['input'])?null:lab_unseal($r['input'])];
}
