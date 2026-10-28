<?php
declare(strict_types=1);
require_once __DIR__.'/notifications-core.php';
require_once __DIR__.'/engagement-targets.php';

/** Resolve identity and ownership from stored records, never from a client recipient. */
function nnt_target(PDO $db,string $entity,string $viewer=''):?array{
 global $g5,$config,$member,$is_admin;$saved=[$member,$is_admin];
 $account=$viewer!==''?nnt_member($db,$viewer):['mb_id'=>(string)($config['cf_admin']??''),'mb_level'=>10];if(!$account)return null;
 $member=$account;$is_admin=$viewer===''||$viewer===($config['cf_admin']??'')?'super':'';
 try{
  $owner='';$key='';$kind=strtok($entity,':');$id=substr($entity,strlen($kind)+1);
  if($kind==='board'){
   $target=ne_target($db,'board',$id);$post=nnt_one($db,'SELECT mb_id FROM '.$target['table'].' WHERE wr_id=?',[$target['id']]);
   return ['owner'=>(string)$post['mb_id'],'url'=>'/bbs/board.php?bo_table='.rawurlencode($target['board']).'&wr_id='.$target['id'],'target'=>$target];
  }
  if($kind==='song'){
   if(!preg_match('/^[a-f0-9]{64}$/D',$id))return null;$key='catalog:'.$id;$batch=ny_batch($db);$owners=[];
   foreach(nnt_rows($db,"SELECT d.doc_key,d.payload FROM noa_documents d JOIN noa_catalog_aliases a ON a.alias_key=d.doc_key WHERE a.batch_id=? AND a.entity_id=? AND d.kind IN ('single','story','playlist') ORDER BY d.doc_key",[$batch,$id])as $d){$p=json_decode($d['payload'],true);if(!empty($p['ownerId']))$owners[(string)$p['ownerId']]=true;if($key==='catalog:'.$id)$key=$d['doc_key'];}
   if(count($owners)>1)return null;$owner=(string)(array_key_first($owners)??($config['cf_admin']??''));$target=ne_target($db,'music',$key);
  }elseif($kind==='document'){
   if(!preg_match('/^[a-f0-9]{64}$/D',$id))return null;$d=nnt_one($db,"SELECT doc_key,payload FROM noa_documents WHERE SHA2(doc_key,256)=? AND kind IN ('single','story','playlist')",[$id]);if(!$d)return null;$p=json_decode($d['payload'],true);$key=$d['doc_key'];$owner=(string)($p['ownerId']??$config['cf_admin']??'');$target=ne_target($db,'music',$key);
  }elseif(in_array($kind,['video','playlist'],true)){
   $target=ne_target($db,$kind,$id);$owner=(string)($config['cf_admin']??'');return ['owner'=>$owner,'url'=>'/noa-youtube.php?'.($kind==='video'?'track':'playlist').'='.rawurlencode($id),'target'=>$target];
  }else return null;
  if($target['entity']!==$entity)return null;
  return ['owner'=>$owner,'url'=>'/noa-music.php?track='.rawurlencode($key),'target'=>$target];
 }catch(DomainException $e){return null;}finally{[$member,$is_admin]=$saved;}
}
function nnt_request(PDO $db,string $board,int $id):?array{
 global $g5;if($board!=='song_request')return null;$table=nnt_table($g5['write_prefix'].$board);
 $post=nnt_one($db,"SELECT mb_id,wr_is_comment FROM $table WHERE wr_id=?",[$id]);return $post&&!$post['wr_is_comment']&&$post['mb_id']!==''?['owner'=>$post['mb_id'],'url'=>'/bbs/board.php?bo_table=song_request&wr_id='.$id]:null;
}
function nnt_emit(PDO $db,string $recipient,string $event,string $kind,string $entity,string $actor,string $source,int $id,string $url,int $now):void{
 if($kind!=='request_reply'&&!nnt_target($db,$entity,$recipient))return;
 nnt_enqueue($db,$recipient,$event,$kind,$entity,$actor,$source,$id,$url,$now);
}
function nnt_app_event(PDO $db,array $r,bool $like,int $now):void{
 $target=nnt_target($db,$r['entity']);if(!$target)return;
 if($like&&!$r['active'])return;if(!$like&&$r['deleted_at']!==null)return;
 $event=$like?'like:'.$r['entity'].':'.$r['owner']:'comment:'.$r['id'];$source=$like?'app_like':'app_comment';
 nnt_emit($db,$target['owner'],$event,$like?'like':'comment',$r['entity'],$r['owner'],$source,(int)$r['id'],$target['url'],$now);
 if(!$like&&nnt_exists($db,'noa_comment_replies')){
  $link=nnt_one($db,'SELECT parent_kind,parent_id FROM noa_comment_replies WHERE comment_id=?',[$r['id']]);
  if($link){try{$parent=ne_reply_parent($db,$r['entity'],$link['parent_kind'],(int)$link['parent_id']);if($parent['owner']!==$target['owner'])nnt_emit($db,$parent['owner'],$event,'reply',$r['entity'],$r['owner'],$source,(int)$r['id'],$target['url'],$now);}catch(DomainException $e){}return;}
 }
 // Flat comments notify existing participants as thread activity, not as direct mentions.
 if(!$like)foreach(nnt_rows($db,'SELECT DISTINCT owner FROM noa_post_comments WHERE entity=? AND id<? AND deleted_at IS NULL',[$r['entity'],$r['id']])as $p){if($p['owner']===$target['owner'])continue;nnt_emit($db,$p['owner'],$event,'reply',$r['entity'],$r['owner'],$source,(int)$r['id'],$target['url'],$now);}
}
/** Administrator inbox entries stay bound to the currently configured administrator. */
function nnt_admin_post(PDO $db,string $owner,string $board,int $id):bool{
 global $config,$g5;
 if($owner===''||$owner!==($config['cf_admin']??'')||!nnt_member($db,$owner)||!preg_match('/^[A-Za-z0-9_]{1,20}$/D',$board)||!nnt_exists($db,$g5['write_prefix'].$board))return false;
 return nnt_one($db,'SELECT 1 FROM '.nnt_table($g5['board_table']).' WHERE bo_table=?',[$board])!==null&&nnt_one($db,'SELECT 1 FROM '.nnt_table($g5['write_prefix'].$board).' WHERE wr_id=? AND wr_is_comment=0',[$id])!==null;
}
function nnt_native_event(PDO $db,array $r,bool $like,int $now):void{
 global $g5,$config;$board=(string)$r['bo_table'];if(!preg_match('/^[A-Za-z0-9_]{1,20}$/D',$board)||!nnt_exists($db,$g5['write_prefix'].$board))return;
 $table=nnt_table($g5['write_prefix'].$board);$post=nnt_one($db,"SELECT * FROM $table WHERE wr_id=?",[$r['wr_id']]);if(!$post)return;
 $parent=(int)($post['wr_is_comment']?$post['wr_parent']:$post['wr_id']);$entity='board:'.$board.':'.$parent;
 if(!$like&&!$post['wr_is_comment']){
  $admin=(string)($config['cf_admin']??'');
  if(nnt_admin_post($db,$admin,$board,$parent))nnt_enqueue($db,$admin,'admin-post:'.$board.':'.$parent,'new_post',$entity,(string)$post['mb_id'],'native_post',$parent,'/bbs/board.php?bo_table='.rawurlencode($board).'&wr_id='.$parent,$now);
 }
 if($board==='song_request'){
  // A private request produces only an owner notification for a real administrator reply.
  if($like||!$post['wr_is_comment']||$post['mb_id']!==($config['cf_admin']??''))return;$target=nnt_request($db,$board,$parent);if(!$target)return;
  nnt_emit($db,$target['owner'],'native-comment:'.$board.':'.$post['wr_id'],'request_reply',$entity,$post['mb_id'],'native_comment',(int)$post['wr_id'],$target['url'].'#c_'.$post['wr_id'],$now);return;
 }
 $target=nnt_target($db,$entity);if(!$target)return;
 if($like){if($r['bg_flag']!=='good'||$post['wr_is_comment'])return;nnt_emit($db,$target['owner'],'like:'.$entity.':'.$r['mb_id'],'like',$entity,$r['mb_id'],'native_like',(int)$r['bg_id'],$target['url'],$now);return;}
 if(in_array('secret',explode(',',$post['wr_option']),true))return;
 if($post['wr_is_comment']){
  $event='native-comment:'.$board.':'.$post['wr_id'];$url=$target['url'].'#c_'.$post['wr_id'];nnt_emit($db,$target['owner'],$event,'comment',$entity,$post['mb_id'],'native_comment',(int)$post['wr_id'],$url,$now);
  // GnuBoard stores the reply path, not an untrusted recipient id.
  if($post['wr_comment_reply']!==''){$reply=nnt_one($db,"SELECT mb_id FROM $table WHERE wr_parent=? AND wr_is_comment=1 AND wr_comment=? AND wr_comment_reply=?",[$parent,$post['wr_comment'],substr($post['wr_comment_reply'],0,-1)]);if($reply&&$reply['mb_id']!==$target['owner'])nnt_emit($db,$reply['mb_id'],$event,'reply',$entity,$post['mb_id'],'native_comment',(int)$post['wr_id'],$url,$now);}
 }elseif($post['wr_reply']!==''){
  $reply=nnt_one($db,"SELECT wr_id,mb_id FROM $table WHERE wr_num=? AND wr_is_comment=0 AND wr_reply=?",[$post['wr_num'],substr($post['wr_reply'],0,-1)]);
  if($reply&&nnt_target($db,'board:'.$board.':'.$reply['wr_id'],$reply['mb_id']))nnt_emit($db,$reply['mb_id'],'native-reply:'.$board.':'.$post['wr_id'],'reply',$entity,$post['mb_id'],'native_reply',(int)$post['wr_id'],$target['url'],$now);
 }
}
function nnt_collect(PDO $db,int $now):array{
 global $g5;$sources=['app_likes'=>['noa_post_like_events','id'],'app_comments'=>['noa_post_comments','id'],'native_new'=>[$g5['board_new_table'],'bn_id'],'native_good'=>[$g5['board_good_table'],'bg_id']];$counts=[];
 foreach($sources as $source=>[$table,$id]){
  $db->beginTransaction();try{$cursor=nnt_one($db,'SELECT position FROM noa_notification_cursor WHERE source=? FOR UPDATE',[$source]);$baseline=nnt_one($db,'SELECT position FROM noa_notification_cursor WHERE source=?',['baseline:'.$source]);if(!$cursor||!$baseline)throw new RuntimeException('collector_not_initialized');
   // Revisit recent ids for overlapping native/app transactions. Unique event keys
   // keep the overlap idempotent; installation's baseline never becomes a new alert.
   $rows=nnt_rows($db,'SELECT * FROM '.nnt_table($table).' WHERE '.nnt_table($id).'>? ORDER BY '.nnt_table($id).' LIMIT 228',[max((int)$baseline['position'],(int)$cursor['position']-128)]);
   foreach($rows as $row){if(str_starts_with($source,'app_'))nnt_app_event($db,$row,$source==='app_likes',$now);else nnt_native_event($db,$row,$source==='native_good',$now);}
   if($rows)nnt_exec($db,'UPDATE noa_notification_cursor SET position=GREATEST(position,?) WHERE source=?',[(int)end($rows)[$id],$source]);$db->commit();$counts[$source]=count(array_filter($rows,static fn($r)=>(int)$r[$id]>(int)$cursor['position']));
  }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
 }return $counts;
}
function nnt_source_alive(PDO $db,array $r):bool{
 global $g5;if($r['source']==='test')return true;
 if($r['kind']==='new_post')return $r['source']==='native_post'&&preg_match('/^board:([A-Za-z0-9_]{1,20}):([1-9][0-9]*)$/D',$r['entity'],$m)&&nnt_admin_post($db,$r['recipient'],$m[1],(int)$m[2]);
 if($r['source']==='app_comment'){$c=nnt_one($db,'SELECT deleted_at FROM noa_post_comments WHERE id=? AND entity=?',[$r['source_id'],$r['entity']]);if(!$c||$c['deleted_at']!==null)return false;}
 elseif($r['source']==='app_like'){if(!nnt_one($db,'SELECT 1 FROM noa_post_likes WHERE entity=? AND owner=? AND active=1',[$r['entity'],$r['actor']]))return false;}
 elseif(preg_match('/^board:([A-Za-z0-9_]{1,20}):([1-9][0-9]*)$/D',$r['entity'],$m)){
  if(!nnt_exists($db,$g5['write_prefix'].$m[1]))return false;
  if($r['source']==='native_like'){
   if(!nnt_one($db,'SELECT 1 FROM '.nnt_table($g5['board_good_table'])." WHERE bg_id=? AND mb_id=? AND bg_flag='good'",[$r['source_id'],$r['actor']]))return false;
   $override=nnt_one($db,'SELECT active FROM noa_post_likes WHERE entity=? AND owner=?',[$r['entity'],$r['actor']]);if($override&&!$override['active'])return false;
  }else{$post=nnt_one($db,'SELECT mb_id,wr_option FROM '.nnt_table($g5['write_prefix'].$m[1]).' WHERE wr_id=?',[$r['source_id']]);if(!$post||$post['mb_id']!==$r['actor'])return false;
   if($r['kind']==='request_reply'){$request=nnt_request($db,$m[1],(int)$m[2]);return $request&&$request['owner']===$r['recipient'];}
   if(in_array('secret',explode(',',$post['wr_option']),true))return false;
  }
 }else return false;
 return nnt_target($db,$r['entity'],$r['recipient'])!==null;
}
function nnt_prune(PDO $db,int $now):void{
 global $g5;$members=nnt_table($g5['member_table']);
 nnt_exec($db,"UPDATE noa_push_subscriptions s LEFT JOIN $members m ON m.mb_id=s.owner SET s.active=0,s.updated_at=? WHERE s.active=1 AND (m.mb_id IS NULL OR m.mb_level<2 OR m.mb_leave_date<>'' OR m.mb_intercept_date<>'')",[$now]);
 // Data minimisation: expired inbox records, subscriptions and one-time nonces only.
 nnt_exec($db,'DELETE d FROM noa_notification_delivery d JOIN noa_notifications n ON n.id=d.notification_id WHERE n.created_at<?',[$now-90*86400]);
 nnt_exec($db,'DELETE FROM noa_notifications WHERE created_at<?',[$now-90*86400]);
 nnt_exec($db,'DELETE FROM noa_push_subscriptions WHERE active=0 AND updated_at<?',[$now-30*86400]);
 nnt_exec($db,"DELETE FROM noa_notification_cursor WHERE source LIKE 'nonce:%' AND position<?",[$now-600]);
}

