<?php
declare(strict_types=1);
if(!defined('_GNUBOARD_')){http_response_code(403);exit;}
function nnt_one(PDO $db,string $sql,array $args=[]):?array{$q=$db->prepare($sql);$q->execute($args);return $q->fetch(PDO::FETCH_ASSOC)?:null;}
function nnt_rows(PDO $db,string $sql,array $args=[]):array{$q=$db->prepare($sql);$q->execute($args);return $q->fetchAll(PDO::FETCH_ASSOC);}
function nnt_exec(PDO $db,string $sql,array $args=[]):int{$q=$db->prepare($sql);$q->execute($args);return $q->rowCount();}
function nnt_table(string $name):string{if(!preg_match('/^[A-Za-z0-9_]+$/D',$name))throw new RuntimeException('invalid_table');return '`'.$name.'`';}
function nnt_exists(PDO $db,string $name):bool{return (bool)nnt_one($db,'SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?',[$name]);}
function nnt_schema():array{return [
 'noa_notifications'=>"(id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,recipient VARCHAR(191) NOT NULL,event_key CHAR(64) NOT NULL,kind VARCHAR(20) NOT NULL,entity VARCHAR(191) NOT NULL,actor VARCHAR(191) NOT NULL,source VARCHAR(20) NOT NULL,source_id BIGINT NOT NULL,url VARCHAR(500) NOT NULL,created_at BIGINT NOT NULL,read_at BIGINT NULL,cancelled_at BIGINT NULL,UNIQUE KEY(recipient,event_key),KEY(recipient,id),KEY(created_at))",
 'noa_notification_settings'=>"(owner VARCHAR(191) PRIMARY KEY,likes TINYINT NOT NULL DEFAULT 1,comments TINYINT NOT NULL DEFAULT 1,replies TINYINT NOT NULL DEFAULT 1,updated_at BIGINT NOT NULL)",
 'noa_push_subscriptions'=>"(endpoint_hash CHAR(64) PRIMARY KEY,owner VARCHAR(191) NOT NULL,endpoint TEXT NOT NULL,p256dh VARCHAR(100) NOT NULL,auth VARCHAR(32) NOT NULL,generation CHAR(32) NOT NULL,active TINYINT NOT NULL DEFAULT 1,created_at BIGINT NOT NULL,updated_at BIGINT NOT NULL,KEY(owner,active))",
 'noa_notification_delivery'=>"(notification_id BIGINT UNSIGNED NOT NULL,endpoint_hash CHAR(64) NOT NULL,generation CHAR(32) NOT NULL,state VARCHAR(16) NOT NULL DEFAULT 'pending',attempts INT NOT NULL DEFAULT 0,next_at BIGINT NOT NULL,lease_until BIGINT NULL,lease_token CHAR(32) NULL,receipt_hash CHAR(64) NULL,sent_at BIGINT NULL,received_at BIGINT NULL,http_code INT NULL,PRIMARY KEY(notification_id,endpoint_hash),KEY(state,next_at))",
 'noa_notification_cursor'=>"(source VARCHAR(100) PRIMARY KEY,position BIGINT NOT NULL)"
];}
function nnt_ready(PDO $db):bool{foreach(array_keys(nnt_schema())as $t)if(!nnt_exists($db,$t))return false;return true;}
function nnt_install(PDO $db):array{
 global $g5;$created=[];
 foreach(nnt_schema()as $t=>$ddl){if(!nnt_exists($db,$t)){$db->exec("CREATE TABLE `$t` $ddl ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin");$created[]=$t;}
  preg_match_all('/(?:^\(|,)([a-z_]+) (?:VARCHAR|CHAR|TEXT|BIGINT|TINYINT|INT)/',$ddl,$m);if(array_diff($m[1],$db->query("SHOW COLUMNS FROM `$t`")->fetchAll(PDO::FETCH_COLUMN)))throw new RuntimeException('notification_schema_conflict');
  if(($db->query("SHOW TABLE STATUS LIKE '$t'")->fetch(PDO::FETCH_ASSOC)['Engine']??'')!=='InnoDB')throw new RuntimeException('notification_storage_required');
 }
 // Start at installation. Existing activity must not become a new-notification flood.
 $sources=['app_likes'=>['noa_post_like_events','id'],'app_comments'=>['noa_post_comments','id'],'native_new'=>[$g5['board_new_table'],'bn_id'],'native_good'=>[$g5['board_good_table'],'bg_id']];
 foreach($sources as $name=>[$table,$column]){$max=nnt_exists($db,$table)?(int)$db->query('SELECT COALESCE(MAX('.nnt_table($column).'),0) FROM '.nnt_table($table))->fetchColumn():0;nnt_exec($db,'INSERT IGNORE INTO noa_notification_cursor VALUES (?,?)',[$name,$max]);nnt_exec($db,'INSERT IGNORE INTO noa_notification_cursor VALUES (?,?)',['baseline:'.$name,$max]);}
 nnt_exec($db,'INSERT IGNORE INTO noa_notification_cursor VALUES (?,?)',['installed_at',time()]);return $created;
}
function nnt_config():array{
 $path=dirname(defined('G5_PATH')?G5_PATH:dirname(__DIR__)).'/noa-notifications-private/config.json';
 if(!is_file($path))throw new DomainException('not_ready');$c=json_decode(file_get_contents($path),true,16,JSON_THROW_ON_ERROR);
 if(!is_array($c)||!preg_match('/^[A-Za-z0-9_-]{87}$/D',$c['publicKey']??'')||!preg_match('/^[a-f0-9]{64}$/D',$c['workerToken']??''))throw new DomainException('not_ready');return $c;
}
function nnt_member(PDO $db,string $owner):?array{
 global $g5;if($owner===''||strlen($owner)>191)return null;
 $m=nnt_one($db,'SELECT mb_id,mb_level,mb_leave_date,mb_intercept_date FROM '.nnt_table($g5['member_table']).' WHERE mb_id=?',[$owner]);
 return $m&&(int)$m['mb_level']>=2&&empty($m['mb_leave_date'])&&empty($m['mb_intercept_date'])?$m:null;
}
function nnt_settings(PDO $db,string $owner):array{$r=nnt_one($db,'SELECT likes,comments,replies FROM noa_notification_settings WHERE owner=?',[$owner])??['likes'=>1,'comments'=>1,'replies'=>1];return array_map(static fn($v)=>(bool)$v,$r);}
function nnt_category(string $kind):string{return match($kind){'like'=>'likes','comment'=>'comments',default=>'replies'};}
function nnt_copy(string $kind):string{return match($kind){'gift_expiring'=>'미사용 선물이 한 달 이내에 만료돼요. 받은 선물함에서 사용하거나 1년 연장하세요.','like'=>'내 게시물에 좋아요가 도착했어요.','comment'=>'내 게시물에 새 댓글이 달렸어요.','reply'=>'내가 참여한 게시물에 새 답글이 달렸어요.','request_reply'=>'사연 신청에 답변이 도착했어요.','new_post'=>'게시판에 새 글이 등록됐어요.','test'=>'알림이 연결됐어요. 앞으로 내 활동 소식을 알려드릴게요.',default=>'나와 관련된 새로운 활동이 있어요.'};}
function nnt_enqueue(PDO $db,string $recipient,string $event,string $kind,string $entity,string $actor,string $source,int $sourceId,string $url,int $now):?int{
 if(($recipient===$actor&&$kind!=='test')||!nnt_member($db,$recipient)||!str_starts_with($url,'/')||str_starts_with($url,'//')||strlen($url)>500)return null;
 if(!in_array($kind,['test','new_post','gift_expiring'],true)&&!nnt_settings($db,$recipient)[nnt_category($kind)])return null;
 $key=hash('sha256',$event);$inserted=nnt_exec($db,'INSERT IGNORE INTO noa_notifications (recipient,event_key,kind,entity,actor,source,source_id,url,created_at) VALUES (?,?,?,?,?,?,?,?,?)',[$recipient,$key,$kind,$entity,$actor,$source,$sourceId,$url,$now]);
 $row=nnt_one($db,'SELECT id FROM noa_notifications WHERE recipient=? AND event_key=?',[$recipient,$key]);$id=(int)$row['id'];
 if($inserted&&$kind!=='new_post')nnt_exec($db,"INSERT IGNORE INTO noa_notification_delivery (notification_id,endpoint_hash,generation,next_at) SELECT ?,endpoint_hash,generation,? FROM noa_push_subscriptions WHERE owner=? AND active=1",[$id,$now,$recipient]);
 return $id;
}
function nnt_endpoint(string $url):bool{
 if(strlen($url)>4096||preg_match('/[\x00-\x20\x7f]/',$url))return false;$u=parse_url($url);if(!$u||($u['scheme']??'')!=='https'||isset($u['user'])||isset($u['pass'])||isset($u['fragment'])||(isset($u['port'])&&$u['port']!==443))return false;
 $h=strtolower($u['host']??'');return in_array($h,['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'],true)||preg_match('/^[a-z0-9-]+\.push\.apple\.com$/D',$h)===1||preg_match('/^[a-z0-9-]+\.notify\.windows\.com$/D',$h)===1;
}
function nnt_subscription(array $s):array{
 $endpoint=$s['endpoint']??'';$keys=$s['keys']??[];if(!is_string($endpoint)||!nnt_endpoint($endpoint)||!is_array($keys))throw new DomainException('invalid_subscription');
 $decode=static function($v,$bytes){if(!is_string($v)||!preg_match('/^[A-Za-z0-9_-]+={0,2}$/D',$v))return false;$raw=base64_decode(strtr($v,'-_','+/'),true);return is_string($raw)&&strlen($raw)===$bytes?$raw:false;};
 $p=$decode($keys['p256dh']??null,65);$a=$decode($keys['auth']??null,16);if($p===false||$p[0]!=="\x04"||$a===false)throw new DomainException('invalid_subscription');
 return ['endpoint'=>$endpoint,'p256dh'=>rtrim($keys['p256dh'],'='),'auth'=>rtrim($keys['auth'],'=')];
}
function nnt_subscribe(PDO $db,string $owner,array $data,int $now):string{
 $s=nnt_subscription($data);$hash=hash('sha256',$s['endpoint']);$db->beginTransaction();
 try{
  // Serialise account registrations and transfers of this browser's subscription.
  global $g5;nnt_one($db,'SELECT mb_id FROM '.nnt_table($g5['member_table']).' WHERE mb_id=? FOR UPDATE',[$owner]);
  $old=nnt_one($db,'SELECT * FROM noa_push_subscriptions WHERE endpoint_hash=? FOR UPDATE',[$hash]);
  $count=(int)nnt_one($db,'SELECT COUNT(*) n FROM noa_push_subscriptions WHERE owner=? AND active=1 AND endpoint_hash<>?',[$owner,$hash])['n'];if($count>=8)throw new DomainException('device_limit');
  if($old&&$old['owner']===$owner&&$old['active']&&$old['p256dh']===$s['p256dh']&&$old['auth']===$s['auth']){$db->commit();return $hash;}
  $generation=bin2hex(random_bytes(16));
  nnt_exec($db,"INSERT INTO noa_push_subscriptions VALUES (?,?,?,?,?,?,1,?,?) ON DUPLICATE KEY UPDATE owner=VALUES(owner),endpoint=VALUES(endpoint),p256dh=VALUES(p256dh),auth=VALUES(auth),generation=VALUES(generation),active=1,updated_at=VALUES(updated_at)",[$hash,$owner,$s['endpoint'],$s['p256dh'],$s['auth'],$generation,$now,$now]);
  nnt_exec($db,"UPDATE noa_notification_delivery SET state='cancelled' WHERE endpoint_hash=? AND state IN ('pending','leased')",[$hash]);$db->commit();return $hash;
 }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
}
function nnt_unsubscribe(PDO $db,string $owner,string $hash,bool $all=false):void{
 $db->beginTransaction();try{$args=[$owner];$where='owner=?';if(!$all){$where.=' AND endpoint_hash=?';$args[]=$hash;}
  nnt_exec($db,"UPDATE noa_push_subscriptions SET active=0,updated_at=".time()." WHERE $where",$args);
  $joined='s.owner=?'.(!$all?' AND s.endpoint_hash=?':'');nnt_exec($db,"UPDATE noa_notification_delivery d JOIN noa_push_subscriptions s ON s.endpoint_hash=d.endpoint_hash SET d.state='cancelled' WHERE $joined AND d.state IN ('pending','leased')",$args);$db->commit();
 }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
}
function nnt_preferences(PDO $db,string $owner,array $values):void{
 foreach(['likes','comments','replies']as $key)if(!is_bool($values[$key]??null))throw new DomainException('invalid_preferences');
 nnt_exec($db,'INSERT INTO noa_notification_settings VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE likes=VALUES(likes),comments=VALUES(comments),replies=VALUES(replies),updated_at=VALUES(updated_at)',[$owner,(int)$values['likes'],(int)$values['comments'],(int)$values['replies'],time()]);
}
/** Filter before pagination so older comments are not hidden behind newer reactions. */
function nnt_filter(string $filter):string{return match($filter){'all'=>'','unread'=>' AND read_at IS NULL','comments'=>" AND kind IN ('comment','reply','request_reply')",'posts'=>" AND kind='new_post'",'reactions'=>" AND kind='like'",'system'=>" AND kind NOT IN ('comment','reply','request_reply','like','new_post')",default=>throw new DomainException('invalid_filter')};}
function nnt_inbox(PDO $db,string $owner,int $before=0,string $filter='all'):array{
 $scope=nnt_filter($filter);
 foreach(nnt_rows($db,'SELECT * FROM noa_notifications WHERE recipient=? AND cancelled_at IS NULL ORDER BY id DESC LIMIT 200',[$owner])as $r)if(!nnt_source_alive($db,$r))nnt_exec($db,'UPDATE noa_notifications SET cancelled_at=? WHERE id=? AND recipient=?',[time(),$r['id'],$owner]);
 $rows=nnt_rows($db,'SELECT * FROM noa_notifications WHERE recipient=? AND cancelled_at IS NULL'.$scope.($before>0?' AND id<?':'').' ORDER BY id DESC LIMIT 31',$before>0?[$owner,$before]:[$owner]);$more=count($rows)>30;$rows=array_slice($rows,0,30);
 $counts=['all'=>0,'unread'=>0,'comments'=>0,'reactions'=>0,'posts'=>0,'system'=>0];
 foreach(nnt_rows($db,'SELECT kind,COUNT(*) n,SUM(read_at IS NULL) unread FROM noa_notifications WHERE recipient=? AND cancelled_at IS NULL GROUP BY kind',[$owner])as $group){$n=(int)$group['n'];$counts['all']+=$n;$counts['unread']+=(int)$group['unread'];$counts[in_array($group['kind'],['comment','reply','request_reply'],true)?'comments':($group['kind']==='like'?'reactions':($group['kind']==='new_post'?'posts':'system'))]+=$n;}
 $snapshot=(int)nnt_one($db,'SELECT COALESCE(MAX(id),0) id FROM noa_notifications WHERE recipient=? AND cancelled_at IS NULL'.$scope,[$owner])['id'];
 return ['items'=>array_map(static fn($r)=>['id'=>(int)$r['id'],'kind'=>$r['kind'],'text'=>nnt_copy($r['kind']),'url'=>$r['url'],'at'=>gmdate('c',(int)$r['created_at']),'read'=>$r['read_at']!==null]+nnt_preview($db,$owner,$r),$rows),'filter'=>$filter,'counts'=>$counts,'snapshot'=>$snapshot,'more'=>$more,'before'=>$more?(int)end($rows)['id']:null,'unread'=>$counts['unread']];
}
function nnt_mark(PDO $db,string $owner,int $id,bool $all=false,string $filter='all',bool $read=true):void{
 $scope=nnt_filter($filter);if($id<1)return;if($all&&!$read)throw new DomainException('invalid_input');
 nnt_exec($db,'UPDATE noa_notifications SET read_at='.($read?'COALESCE(read_at,?)':'NULL').' WHERE recipient=? AND cancelled_at IS NULL AND id'.($all?'<=?':'=?').($all?$scope:''),$read?[time(),$owner,$id]:[$owner,$id]);
}
function nnt_claim(PDO $db,int $now,int $limit=20):array{
 $limit=max(1,min(20,$limit));
 $db->beginTransaction();try{
  $rows=nnt_rows($db,"SELECT d.*,n.recipient,n.kind,n.entity,n.source,n.source_id,n.actor,n.url,n.cancelled_at,s.owner,s.active,s.generation current_generation,s.endpoint,s.p256dh,s.auth FROM noa_notification_delivery d JOIN noa_notifications n ON n.id=d.notification_id JOIN noa_push_subscriptions s ON s.endpoint_hash=d.endpoint_hash WHERE ((d.state='pending' AND d.next_at<=?) OR (d.state='leased' AND d.lease_until<?)) ORDER BY d.notification_id LIMIT $limit FOR UPDATE",[$now,$now]);$jobs=[];
  foreach($rows as $r){$valid=$r['active']&&$r['cancelled_at']===null&&$r['owner']===$r['recipient']&&hash_equals($r['generation'],$r['current_generation'])&&nnt_member($db,$r['recipient'])&&(in_array($r['kind'],['test','gift_expiring'],true)||nnt_settings($db,$r['recipient'])[nnt_category($r['kind'])])&&nnt_source_alive($db,$r);
   if(!$valid||$r['attempts']>=8){nnt_exec($db,"UPDATE noa_notification_delivery SET state='cancelled' WHERE notification_id=? AND endpoint_hash=?",[$r['notification_id'],$r['endpoint_hash']]);continue;}
   $lease=bin2hex(random_bytes(16));$receipt=bin2hex(random_bytes(32));nnt_exec($db,"UPDATE noa_notification_delivery SET state='leased',attempts=attempts+1,lease_until=?,lease_token=?,receipt_hash=? WHERE notification_id=? AND endpoint_hash=?",[$now+240,$lease,hash('sha256',$receipt),$r['notification_id'],$r['endpoint_hash']]);
   $jobs[]=['id'=>(int)$r['notification_id'],'device'=>$r['endpoint_hash'],'generation'=>$r['generation'],'lease'=>$lease,'subscription'=>['endpoint'=>$r['endpoint'],'keys'=>['p256dh'=>$r['p256dh'],'auth'=>$r['auth']]],'payload'=>['title'=>'AInoa · 내 활동 알림','body'=>nnt_copy($r['kind']),'url'=>'/noa-notifications.php?notice='.$r['notification_id'],'tag'=>'noa-activity-'.$r['notification_id'],'id'=>(int)$r['notification_id'],'receipt'=>$receipt]];
  }$db->commit();return $jobs;
 }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
}
function nnt_ack(PDO $db,array $results,int $now):int{
 $count=0;foreach(array_slice($results,0,100)as $r){if(!is_array($r)||!is_int($r['id']??null)||!is_string($r['device']??null)||!is_string($r['lease']??null)||!is_int($r['http']??null))continue;
  $db->beginTransaction();try{$job=nnt_one($db,"SELECT * FROM noa_notification_delivery WHERE notification_id=? AND endpoint_hash=? AND state='leased' AND lease_token=? FOR UPDATE",[$r['id'],$r['device'],$r['lease']]);if(!$job){$db->commit();continue;}$code=$r['http'];$ok=$code>=200&&$code<300;$gone=in_array($code,[404,410],true);$state=$ok?'sent':($gone||$job['attempts']>=8?'failed':'pending');
   nnt_exec($db,'UPDATE noa_notification_delivery SET state=?,next_at=?,sent_at=?,http_code=?,lease_until=NULL,lease_token=NULL WHERE notification_id=? AND endpoint_hash=?',[$state,$now+min(21600,60*(2**min(8,(int)$job['attempts']))),$ok?$now:null,$code,$r['id'],$r['device']]);
   if($gone)nnt_exec($db,'UPDATE noa_push_subscriptions SET active=0,updated_at=? WHERE endpoint_hash=? AND generation=?',[$now,$r['device'],$job['generation']]);$db->commit();$count++;
  }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
 }return $count;
}
