<?php
/** Isolated database and sessions only. Never installed on the production site. */
passthru('php '.escapeshellarg(__DIR__.'/../engagement/fixture.php'),$status);if($status!==0)exit($status);
$root='/tmp/noa-community-fixture';
$extra= <<<'PHP'

define('G5_PATH',__DIR__);$config['cf_admin']='qa_admin';
if(($_SERVER['HTTP_ORIGIN']??'')==='http://127.0.0.1:8078')$_SERVER['HTTP_ORIGIN']='https://noastudio.ai.kr';
require __DIR__.'/extend/zz.noa-notifications.php';
require __DIR__.'/extend/zz.noa-engagement.php';
PHP;
file_put_contents($root.'/common.php',$extra,FILE_APPEND);
copy('deploy/noa-engagement.extend.php',$root.'/extend/zz.noa-engagement.php');
copy('deploy/noa-notifications.extend.php',$root.'/extend/zz.noa-notifications.php');
foreach(['noa-notifications.php','noa-notifications.js','noa-notifications.css','noa-sw.js','noa-ainoa.js','noa-ainoa.css','noa-brand.js','noa-policy-20261024.css']as $file)copy('deploy/'.$file,$root.'/'.$file);
@mkdir($root.'/noa-assets',0700,true);copy('public/ainoa/ainoa-symbol.png',$root.'/noa-assets/ainoa-symbol.png');
foreach(['papa-logo.png','icon-180.png']as $asset)copy('public/'.$asset,$root.'/noa-assets/'.$asset);
foreach(['notifications-inline.php','notifications-core.php','notifications-sources.php','notifications.php','notification-worker.php']as $file)copy('bridge/'.$file,$root.'/noa-bridge/'.$file);
require $root.'/common.php';require 'bridge/notifications-sources.php';
$db=new PDO('mysql:host=127.0.0.1;dbname=noa_community;charset=utf8mb4','root','fixture-only',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);
$db->exec("SET SESSION sql_mode=''");
$db->exec("ALTER TABLE g5_member ADD mb_level INT DEFAULT 4,ADD mb_leave_date VARCHAR(8) DEFAULT '',ADD mb_intercept_date VARCHAR(8) DEFAULT ''");$db->exec("UPDATE g5_member SET mb_level=10 WHERE mb_id='qa_admin'");$db->exec('ALTER TABLE g5_board_good ADD bg_id INT PRIMARY KEY AUTO_INCREMENT');
$db->exec("UPDATE g5_write_free SET mb_id='qa_a'");
$db->exec("UPDATE noa_documents SET payload=JSON_SET(payload,'$.ownerId','qa_a') WHERE doc_key='fixture-song'");
@mkdir('/tmp/noa-notifications-private',0700,true);$key=openssl_pkey_new(['private_key_type'=>OPENSSL_KEYTYPE_EC,'curve_name'=>'prime256v1']);openssl_pkey_export($key,$pem);$details=openssl_pkey_get_details($key);$pub="\x04".str_pad($details['ec']['x'],32,"\0",STR_PAD_LEFT).str_pad($details['ec']['y'],32,"\0",STR_PAD_LEFT);
$cfg=['inlineDispatch'=>false,'version'=>1,'workerToken'=>str_repeat('f',64),'privateKey'=>$pem,'publicKey'=>rtrim(strtr(base64_encode($pub),'+/','-_'),'=')];file_put_contents('/tmp/noa-notifications-private/config.json',json_encode($cfg));chmod('/tmp/noa-notifications-private/config.json',0600);
function check($v,$label){if(!$v)throw new RuntimeException($label);}
function count_notices(PDO $db):int{return (int)$db->query('SELECT COUNT(*) FROM noa_notifications')->fetchColumn();}
function fixture_subscription(string $name):array{$key=openssl_pkey_new(['private_key_type'=>OPENSSL_KEYTYPE_EC,'curve_name'=>'prime256v1']);$d=openssl_pkey_get_details($key);return ['endpoint'=>'https://fcm.googleapis.com/fcm/send/'.$name,'keys'=>['p256dh'=>rtrim(strtr(base64_encode("\x04".str_pad($d['ec']['x'],32,"\0",STR_PAD_LEFT).str_pad($d['ec']['y'],32,"\0",STR_PAD_LEFT)),'+/','-_'),'='),'auth'=>rtrim(strtr(base64_encode(str_repeat('a',16)),'+/','-_'),'=')]];}
$entity='song:'.str_repeat('a',64);$now=time();
check(nnt_target($db,'video:abcdefghijk','qa_a')['url']==='/noa-youtube.php?track=abcdefghijk','video activity opens the exact track');
ne_like($db,$entity,'qa_b',true,false,$now-50);
$nativeBefore=$db->query('SELECT COUNT(*) FROM g5_write_free')->fetchColumn();
check(count(nnt_install($db))===5&&nnt_install($db)===[],'additive idempotent schema');nnt_collect($db,$now);check(count_notices($db)===0,'no historical backfill');
$sub=fixture_subscription('owner-a');$device=nnt_subscribe($db,'qa_a',$sub,$now);$same=nnt_subscribe($db,'qa_a',$sub,$now);check($same===$device,'subscription replay');
foreach(['http://fcm.googleapis.com/a','https://127.0.0.1/a','https://evil.example/a','https://fcm.googleapis.com.evil.example/a','https://fcm.googleapis.com@evil.example/a','https://fcm.googleapis.com:8443/a']as $url)check(!nnt_endpoint($url),'SSRF denied');
// A new like and a real comment from another member notify the document owner.
ne_like($db,$entity,'qa_b',false,false,$now);ne_like($db,$entity,'qa_b',true,false,$now+1);
$comment=ne_comment($db,$entity,'qa_b','33333333-3333-4333-8333-333333333333','민감한 실제 본문은 푸시에 넣지 않습니다',$now+2);
nnt_collect($db,$now+3);check(count_notices($db)===2,'owner like and comment');nnt_collect($db,$now+4);check(count_notices($db)===2,'cursor replay');
$jobs=nnt_claim($db,$now+5);check(count($jobs)===2,'two consented deliveries');check(!str_contains(json_encode($jobs,JSON_UNESCAPED_UNICODE),'민감한 실제 본문'),'generic lockscreen body');check(nnt_claim($db,$now+6)===[],'lease exclusive');
check(nnt_ack($db,[['id'=>$jobs[0]['id'],'device'=>$device,'lease'=>'wrong','http'=>201]],$now+7)===0,'stale lease rejected');
check(nnt_ack($db,[['id'=>$jobs[0]['id'],'device'=>$device,'lease'=>$jobs[0]['lease'],'http'=>201]],$now+7)===1,'acceptance recorded');
// Unsubscribing cancels queued/leased messages; old acceptance cannot disable a renewed device.
nnt_unsubscribe($db,'qa_a',$device);check(nnt_claim($db,$now+500)===[],'unsubscribe cancels');nnt_subscribe($db,'qa_a',$sub,$now+10);
check(nnt_ack($db,[['id'=>$jobs[1]['id'],'device'=>$device,'lease'=>$jobs[1]['lease'],'http'=>410]],$now+11)===0,'old device lease rejected');check((bool)nnt_one($db,'SELECT active FROM noa_push_subscriptions WHERE endpoint_hash=?',[$device])['active'],'renewed device preserved');
// Soft deletion and unlike prevent queued notification delivery and inbox exposure.
ne_like($db,$entity,'qa_b',false,false,$now+12);ne_delete($db,$comment,'qa_b',false,$now+12);check(nnt_inbox($db,'qa_a')['unread']===0,'cancelled activity removed from inbox');
$self=ne_comment($db,$entity,'qa_a','44444444-4444-4444-8444-444444444444','내가 쓴 글',$now+20);nnt_collect($db,$now+21);check(count_notices($db)===2,'self excluded');
$other=ne_comment($db,$entity,'qa_b','55555555-5555-4555-8555-555555555555','참여 댓글',$now+30);nnt_collect($db,$now+31);
$third=ne_comment($db,$entity,'qa_temp','66666666-6666-4666-8666-666666666666','다른 참여자',$now+40);nnt_collect($db,$now+41);check(nnt_one($db,"SELECT 1 FROM noa_notifications WHERE recipient='qa_b' AND kind='reply' AND source_id=?",[$third])!==null,'participant notified');
$ownId=(int)nnt_one($db,"SELECT MAX(id) id FROM noa_notifications WHERE recipient='qa_a'")['id'];nnt_mark($db,'qa_b',$ownId);check(nnt_one($db,'SELECT read_at FROM noa_notifications WHERE id=?',[$ownId])['read_at']===null,'cross-account read denied');
nnt_preferences($db,'qa_a',['likes'=>false,'comments'=>false,'replies'=>false]);check(nnt_claim($db,$now+42)===[],'preferences stop pending delivery');
// Native comment and actual GnuBoard reply path are resolved from stored identity.
nnt_preferences($db,'qa_a',['likes'=>true,'comments'=>true,'replies'=>true]);
$db->exec("INSERT INTO g5_write_free (wr_id,wr_parent,wr_is_comment,wr_comment,wr_comment_reply,mb_id,wr_content,wr_datetime) VALUES (20,1,1,1,'','qa_b','native comment',NOW()),(21,1,1,1,'A','qa_temp','native reply',NOW())");
$db->exec("INSERT INTO g5_board_new (bo_table,wr_id,wr_parent,bn_datetime,mb_id) VALUES ('free',20,1,NOW(),'qa_b'),('free',21,1,NOW(),'qa_temp')");nnt_collect($db,$now+43);check(nnt_one($db,"SELECT 1 FROM noa_notifications WHERE recipient='qa_b' AND source='native_comment' AND source_id=21 AND kind='reply'")!==null,'native reply recipient');
// Private song request: administrator's answer only to the request owner, no body/title.
$db->exec("INSERT INTO g5_write_song_request (wr_id,wr_parent,wr_is_comment,mb_id,wr_option,wr_subject,wr_content,wr_datetime) VALUES (1,1,0,'qa_a','secret','private title','private body',NOW()),(2,1,1,'qa_admin','secret','','private answer',NOW())");
$db->exec("INSERT INTO g5_board_new (bo_table,wr_id,wr_parent,bn_datetime,mb_id) VALUES ('song_request',2,1,NOW(),'qa_admin')");nnt_collect($db,$now+44);$private=nnt_rows($db,"SELECT * FROM noa_notifications WHERE kind='request_reply'");check(count($private)===1&&$private[0]['recipient']==='qa_a','private owner only');check(nnt_source_alive($db,$private[0]),'private reply remains accessible');
// Endpoint transfer cannot deliver a previous account's queue to its new user.
nnt_subscribe($db,'qa_b',$sub,$now+45);nnt_unsubscribe($db,'qa_a',$device);check(nnt_one($db,'SELECT owner,active FROM noa_push_subscriptions WHERE endpoint_hash=?',[$device])['owner']==='qa_b','device transfer ownership');check((bool)nnt_one($db,'SELECT active FROM noa_push_subscriptions WHERE endpoint_hash=?',[$device])['active'],'cross-account unsubscribe denied');
nnt_subscribe($db,'qa_a',$sub,$now+46);nnt_enqueue($db,'qa_a','test-expiry','test','test','qa_a','test',0,'/noa-notifications.php',$now+46);$last=nnt_claim($db,$now+47);check(count($last)===1,'test queue');nnt_ack($db,[['id'=>$last[0]['id'],'device'=>$device,'lease'=>$last[0]['lease'],'http'=>410]],$now+48);check(!nnt_one($db,'SELECT active FROM noa_push_subscriptions WHERE endpoint_hash=?',[$device])['active'],'expired endpoint disabled');
check((int)$db->query('SELECT COUNT(*) FROM g5_write_free')->fetchColumn()===(int)$nativeBefore+2,'only explicit fixture native rows changed');
@mkdir('notifications-proof',0700,true);file_put_contents('notifications-proof/mysql.json',json_encode(['additiveSchema'=>true,'noHistoricalBackfill'=>true,'ownerAndParticipants'=>true,'privateRequestOwnerOnly'=>true,'selfExcluded'=>true,'cursorReplay'=>true,'genericPayload'=>true,'leaseAndAck'=>true,'sourceDeletion'=>true,'preferenceEnforcement'=>true,'deviceTransferAndRevocation'=>true,'endpointAllowlist'=>true,'crossAccountReadsDenied'=>true,'nativeDataPreserved'=>true],JSON_PRETTY_PRINT));
// Direct delivery uses the same consent checks, leases, receipt payload and retry queue.
require 'bridge/notifications-inline.php';
$db->exec('DELETE FROM noa_notification_delivery');$db->exec('DELETE FROM noa_push_subscriptions');
$direct=nnt_subscribe($db,'qa_a',fixture_subscription('direct'),time());
nnt_enqueue($db,'qa_a','direct-success','test','test','qa_a','test',0,'/noa-notifications.php',time());
$directCfg=$cfg;$directCfg['inlineDispatch']=true;$calls=0;
$result=nnt_inline_drain($db,$directCfg,static function($job)use(&$calls){$calls++;check(strlen($job['payload']['receipt'])===64,'direct receipt token');return 201;});
check($calls===1&&$result['accepted']===1,'direct send without scheduled runner');
check(nnt_inline_drain($db,$directCfg,static fn()=>201)['claimed']===0,'direct no duplicate');
nnt_enqueue($db,'qa_a','direct-retry','test','test','qa_a','test',0,'/noa-notifications.php',time());
check(nnt_inline_drain($db,$directCfg,static fn()=>503)['retry']===1,'direct transient retry');
check(nnt_inline_drain($db,$directCfg,static fn()=>201)['claimed']===0,'retry backoff respected');
nnt_unsubscribe($db,'qa_a',$direct);
check(nnt_inline_drain($db,$directCfg,static fn()=>201)['claimed']===0,'revoked direct delivery cancelled');
echo "NOTIFICATIONS_INLINE_PASS\n";
// Direct reply goes to the actual parent author, not unrelated participants.
$directReply=ne_comment($db,$entity,'qa_a','dddddddd-dddd-4ddd-8ddd-dddddddddddd','direct reply',$now+100,['kind'=>'app','id'=>$other]);nnt_collect($db,$now+101);
check(nnt_one($db,"SELECT 1 FROM noa_notifications WHERE source='app_comment' AND source_id=? AND recipient='qa_b' AND kind='reply'",[$directReply])!==null,'direct parent recipient');
check(nnt_one($db,"SELECT 1 FROM noa_notifications WHERE source='app_comment' AND source_id=? AND recipient='qa_temp'",[$directReply])===null,'no unrelated reply recipient');
$db->exec("UPDATE g5_write_free SET wr_name='별무리 A' WHERE wr_id=1");
$inline=ne_comment($db,'board:free:1','qa_b','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','알림에서 답할 원래 댓글',$now+102);nnt_collect($db,$now+103);
$notice=nnt_one($db,"SELECT id FROM noa_notifications WHERE recipient='qa_a' AND source='app_comment' AND source_id=?",[$inline]);
check(nnt_thread($db,'qa_a',(int)$notice['id'])['replyTo']['id']===$inline,'owned inline thread');
try{nnt_thread($db,'qa_b',(int)$notice['id']);throw new RuntimeException('cross account thread');}catch(DomainException $expected){}
check(nnt_thread($db,'qa_a',(int)$private[0]['id'])===['private'=>true,'id'=>1],'private thread remains gated');
// Leave useful owned inbox items for UI/API tests, no active external subscriptions.
$db->exec('DELETE FROM noa_notification_delivery');$db->exec('DELETE FROM noa_push_subscriptions');
file_put_contents($root.'/notification-shell.php',"<?php require __DIR__.'/common.php';?><!doctype html><html lang=ko><head><meta charset=utf-8><link rel=stylesheet href=/noa-ui.css><link rel=stylesheet href=/noa-ainoa.css><script src=/noa-ainoa.js defer></script></head><body class=noa-page><main><h1>NOA STUDIO</h1></main></body></html>");
echo "NOTIFICATIONS_MYSQL_PASS\n";