/** An inbox id never grants access: check recipient, source and current target gates again. */
function nnt_thread(PDO $db,string $owner,int $id):array {
 $row=nnt_one($db,'SELECT * FROM noa_notifications WHERE id=? AND recipient=? AND cancelled_at IS NULL',[$id,$owner]);
 if(!$row||!nnt_source_alive($db,$row))throw new DomainException('post_not_available');
 if($row['kind']==='new_post'){
  if(preg_match('/^board:song_request:([1-9][0-9]*)$/D',$row['entity'],$m))return ['private'=>true,'id'=>(int)$m[1]];
  if(!nnt_target($db,$row['entity'],$owner))return ['nativeUrl'=>$row['url']];
 }
 if($row['kind']==='test')return ['test'=>true];
 if($row['kind']==='request_reply'&&preg_match('/^board:song_request:([1-9][0-9]*)$/D',$row['entity'],$m))return ['private'=>true,'id'=>(int)$m[1]];
 $resolved=nnt_target($db,$row['entity'],$owner);if(!$resolved)throw new DomainException('post_not_available');$target=$resolved['target'];$focus=null;
 if(in_array($row['source'],['app_comment','native_comment'],true)){
  $focus=ne_reply_parent($db,$row['entity'],$row['source']==='app_comment'?'app':'native',(int)$row['source_id']);unset($focus['owner']);
 }
 return ['target'=>['type'=>$target['type'],'key'=>$target['key']],'replyTo'=>$focus];
}
