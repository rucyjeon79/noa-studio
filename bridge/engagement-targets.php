<?php
declare(strict_types=1);
require_once __DIR__.'/engagement-core.php';require_once __DIR__.'/member-badges.php';require_once __DIR__.'/youtube-store.php';require_once __DIR__.'/member-access.php';require_once __DIR__.'/home-core.php';
function ne_target(PDO $db,string $type,string $key): array {
 global $g5,$member,$is_admin;
 if(strlen($key)>190||str_contains($key,"\0"))throw new DomainException('post_not_available');
 $access=nam_access((array)$member,(string)$is_admin);if(!$access['member'])throw new DomainException('login_required');
 $base=['type'=>$type,'key'=>$key,'canLike'=>true,'canComment'=>$access['write'],'native'=>false];
 if($type==='board'){
  if(!preg_match('/^([A-Za-z0-9_]{1,20}):([1-9][0-9]{0,9})$/D',$key,$m)||$m[1]==='song_request')throw new DomainException('post_not_available');
  $b=ne_one($db,'SELECT b.*,g.gr_use_access FROM '.ne_table($g5['board_table']).' b JOIN '.ne_table($g5['group_table']).' g ON g.gr_id=b.gr_id WHERE b.bo_table=?',[$m[1]]);
  // Native super-admin access is retained; other viewers still require the board gates.
  if(!$b||(!$access['admin']&&(!empty($b['bo_use_cert'])||!empty($b['gr_use_access'])||(int)$member['mb_level']<max((int)$b['bo_read_level'],(int)$b['bo_list_level']))))throw new DomainException('post_not_available');
  $table=ne_table($g5['write_prefix'].$m[1]);$r=ne_one($db,"SELECT wr_id,wr_subject,wr_hit,wr_option,wr_name,wr_content,mb_id FROM $table WHERE wr_id=? AND wr_is_comment=0",[(int)$m[2]]);
  if(!$r||(in_array('secret',explode(',',$r['wr_option']),true)&&!$access['admin']&&($r['mb_id']===''||$r['mb_id']!==($member['mb_id']??''))))throw new DomainException('post_not_available');
  return array_replace($base,['entity'=>'board:'.$key,'title'=>html_entity_decode(strip_tags($r['wr_subject']),ENT_QUOTES,'UTF-8'),'author'=>html_entity_decode(strip_tags($r['wr_name']),ENT_QUOTES,'UTF-8'),'authorBadge'=>nmb_lookup((string)($r['mb_id']??''),$db),'body'=>html_entity_decode(strip_tags(preg_replace('~<(script|style)\b[^>]*>.*?</\1>~is','',$r['wr_content'])),ENT_QUOTES,'UTF-8'),'boardTitle'=>html_entity_decode(strip_tags((string)($b['bo_subject']??$m[1])),ENT_QUOTES,'UTF-8'),'native'=>true,'board'=>$m[1],'id'=>(int)$m[2],'table'=>$table,'views'=>(int)$r['wr_hit'],'canComment'=>$access['admin']||($access['write']&&(int)$member['mb_level']>=(int)$b['bo_comment_level'])]);
 }
 if($type==='video'||$type==='playlist'){
  if(!preg_match('/^[A-Za-z0-9_-]{11,100}$/D',$key))throw new DomainException('post_not_available');$run=ny_latest($db);if(!$run)throw new DomainException('post_not_available');
  if($type==='video'){
   static $videos=[];$cache=spl_object_id($db).':'.$run['run_id'];$videos[$cache]??=ny_videos($db,$run);$v=$videos[$cache][$key]??null;
   if(!$v||!nh_public($v,'UCwYy9xsAqDFat6AV5UKrfgA',true)||($v['match']['status']??'')==='rejected')throw new DomainException('post_not_available');
  }else{$row=ne_one($db,'SELECT payload FROM noa_youtube_playlists WHERE run_id=? AND playlist_id=?',[$run['run_id'],$key]);$v=$row?json_decode($row['payload'],true):null;if(!$v||!nh_public($v,'UCwYy9xsAqDFat6AV5UKrfgA'))throw new DomainException('post_not_available');}
  return $base+['entity'=>$type.':'.$key,'title'=>(string)($v['snippet']['title']??'게시물')];
 }
 if($type!=='music')throw new DomainException('post_not_available');
 $row=ne_one($db,"SELECT doc_key,kind,payload FROM noa_documents WHERE doc_key=? AND kind IN ('single','story','playlist')",[$key]);$d=$row?json_decode($row['payload'],true):null;
 if($d&&!noa_sound_visible($d,false))throw new DomainException('post_not_available');
 $batch=ny_batch($db);$aliases=ne_rows($db,"SELECT a.entity_id FROM noa_catalog_aliases a JOIN noa_catalog_songs s ON s.song_id=a.entity_id WHERE a.batch_id=? AND a.alias_key=?",[$batch,$key]);
 if(count($aliases)>1)throw new DomainException('post_not_available');
 $sid=preg_match('/^catalog:([a-f0-9]{64})$/D',$key,$m)?$m[1]:($aliases[0]['entity_id']??null);
 if($sid){
  $s=ne_one($db,"SELECT v.public_verified,v.fields_json FROM noa_catalog_versions v WHERE v.batch_id=? AND v.entity_id=? AND v.entity_type='song'",[$batch,$sid]);
  $f=$s?json_decode($s['fields_json'],true):[];$trash=noa_sound_trash_index($db);
  if(!$s||!$s['public_verified']||!noa_sound_visible($f,false)||in_array($f['privacyStatus']??'public',['private','unlisted','hidden','draft'],true)||isset($trash['ids'][$sid]))throw new DomainException('post_not_available');
  return $base+['entity'=>'song:'.$sid,'title'=>(string)(($d['body']['confirmedTitle']??'')?:($d['title']??$f['confirmedTitle']??$f['title']??'음악'))];
 }
 if(!$d)throw new DomainException('post_not_available');return $base+['entity'=>'document:'.hash('sha256',$key),'title'=>(string)($d['title']??'게시물')];
}
function ne_legacy_likes(PDO $db,array $target): array {
 global $g5;if(!$target['native'])return [];$q=$db->prepare('SELECT DISTINCT mb_id FROM '.ne_table($g5['board_good_table'])." WHERE bo_table=? AND wr_id=? AND bg_flag='good'");$q->execute([$target['board'],$target['id']]);return array_fill_keys($q->fetchAll(PDO::FETCH_COLUMN),true);
}
function ne_stats(PDO $db,array $target,bool $preview=false): array {
 global $member;$likes=ne_legacy_likes($db,$target);foreach(ne_rows($db,'SELECT owner,active FROM noa_post_likes WHERE entity=?',[$target['entity']])as $r){if($r['active'])$likes[$r['owner']]=true;else unset($likes[$r['owner']]);}
 $comments=(int)ne_one($db,'SELECT COUNT(*) n FROM noa_post_comments WHERE entity=? AND deleted_at IS NULL',[$target['entity']])['n'];
 if($target['native'])$comments+=(int)ne_one($db,'SELECT COUNT(*) n FROM '.$target['table']." WHERE wr_parent=? AND wr_is_comment=1 AND FIND_IN_SET('secret',wr_option)=0",[$target['id']])['n'];
 $base=$target['views']??null;

 return ['entity'=>$target['entity'],'title'=>$target['title'],'boardTitle'=>$target['boardTitle']??'','author'=>$target['author']??'','authorBadge'=>$target['authorBadge']??null,'body'=>$preview?($target['body']??''):'','likes'=>count($likes),'comments'=>$comments,'liked'=>isset($likes[$member['mb_id']??'']),'canLike'=>$target['canLike'],'canComment'=>$target['canComment'],'reactionScore'=>count($likes)+$comments,'score'=>$base===null?null:$base+count($likes)+$comments,'rankingNote'=>'좋아요 1점 · 댓글 1점 · 음악 순위는 시간별 반영'];
}
function ne_comments(PDO $db,array $target,int $page): array {
 global $g5,$member,$is_admin;$offset=max(0,min(10000,$page))*30;$members=ne_table($g5['member_table']);
 $sql="SELECT c.id,c.body,c.created_at at,c.owner,COALESCE(NULLIF(m.mb_nick,''),'탈퇴 회원') name,'app' kind FROM noa_post_comments c LEFT JOIN $members m ON m.mb_id=c.owner WHERE c.entity=? AND c.deleted_at IS NULL";$args=[$target['entity']];
 if($target['native']){$sql.=" UNION ALL SELECT wr_id id,wr_content body,UNIX_TIMESTAMP(wr_datetime) at,mb_id owner,wr_name name,'native' kind FROM ".$target['table']." WHERE wr_parent=? AND wr_is_comment=1 AND FIND_IN_SET('secret',wr_option)=0";$args[]=$target['id'];}
 $rows=ne_rows($db,"SELECT * FROM ($sql) comments ORDER BY at DESC,kind,id DESC LIMIT 31 OFFSET $offset",$args);$more=count($rows)>30;$rows=array_slice($rows,0,30);
 return ['items'=>array_map(static function($r)use($db,$member,$is_admin,$target){$native=$r['kind']==='native';$reply=null;if(!$native){$link=ne_one($db,'SELECT parent_kind,parent_id FROM noa_comment_replies WHERE comment_id=?',[$r['id']]);if($link){try{$reply=ne_reply_parent($db,$target['entity'],$link['parent_kind'],(int)$link['parent_id']);unset($reply['owner']);}catch(DomainException $e){$reply=['id'=>(int)$link['parent_id'],'kind'=>$link['parent_kind'],'name'=>'삭제된 댓글','body'=>'원래 댓글을 확인할 수 없습니다.'];}}}return ['id'=>(int)$r['id'],'kind'=>$r['kind'],'replyTo'=>$reply,'body'=>$native?html_entity_decode(strip_tags(preg_replace('~<(script|style)\b[^>]*>.*?</\1>~is','',$r['body'])),ENT_QUOTES,'UTF-8'):$r['body'],'name'=>html_entity_decode(strip_tags($r['name']),ENT_QUOTES,'UTF-8'),'badge'=>nmb_lookup((string)$r['owner'],$db),'at'=>gmdate('c',(int)$r['at']),'canDelete'=>!$native&&(($r['owner']!==''&&$r['owner']===($member['mb_id']??''))||$is_admin==='super'),'nativeUrl'=>$native?'/bbs/board.php?bo_table='.rawurlencode($target['board']).'&wr_id='.$target['id'].'#c_'.$r['id']:null];},$rows),'more'=>$more,'page'=>$page];
}
