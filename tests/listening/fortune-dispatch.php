<?php
/** Isolated MySQL: no real subscriptions, provider requests or member data. */
define('_GNUBOARD_',true);
$root=dirname(__DIR__,2);
require $root.'/bridge/storage.php';require $root.'/bridge/notifications-sources.php';require $root.'/deploy/noa-app/engine/personal-listening.php';
function expect($value,string $why):void{if(!$value)throw new RuntimeException($why);}
$db=noa_bridge_pdo();$g5=['member_table'=>'fortune_members'];
$db->exec("CREATE TABLE fortune_members (mb_id VARCHAR(20) PRIMARY KEY,mb_level INT,mb_leave_date VARCHAR(8),mb_intercept_date VARCHAR(8))");
foreach(nnt_schema() as $table=>$ddl)$db->exec("CREATE TABLE `$table` $ddl ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin");
$start=strtotime('2026-11-04 08:00:00 Asia/Seoul');$at=nnt_fortune_clock($start);
$p=n80_listening_profile(['consent'=>true,'birthDate'=>'1990-06-15','fortuneAlerts'=>true,'timezone'=>'America/New_York']);
$p['fortuneAlertsSince']=$start-1;$save=function($owner,$p)use($db){$db->prepare("REPLACE INTO noa_documents(doc_key,kind,updated_by,payload) VALUES (?,'prefs',?,?)")->execute(['listening:user:'.hash('sha256',$owner),$owner,json_encode($p)]);};
foreach(['enabled','off','inboxonly','revoked','late','inactive','legacy'] as $id){
 $db->prepare("INSERT INTO fortune_members VALUES (?,4,?,'')")->execute([$id,$id==='inactive'?'20261103':'']);
 $q=$p;if($id==='off')$q['fortuneAlerts']=false;if($id==='late')$q['fortuneAlertsSince']=$start+1;if($id==='legacy')unset($q['fortuneAlerts'],$q['fortuneAlertsSince']);$save($id,$q);
 if($id!=='inboxonly')$db->prepare("INSERT INTO noa_push_subscriptions VALUES(?,?,'unused','','',?,1,?,?)")->execute([hash('sha256',$id),$id,str_repeat('a',32),$start,$start]);
}
expect(nnt_fortune_morning($db,$start-1)===0,'07:59 must not enqueue');expect(nnt_fortune_morning($db,$start)===3,'08:00 only eligible owners');expect(nnt_fortune_morning($db,$start+20)===0,'collector retry is idempotent');
$save('revoked',['consent'=>false]);$jobs=nnt_claim($db,$start+30);expect(count($jobs)===1,'only active opted-in device');$f=n80_daily_fortune(n80_listening_theme($p,$at)['pillars'],$at);
expect($f['date']==='2026-11-04'&&n80_daily_fortune([], $at)===null,'Korean day and no guest reading');
expect(n80_daily_fortune(n80_listening_theme($p,$at)['pillars'],$at->modify('+10 hours'))===$f,'same dated reading all day');
expect($jobs[0]['payload']['body']==='오늘의 운세 · '.$f['headline'].' · '.$f['tip']&&!str_contains(json_encode($jobs[0]),'1990'),'push and home agree without birth data');expect($jobs[0]['expiresAt']===$start+14400,'offline message expires at noon');
expect(nnt_fortune_morning($db,$start+86400+14400)===0,'no afternoon catch-up');expect(nnt_fortune_morning($db,$start+86400+600)===3,'next morning catches up without yesterday');$tomorrow=nnt_claim($db,$start+86400+605);expect(count($tomorrow)===2,'stale lease never delivers yesterday');
expect(n80_daily_fortune(n80_listening_theme($p,$at)['pillars'],$at->modify('+1 day'))['date']==='2026-11-05','daily rollover');
$db->exec("DELETE FROM noa_documents WHERE doc_key LIKE 'listening:user:%'");echo "DAILY_FORTUNE_KST_CONSENT_DELIVERY_OK\n";
