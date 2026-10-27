<?php
declare(strict_types=1);
if (!defined('_GNUBOARD_')) { http_response_code(403); exit; }

/** Additive app records. Native posts, comments, likes and member rows are never rewritten. */
function ne_schema(): array {
 return [
  'noa_post_likes'=>"(entity VARCHAR(191) NOT NULL,owner VARCHAR(191) NOT NULL,active TINYINT NOT NULL,updated_at BIGINT NOT NULL,PRIMARY KEY(entity,owner))",
  'noa_post_like_events'=>"(id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,entity VARCHAR(191) NOT NULL,owner VARCHAR(191) NOT NULL,active TINYINT NOT NULL,created_at BIGINT NOT NULL,KEY(entity,owner,id),KEY(created_at),KEY(owner,created_at))",
  'noa_post_comments'=>"(id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,entity VARCHAR(191) NOT NULL,owner VARCHAR(191) NOT NULL,request_id CHAR(36) NOT NULL,body TEXT NOT NULL,created_at BIGINT NOT NULL,deleted_at BIGINT NULL,UNIQUE KEY(owner,request_id),KEY(entity,created_at,id),KEY(owner,created_at))"
 ];
}
function ne_ready(PDO $db): bool {
 foreach(array_keys(ne_schema()) as $t) { $q=$db->prepare('SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?');$q->execute([$t]);if(!(int)$q->fetchColumn())return false; }return true;
}
function ne_install(PDO $db): array {
 $created=[];
 foreach(ne_schema() as $t=>$ddl) {
  $q=$db->prepare('SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?');$q->execute([$t]);
  if(!(int)$q->fetchColumn()){$db->exec("CREATE TABLE `$t` $ddl ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin");$created[]=$t;}
  preg_match_all('/(?:^\(|,)([a-z_]+) (?:VARCHAR|CHAR|TEXT|BIGINT|TINYINT)/',$ddl,$m);
  if(array_diff($m[1],$db->query("SHOW COLUMNS FROM `$t`")->fetchAll(PDO::FETCH_COLUMN)))throw new RuntimeException('engagement_schema_conflict');
  $engine=$db->query("SHOW TABLE STATUS LIKE '$t'")->fetch(PDO::FETCH_ASSOC);if(($engine['Engine']??'')!=='InnoDB')throw new RuntimeException('engagement_storage_required');
 }return $created;
}
function ne_one(PDO $db,string $sql,array $args=[]): ?array {$q=$db->prepare($sql);$q->execute($args);return $q->fetch(PDO::FETCH_ASSOC)?:null;}
function ne_rows(PDO $db,string $sql,array $args=[]): array {$q=$db->prepare($sql);$q->execute($args);return $q->fetchAll(PDO::FETCH_ASSOC);}
function ne_table(string $t): string {if(!preg_match('/^[A-Za-z0-9_]+$/D',$t))throw new RuntimeException('invalid_table');return '`'.$t.'`';}
function ne_lock(PDO $db,string $owner,callable $fn): mixed {
 $key='noa_engagement_'.substr(hash('sha256',$owner),0,40);$q=$db->prepare('SELECT GET_LOCK(?,5)');$q->execute([$key]);if((int)$q->fetchColumn()!==1)throw new DomainException('try_later');
 try{$db->beginTransaction();$out=$fn();$db->commit();return $out;}catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}finally{$q=$db->prepare('SELECT RELEASE_LOCK(?)');$q->execute([$key]);}
}
function ne_like(PDO $db,string $entity,string $owner,bool $active,bool $legacyLiked=false,?int $now=null): void {
 $now??=time();ne_lock($db,$owner,function()use($db,$entity,$owner,$active,$legacyLiked,$now){
  $old=ne_one($db,'SELECT active FROM noa_post_likes WHERE entity=? AND owner=? FOR UPDATE',[$entity,$owner]);if(($old?(bool)$old['active']:$legacyLiked)===$active)return;
  $count=ne_one($db,'SELECT COUNT(*) n FROM noa_post_like_events WHERE owner=? AND created_at>?',[$owner,$now-60]);if((int)$count['n']>=30)throw new DomainException('try_later');
  $q=$db->prepare('INSERT INTO noa_post_likes(entity,owner,active,updated_at) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE active=VALUES(active),updated_at=VALUES(updated_at)');$q->execute([$entity,$owner,(int)$active,$now]);
  $q=$db->prepare('INSERT INTO noa_post_like_events(entity,owner,active,created_at) VALUES(?,?,?,?)');$q->execute([$entity,$owner,(int)$active,$now]);
 });
}
function ne_comment(PDO $db,string $entity,string $owner,string $request,string $body,?int $now=null): int {
 $now??=time();$body=trim($body);if(!preg_match('/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/D',$request)||!mb_check_encoding($body,'UTF-8')||$body===''||mb_strlen($body)>2000||str_contains($body,"\0"))throw new DomainException('invalid_comment');
 return ne_lock($db,$owner,function()use($db,$entity,$owner,$request,$body,$now){
  $old=ne_one($db,'SELECT * FROM noa_post_comments WHERE owner=? AND request_id=?',[$owner,$request]);
  if($old){if($old['entity']!==$entity||$old['body']!==$body||$old['deleted_at']!==null)throw new DomainException('request_conflict');return (int)$old['id'];}
  $count=ne_one($db,'SELECT COUNT(*) n FROM noa_post_comments WHERE owner=? AND created_at>?',[$owner,$now-60]);if((int)$count['n']>=5)throw new DomainException('try_later');
  $q=$db->prepare('INSERT INTO noa_post_comments(entity,owner,request_id,body,created_at) VALUES(?,?,?,?,?)');$q->execute([$entity,$owner,$request,$body,$now]);return (int)$db->lastInsertId();
 });
}
function ne_delete(PDO $db,int $id,string $owner,bool $admin,?int $now=null): array {
 $now??=time();return ne_lock($db,$owner,function()use($db,$id,$owner,$admin,$now){
  $row=ne_one($db,'SELECT * FROM noa_post_comments WHERE id=? FOR UPDATE',[$id]);if(!$row||(!$admin&&!hash_equals($row['owner'],$owner)))throw new DomainException('delete_not_allowed');
  if($row['deleted_at']===null){$q=$db->prepare("UPDATE noa_post_comments SET deleted_at=?,body='' WHERE id=? AND deleted_at IS NULL");$q->execute([$now,$id]);}return $row;
 });
}
/** Cutoff state is reconstructed from events; later unlike/delete cannot rewrite past hours. */
function ne_metrics(PDO $db,int $cutoff): array {
 if(!ne_ready($db))return [];$out=[];
 foreach(ne_rows($db,'SELECT e.entity,COUNT(*) n FROM noa_post_like_events e JOIN (SELECT entity,owner,MAX(id) id FROM noa_post_like_events WHERE created_at<? GROUP BY entity,owner) last_event ON last_event.id=e.id WHERE e.active=1 GROUP BY e.entity',[$cutoff])as $r)$out[$r['entity']]['likes']=(int)$r['n'];
 foreach(ne_rows($db,'SELECT entity,COUNT(*) n FROM noa_post_comments WHERE created_at<? AND (deleted_at IS NULL OR deleted_at>=?) GROUP BY entity',[$cutoff,$cutoff])as $r)$out[$r['entity']]['comments']=(int)$r['n'];return $out;
}
