<?php
declare(strict_types=1);
require_once __DIR__.'/lease-state.php';
require_once __DIR__.'/app-data.php';
require_once __DIR__.'/durable-store.php';
/** Native read models stay in their existing stores; refresh verifies the actual projection. */
function n80_native_projection(PDO $db,string $module,string $web):array {
 if($module==='playlist'){
  $schema=n80_app_schema($db);$keys=n80_app_references($db,$schema)['keys'];$count=0;$owners=[];$hash=hash_init('sha256');
  foreach($db->query('SELECT playlist_id,owner_id,tracks,revision FROM noa_user_playlists ORDER BY owner_id,playlist_id') as $row){
   $tracks=json_decode($row['tracks'],true,512,JSON_THROW_ON_ERROR);if(!is_array($tracks)||!array_is_list($tracks)||$row['owner_id']==='')throw new RuntimeException('playlist_projection_invalid');
   foreach($tracks as $key)if(!is_string($key)||!isset($keys[$key]))throw new RuntimeException('playlist_reference_missing');
   hash_update($hash,json_encode([$row['playlist_id'],$row['owner_id'],$tracks,$row['revision']],JSON_THROW_ON_ERROR));$count++;$owners[$row['owner_id']]=true;
  }
  return ['effect'=>'playlist_read_model_verified','projectionSha256'=>hash_final($hash),'rows'=>$count,'owners'=>count($owners),'referencesVerified'=>true,'mutation'=>false];
 }
 if($module==='world'){
  require_once $web.'/noa-bridge/sound-core.php';require_once $web.'/noa-bridge/youtube-store.php';require_once $web.'/noa-bridge/world-core.php';require_once $web.'/noa-bridge/world-mv.php';
  $model=nwm_load($db,ny_songs($db,ny_batch($db)));
  return ['effect'=>'world_read_model_verified','projectionSha256'=>hash('sha256',json_encode($model,JSON_THROW_ON_ERROR)),'officialPlaylistVerified'=>true,'mutation'=>false];
 }
 if($module==='admin'){
  $table=(defined('G5_TABLE_PREFIX')?G5_TABLE_PREFIX:'g5_').'member';$audit=n80_app_audit($db,$web,$table);
  if(!$audit['integrityOk'])throw new RuntimeException('admin_audit_failed');
  return ['effect'=>'admin_integrity_audit_verified','projectionSha256'=>hash('sha256',json_encode([$audit['checks'],$audit['modules']],JSON_THROW_ON_ERROR)),'tablesVerified'=>$audit['modules']['database']['tablesVerified'],'integrityVerified'=>true,'mutation'=>false];
 }
 throw new InvalidArgumentException('unknown_native_module');
}
function n80_native_event(PDO $db,string $module,string $requestId,string $requestedAt=''):array {
 if($module==='playlist'){
  require_once __DIR__.'/music-availability.php';
  $id=(int)$db->query("SELECT id FROM noa_jukebox_audio_jobs WHERE status='ready' ORDER BY id DESC LIMIT 1")->fetchColumn();$ready=n80_ready_event_from_job($db,$id);if(!$ready['ok'])throw new RuntimeException('ready_audio_required');return $ready['event'];
 }
 if($module==='world'){
  $run=$db->query("SELECT run_id,created_at FROM noa_youtube_runs ORDER BY created_at DESC,run_id DESC LIMIT 1")->fetch(PDO::FETCH_ASSOC);
  if(!$run)throw new RuntimeException('youtube_collection_required');$subject=(string)$run['run_id'];$at=gmdate('c',strtotime($run['created_at']));$type='youtube.synced';$source='youtube';
 }elseif($module==='admin'){
  if(!preg_match('/^[a-f0-9]{40}$/D',$requestId))throw new InvalidArgumentException('invalid_audit_request');$subject='integrity-audit:'.$requestId;$at=$requestedAt;if(strtotime($at)===false)throw new InvalidArgumentException('invalid_audit_time');$type='operation.requested';$source='admin';
 }else throw new InvalidArgumentException('unknown_native_module');
 $id='n80-'.$module.'-'.hash('sha256',$subject);return ['id'=>$id,'type'=>$type,'source'=>$source,'subjectId'=>$subject,'occurredAt'=>$at,'schemaVersion'=>1,'correlationId'=>$id];
}
function n80_native_consume(PDO $db,array $event,string $module,array $context):array {
 $directories=$context['directories'];$web=realpath($context['web']);
 foreach(['events','leases'] as $kind){$dir=$directories[$kind]??'';$real=realpath($dir);if(!$web||!$real||$real!==rtrim($dir,'/')||!is_dir($dir)||!is_writable($dir)||is_link($dir)||$real===$web||str_starts_with($real,$web.'/')||((fileperms($dir)&0077)!==0))return ['ok'=>false,'error'=>'unsafe_private_store'];}
 $canonical=n80_native_event($db,$module,$context['requestId']??'',$context['requestedAt']??'');if($event!==$canonical)return ['ok'=>false,'error'=>'event_identity_mismatch'];
 $stored=noa_engine_store_event($directories['events'],$event);if(!$stored['ok'])return $stored;
 $eventHash=hash('sha256',json_encode($event,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR));
 $claim=n80_lease_state_transition($directories['leases'],$event['id'],$module,'claim',time(),null,120,3);
 if(!$claim['ok']){
  $state=$claim['state']??[];$receipt=$state['receipt']??[];
  if(($state['status']??'')==='succeeded'&&($receipt['eventSha256']??'')===$eventHash&&($receipt['eventId']??'')===$event['id']&&($receipt['correlationId']??'')===$event['correlationId']&&($receipt['generation']??null)===($state['generation']??null)&&n80_native_receipt_valid($module,$receipt))return ['ok'=>true,'status'=>'already_acknowledged','receipt'=>$receipt,'replayed'=>true];return $claim;
 }
 $generation=$claim['state']['generation'];
 try{
  $proof=n80_native_projection($db,$module,$web);$receipt=['eventId'=>$event['id'],'eventSha256'=>$eventHash,'consumer'=>$module,'correlationId'=>$event['correlationId'],'generation'=>$generation,'effect'=>$proof['effect'],'verifiedAt'=>gmdate('c'),'proof'=>$proof];
  $ack=n80_lease_state_transition($directories['leases'],$event['id'],$module,'ack',time(),$generation,120,3,$receipt);
  if(!$ack['ok'])return $ack;$path=$directories['leases'].'/'.hash('sha256',$event['id'].'|'.$module).'.json';
  if(json_decode(file_get_contents($path),true)!==$ack['state'])return ['ok'=>false,'error'=>'ack_readback_failed'];
  return ['ok'=>true,'status'=>'acknowledged','receipt'=>$receipt,'replayed'=>false];
 }catch(Throwable $e){n80_lease_state_transition($directories['leases'],$event['id'],$module,'fail',time(),$generation,120,3);return ['ok'=>false,'error'=>'native_projection_not_verified','module'=>$module];}
}
