<?php
declare(strict_types=1);
require_once dirname(__DIR__,2).'/deploy/noa-app/engine/durable-store.php';
require_once dirname(__DIR__,2).'/deploy/noa-app/engine/lease-state.php';
require_once dirname(__DIR__,2).'/deploy/noa-app/engine/bridge.php';
$root=sys_get_temp_dir().'/n80-e2e-'.getmypid().'-'.bin2hex(random_bytes(4));
if(!mkdir($root,0700))exit(1);
$events=$root.'/events';$leases=$root.'/leases';
mkdir($events,0700);mkdir($leases,0700);
try {
  $event=['id'=>'evt-e2e','type'=>'audio.ready','source'=>'jukebox','subjectId'=>'song-test','occurredAt'=>'2026-10-23T00:00:00Z','schemaVersion'=>1,'correlationId'=>'corr-e2e'];
  $stored=noa_engine_store_event($events,$event);
  if(!$stored['ok']||$stored['status']!=='stored')throw new RuntimeException('event_store');
  $repeat=noa_engine_store_event($events,$event);
  if(!$repeat['ok']||$repeat['status']!=='already_stored')throw new RuntimeException('idempotency');
  $route=n80_bridge_plan($event);
  if(!$route['ok']||count($route['links'])!==2)throw new RuntimeException('routing');
  foreach($route['links'] as $link){
    $id=$link['to'];
    $claim=n80_lease_state_transition($leases,$event['id'],$id,'claim',100,null,10);
    if(!$claim['ok']||$claim['state']['generation']!==1)throw new RuntimeException('claim_'.$id);
    if($id==='music'){
      $ack=n80_lease_state_transition($leases,$event['id'],$id,'ack',101,1,10);
      if(!$ack['ok']||$ack['state']['status']!=='succeeded')throw new RuntimeException('ack_music');
    }else{
      $failed=n80_lease_state_transition($leases,$event['id'],$id,'fail',101,1,10);
      if(!$failed['ok']||$failed['state']['status']!=='pending')throw new RuntimeException('fail_playlist');
      $retry=n80_lease_state_transition($leases,$event['id'],$id,'claim',102,null,10);
      if(!$retry['ok']||$retry['state']['generation']!==2)throw new RuntimeException('retry_playlist');
      $stale=n80_lease_state_transition($leases,$event['id'],$id,'ack',103,1,10);
      if($stale['ok'])throw new RuntimeException('stale_ack_accepted');
      $ack=n80_lease_state_transition($leases,$event['id'],$id,'ack',103,2,10);
      if(!$ack['ok']||$ack['state']['status']!=='succeeded')throw new RuntimeException('ack_playlist');
    }
  }
  // Reopen persisted records: simulate a new process reading durable state.
  $files=glob($leases.'/*.json');
  if(count($files)!==2)throw new RuntimeException('missing_receipts');
  foreach($files as $file){
    $state=json_decode(file_get_contents($file),true);
    if(!is_array($state)||$state['status']!=='succeeded')throw new RuntimeException('unacknowledged');
  }
  $conflict=$event;$conflict['subjectId']='different-song';
  if(noa_engine_store_event($events,$conflict)['error']!=='id_conflict')throw new RuntimeException('conflict_not_detected');
  echo "N80_E2E_DURABLE_REPLAY_OK\n";
} finally {
  foreach([$events,$leases] as $dir){
    foreach(glob($dir.'/{*,.*}',GLOB_BRACE) as $file)if(is_file($file))unlink($file);
    rmdir($dir);
  }
  rmdir($root);
}
