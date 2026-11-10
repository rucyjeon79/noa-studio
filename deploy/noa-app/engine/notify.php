<?php
declare(strict_types=1);
/** One notification store, SQL leases and delivery implementation for inline and scheduled use. */
function n80_notify_dispatch():array {
 $bridge=dirname(__DIR__,2).'/noa-bridge';
  require_once $bridge.'/storage.php';require_once $bridge.'/notifications-sources.php';require_once $bridge.'/notifications-inline.php';
  $db=noa_bridge_pdo();if(!nnt_ready($db)||!nnt_inline_capable())throw new RuntimeException('notify_runtime_unavailable');
  nnt_fortune_morning($db,time());nnt_prune($db,time());
  $cfg=nnt_config();$cfg['inlineDispatch']=true;$totals=['claimed'=>0,'accepted'=>0,'retry'=>0];$start=microtime(true);
  for($i=0;$i<10&&microtime(true)-$start<20;$i++){$r=nnt_inline_drain($db,$cfg);foreach($totals as $k=>$_)$totals[$k]+=$r[$k];if($r['claimed']<2)break;}
  return ['ok'=>true]+$totals;
}
function n80_notify_drain(PDO $db,array $cfg,?callable $send=null):array{
 $result=['claimed'=>0,'accepted'=>0,'retry'=>0];if(($cfg['inlineDispatch']??true)!==true||$db->inTransaction())return $result;
 // Cross-request lock bounds load; SQL leases also exclude the scheduled worker.
 if(!(int)nnt_one($db,"SELECT GET_LOCK('noa_notification_inline',0) acquired")['acquired'])return $result;
 try{
  nnt_collect($db,time());$jobs=nnt_claim($db,time(),2);$result['claimed']=count($jobs);
  foreach($jobs as $job){try{$code=$send?$send($job,$cfg):nnt_inline_send($job,$cfg);}catch(Throwable $e){$code=0;}
   nnt_ack($db,[['id'=>$job['id'],'device'=>$job['device'],'lease'=>$job['lease'],'http'=>$code]],time());$result[$code>=200&&$code<300?'accepted':'retry']++;
  }
  nnt_exec($db,"INSERT INTO noa_notification_cursor VALUES ('inline_last_run',?) ON DUPLICATE KEY UPDATE position=VALUES(position)",[time()]);
  return $result;
 }finally{nnt_one($db,"SELECT RELEASE_LOCK('noa_notification_inline') released");}
}
