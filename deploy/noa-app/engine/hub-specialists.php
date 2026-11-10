<?php
declare(strict_types=1);
/** Invoked only by the authenticated Hub service, using the existing module stores. */
function n80_hub_specialist(string $operation):array {
 global $config;
 $web=dirname(__DIR__,2);$bridge=$web.'/noa-bridge';
 if($operation==='hub.verify')return ['ok'=>true,'hostExecution'=>true,'phpVersion'=>PHP_VERSION_ID,'githubRequired'=>false];
 $actions=['ai.text'=>'n80_text_tick','ai.batch'=>'n80_batch_watchdog','catalog.index'=>'n80_listening_index','ai.daily_shorts_clock'=>'n80_daily_shorts_tick'];
 if(isset($actions[$operation])){
  require_once __DIR__.'/service-runtime.php';require_once $bridge.'/lab-core.php';
  return n80_service_execute($actions[$operation],[],['authenticatedByServer'=>true,'principal'=>'n80_lab_worker','permissions'=>['ai:text','batch:recover','catalog:index','media:worker'],'method'=>'POST','admin'=>(string)($config['cf_admin']??'')]);
 }
 if($operation==='notifications.dispatch'){
  require_once $bridge.'/storage.php';require_once $bridge.'/notifications-sources.php';require_once $bridge.'/notifications-inline.php';
  $db=noa_bridge_pdo();if(!nnt_ready($db)||!nnt_inline_capable())throw new RuntimeException('hub_notification_runtime_unavailable');
  nnt_fortune_morning($db,time());nnt_prune($db,time());
  $cfg=nnt_config();$cfg['inlineDispatch']=true;$totals=['claimed'=>0,'accepted'=>0,'retry'=>0];$start=microtime(true);
  for($i=0;$i<10&&microtime(true)-$start<20;$i++){$r=nnt_inline_drain($db,$cfg);foreach($totals as $k=>$_)$totals[$k]+=$r[$k];if($r['claimed']<2)break;}
  return ['ok'=>true]+$totals;
 }
 if($operation==='popularity.calculate'){
  require_once $bridge.'/storage.php';require_once $bridge.'/popularity-store.php';$db=noa_bridge_pdo();$db->exec("SET time_zone='+00:00'");
  if(!np_ready($db))throw new RuntimeException('hub_popularity_not_installed');return ['ok'=>true,'result'=>np_calculate($db)];
 }
 if($operation==='members.maintain'){
  require_once $bridge.'/subscription-core.php';require_once $bridge.'/membership-core.php';
  if(empty(nr_policy()['enabled']))throw new RuntimeException('hub_membership_not_active');
  $rows=ns_q('SELECT mb_id FROM '.ns_table('member_table').' WHERE mb_level BETWEEN 2 AND 4 ORDER BY mb_id');$owners=[];
  while($row=sql_fetch_array($rows)){$owners[]=$row['mb_id'];if(count($owners)>10000)throw new RuntimeException('hub_maintenance_batch_limit');}
  $counts=[];foreach($owners as $owner){$r=nr_renew($owner,time());nr_refresh($owner,time());$counts[$r['state']]=($counts[$r['state']]??0)+1;}
  if(is_file($bridge.'/fan-membership.php')){
   require_once $bridge.'/fan-membership.php';$fans=ns_q('SELECT mb_id FROM '.ns_table('member_table')." WHERE mb_level IN (5,6) AND mb_leave_date='' AND mb_intercept_date=''");
   while($fan=sql_fetch_array($fans))if(nfan_monthly($fan['mb_id'],time())>0)$counts['fanCredits']=1+($counts['fanCredits']??0);
  }
  $result=['membersChecked'=>count($owners),'results'=>$counts];
  ns_atomic('membership-maintenance',false,function()use($result){$key='membership:maintenance';$old=ns_doc($key,true);ns_put($key,'membership_maintenance',['checkedAt'=>time()]+$result,$old['revision']??0,'n80-membership-worker');});
  return ['ok'=>true]+$result;
 }
 throw new InvalidArgumentException('hub_specialist_not_installed');
}

/** Existing release checks can inspect the index without becoming a second executor. */
function n80_hub_catalog_readback(bool $moods=false):array {
 $bridge=dirname(__DIR__,2).'/noa-bridge';
 require_once $bridge.'/storage.php';require_once $bridge.'/youtube-store.php';
 require_once __DIR__.'/personal-song-index.php';require_once $bridge.'/listening-video-catalog.php';
 $db=noa_bridge_pdo();$indexed=(int)$db->query('SELECT COUNT(*) FROM noa_listening_song_index')->fetchColumn();
 $videos=n80_read_listening_videos($db);
 $result=['ok'=>true,'state'=>'host_owned','readOnly'=>true,'indexed'=>$indexed,'analyzed'=>0,'reused'=>$indexed,'written'=>0,'removed'=>0,'publicVideos'=>count($videos)];
 if($moods){$fields=array_flip(['key','browseIdentity','publicVideoId','genre','moodScores','moodAffinity']);$result['moodCatalog']=array_map(static fn($v)=>array_intersect_key($v,$fields),$videos);}
 return $result;
}
