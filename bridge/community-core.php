<?php
declare(strict_types=1);
/** Existing GnuBoard storage, a title-only projection, and per-post private request access. */
const NC_REQUEST_BOARD='song_request';
const NC_REQUEST_MARKER='NOA-SONG-REQUESTS-V1';
function nc_query(string $sql){$r=sql_query($sql,false);if($r===false)throw new RuntimeException('database_unavailable');return $r;}
function nc_one(string $sql):array{$r=nc_query($sql);return sql_fetch_array($r)?:[];}
function nc_rows(string $sql):array{$r=nc_query($sql);$rows=[];while($row=sql_fetch_array($r))$rows[]=$row;return $rows;}
function nc_q(string $v):string{return "'".sql_escape_string($v)."'";}
function nc_table(string $v):string{if(!preg_match('/^[A-Za-z0-9_]+$/D',$v))throw new RuntimeException('invalid_table');return '`'.$v.'`';}
function nc_write_table(string $board):string{global $g5;return nc_table($g5['write_prefix'].$board);}
function nc_admin():bool{global $member,$is_admin;return !empty($member['mb_id'])&&($is_admin??'')==='super';}
function nc_private_policy(array $b):bool{return ($b['bo_10']??'')===NC_REQUEST_MARKER&&(int)($b['bo_read_level']??0)===10&&(int)($b['bo_comment_level']??0)===10&&(int)($b['bo_use_secret']??0)===2&&empty($b['bo_use_search'])&&empty($b['bo_use_rss_view']);}
function nc_board(string $id):array{
 global $g5,$member;
 if($id==='notice'||!preg_match('/^[A-Za-z0-9_]{1,20}$/D',$id))throw new DomainException('board_not_available');
 $b=nc_one('SELECT b.*,g.gr_use_access FROM '.nc_table($g5['board_table']).' b LEFT JOIN '.nc_table($g5['group_table']).' g ON g.gr_id=b.gr_id WHERE b.bo_table='.nc_q($id));
 if(!$b||(!nc_admin()&&((int)($member['mb_level']??1)<(int)$b['bo_list_level']||!empty($b['gr_use_access'])||!empty($b['bo_use_cert']))))throw new DomainException('board_not_available');
 if($id===NC_REQUEST_BOARD&&!nc_private_policy($b))throw new RuntimeException('private_board_unavailable');
 return $b;
}
/** Home publishes titles only. Private request bodies still use the existing owner/password gate. */
function nc_home():array{
 global $g5,$member;$logged=!empty($member['mb_id'])&&(int)($member['mb_level']??1)>=2;$level=$logged?(int)$member['mb_level']:1;
 $boards=nc_rows('SELECT b.*,g.gr_use_access FROM '.nc_table($g5['board_table']).' b INNER JOIN '.nc_table($g5['group_table'])." g ON g.gr_id=b.gr_id WHERE b.bo_table<>'notice' ORDER BY b.bo_order,b.bo_table");$out=[];
 foreach($boards as $b){$id=(string)$b['bo_table'];if(!preg_match('/^[A-Za-z0-9_]{1,20}$/D',$id))continue;$private=$id===NC_REQUEST_BOARD;
  if($private&&!nc_private_policy($b))continue;
  // Only the explicitly title-public song request board has a public title projection at level 2.
  if(!nc_admin()&&(!empty($b['gr_use_access'])||!empty($b['bo_use_cert'])||((int)$b['bo_list_level']>$level&&!($private&&(int)$b['bo_list_level']===2))))continue;
  $rows=nc_rows('SELECT wr_id,wr_subject,wr_name FROM '.nc_write_table($id)." WHERE wr_is_comment=0".($private?'':" AND FIND_IN_SET('secret',wr_option)=0").' ORDER BY wr_id DESC LIMIT 5');
  $out[]=['board'=>$id,'title'=>nc_plain((string)$b['bo_subject']),'items'=>array_map(fn($r)=>['id'=>(int)$r['wr_id'],'title'=>nc_plain($r['wr_subject']),'author'=>$private?'':nc_plain($r['wr_name'])],$rows),'private'=>$private,'member'=>$logged,'admin'=>nc_admin(),'canWrite'=>false,'more'=>false,'next'=>null];
 }
 return ['boards'=>$out,'member'=>$logged,'csrf'=>$logged?($_SESSION['noa_community_csrf']??''):''];
}
function nc_text(string $value,int $max,bool $multiline=false):string{
 $value=trim($value);if($value===''||!mb_check_encoding($value,'UTF-8')||mb_strlen($value,'UTF-8')>$max||str_contains($value,"\0")||(!$multiline&&preg_match('/[\r\n]/',$value)))throw new DomainException('invalid_input');return $value;
}
function nc_plain(string $v):string{
 $v=preg_replace('~<(script|style)\b[^>]*>.*?</\1>~is','',$v)??'';
 $v=preg_replace('~<(?:br\s*/?|/p|/div|/li)>~i',"\n",$v)??'';
 return trim(html_entity_decode(strip_tags($v),ENT_QUOTES|ENT_HTML5,'UTF-8'));
}
function nc_rate(string $purpose,int $maximum,int $seconds):string{
 global $member;$now=time();$key=hash('sha256',$purpose.'|'.($member['mb_id']??'').'|'.($_SERVER['REMOTE_ADDR']??''));$until=$now+$seconds;
 nc_query('INSERT INTO noa_request_limits (limit_key,hits,reset_at) VALUES ('.nc_q($key).",1,$until) ON DUPLICATE KEY UPDATE hits=IF(reset_at<=$now,1,hits+1),reset_at=IF(reset_at<=$now,$until,reset_at)");
 $row=nc_one('SELECT hits FROM noa_request_limits WHERE limit_key='.nc_q($key));if((int)$row['hits']>$maximum)throw new DomainException('try_later');return $key;
}
function nc_list(string $id,int $before=0):array{
 global $member;$b=nc_board($id);$t=nc_write_table($id);$private=$id===NC_REQUEST_BOARD;
 if(!$private&&!nc_admin()&&(int)($member['mb_level']??1)<(int)$b['bo_read_level'])throw new DomainException('board_not_available');
 $where='wr_is_comment=0'.($before>0?' AND wr_id<'.$before:'').($private?'':" AND FIND_IN_SET('secret',wr_option)=0");
 $rows=nc_rows("SELECT wr_id,wr_subject,wr_name FROM $t WHERE $where ORDER BY wr_id DESC LIMIT 6");$more=count($rows)>5;$rows=array_slice($rows,0,5);
 return ['items'=>array_map(fn($r)=>['id'=>(int)$r['wr_id'],'title'=>nc_plain($r['wr_subject']),'author'=>$private?'':nc_plain($r['wr_name'])],$rows),'more'=>$more,'next'=>$more?(int)end($rows)['wr_id']:null,'admin'=>nc_admin(),'canWrite'=>nc_admin()||(int)($member['mb_level']??1)>=max(3,$private?3:(int)$b['bo_write_level']),'displayName'=>(string)($member['mb_nick']??''),'private'=>$private];
}
function nc_content(string $board,int $id,?array $verified=null):array{
 $where=$board===NC_REQUEST_BOARD?'':" AND FIND_IN_SET('secret',wr_option)=0";
 if($board===NC_REQUEST_BOARD&&!nc_admin()){
  if(!$verified||empty($verified['mb_id'])||empty($verified['wr_password']))throw new DomainException('password_not_verified');
  $where.=' AND mb_id='.nc_q($verified['mb_id']).' AND wr_password='.nc_q($verified['wr_password']);
 }
 $t=nc_write_table($board);$r=nc_one("SELECT wr_id,wr_subject,wr_content,wr_option,wr_datetime,wr_name FROM $t WHERE wr_id=$id AND wr_is_comment=0$where");if(!$r)throw new DomainException('post_not_available');
 $comments=nc_rows("SELECT wr_id,wr_content,wr_option,wr_datetime,wr_name FROM $t WHERE wr_parent=$id AND wr_is_comment=1".($board===NC_REQUEST_BOARD?'':" AND FIND_IN_SET('secret',wr_option)=0").' ORDER BY wr_comment,wr_id');
 $plain=static fn($r)=>str_contains($r['wr_option'],'html')?nc_plain($r['wr_content']):$r['wr_content'];
 return ['id'=>(int)$r['wr_id'],'title'=>nc_plain($r['wr_subject']),'body'=>$plain($r),'author'=>nc_plain($r['wr_name']),'date'=>substr($r['wr_datetime'],0,10),'comments'=>array_map(fn($c)=>['id'=>(int)$c['wr_id'],'body'=>$plain($c),'author'=>nc_plain($c['wr_name']),'date'=>substr($c['wr_datetime'],0,10)],$comments),'canComment'=>$board===NC_REQUEST_BOARD&&nc_admin()];
}
function nc_read(string $board,int $id):array{
 global $member;if($id<1)throw new DomainException('post_not_available');$b=nc_board($board);
 if($board===NC_REQUEST_BOARD){if(!nc_admin())return ['id'=>$id,'locked'=>true];return nc_content($board,$id);}
 if(!nc_admin()&&(int)($member['mb_level']??1)<(int)$b['bo_read_level'])throw new DomainException('post_not_available');
 $r=nc_one('SELECT wr_id FROM '.nc_write_table($board)." WHERE wr_id=$id AND wr_is_comment=0 AND FIND_IN_SET('secret',wr_option)=0");if(!$r)throw new DomainException('post_not_available');return nc_content($board,$id);
}
function nc_unlock(int $id,string $password):array{
 global $member;nc_board(NC_REQUEST_BOARD);if(nc_admin())return nc_content(NC_REQUEST_BOARD,$id);
 $key=nc_rate('unlock:'.$id,5,900);$r=$id>0?nc_one('SELECT mb_id,wr_password FROM '.nc_write_table(NC_REQUEST_BOARD)." WHERE wr_id=$id AND wr_is_comment=0"):[];
 if(!$r||empty($member['mb_id'])||$r['mb_id']!==(string)$member['mb_id']||$r['wr_password']===''||strlen($password)>128||!check_password($password,$r['wr_password']))throw new DomainException('password_not_verified');
 nc_query('DELETE FROM noa_request_limits WHERE limit_key='.nc_q($key));return nc_content(NC_REQUEST_BOARD,$id,$r);
}
function nc_request_id(string $id):string{if(!preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/D',$id))throw new DomainException('invalid_input');return $id;}
function nc_lock():void{$r=nc_one("SELECT GET_LOCK('noa-song-request-write',10) AS acquired");if((int)($r['acquired']??0)!==1)throw new RuntimeException('write_busy');}
function nc_unlock_write():void{sql_query("SELECT RELEASE_LOCK('noa-song-request-write')",false);}
function nc_insert(array $fields):int{
 $all=['wr_num'=>0,'wr_reply'=>'','wr_parent'=>0,'wr_is_comment'=>0,'wr_comment'=>0,'wr_comment_reply'=>'','ca_name'=>'','wr_option'=>'secret','wr_subject'=>'','wr_content'=>'','wr_seo_title'=>'','wr_link1'=>'','wr_link2'=>'','wr_link1_hit'=>0,'wr_link2_hit'=>0,'wr_hit'=>0,'wr_good'=>0,'wr_nogood'=>0,'mb_id'=>'','wr_password'=>'','wr_name'=>'','wr_email'=>'','wr_homepage'=>'','wr_datetime'=>G5_TIME_YMDHIS,'wr_file'=>0,'wr_last'=>G5_TIME_YMDHIS,'wr_ip'=>'','wr_facebook_user'=>'','wr_twitter_user'=>''];for($i=1;$i<=10;$i++)$all['wr_'.$i]='';$all=array_replace($all,$fields);
 $pairs=[];foreach($all as $k=>$v)$pairs[]=nc_table($k).'='.(is_int($v)?$v:nc_q($v));nc_query('INSERT INTO '.nc_write_table(NC_REQUEST_BOARD).' SET '.implode(',',$pairs));$id=(int)sql_insert_id();if($id<1)throw new RuntimeException('save_failed');return $id;
}
function nc_reconcile(int $id,int $parent,string $owner):void{
 global $g5;$t=nc_write_table(NC_REQUEST_BOARD);$board=nc_q(NC_REQUEST_BOARD);
 if($id===$parent)nc_query("UPDATE $t SET wr_parent=$id WHERE wr_id=$id");
 else nc_query("UPDATE $t SET wr_comment=(SELECT n FROM (SELECT COUNT(*) n FROM $t WHERE wr_parent=$parent AND wr_is_comment=1) counter),wr_last=".nc_q(G5_TIME_YMDHIS)." WHERE wr_id=$parent AND wr_is_comment=0");
 $new=nc_table($g5['board_new_table']);if(!nc_one("SELECT bn_id FROM $new WHERE bo_table=$board AND wr_id=$id"))nc_query("INSERT INTO $new (bo_table,wr_id,wr_parent,bn_datetime,mb_id) VALUES ($board,$id,$parent,".nc_q(G5_TIME_YMDHIS).','.nc_q($owner).')');
 $counts=nc_one("SELECT SUM(wr_is_comment=0) posts,SUM(wr_is_comment=1) comments FROM $t");nc_query('UPDATE '.nc_table($g5['board_table']).' SET bo_count_write='.(int)$counts['posts'].',bo_count_comment='.(int)$counts['comments'].' WHERE bo_table='.$board);
 if(function_exists('delete_cache_latest'))delete_cache_latest(NC_REQUEST_BOARD);
}
function nc_create(array $data):array{
 global $member;if(!nc_admin()&&(empty($member['mb_id'])||(int)($member['mb_level']??1)<3))throw new DomainException('write_not_allowed');nc_board(NC_REQUEST_BOARD);
 $title=nc_text((string)($data['title']??''),150);$body=nc_text((string)($data['body']??''),15000,true);$name=nc_text((string)($data['name']??''),40);$password=(string)($data['password']??'');if(mb_strlen($password,'UTF-8')<8||strlen($password)>128)throw new DomainException('password_length');
 $request=nc_request_id((string)($data['requestId']??''));$marker='NOA-REQUEST:'.$request;$owner=(string)$member['mb_id'];nc_rate('create',6,60);nc_lock();
 try{
  $t=nc_write_table(NC_REQUEST_BOARD);$old=nc_one("SELECT wr_id,mb_id,wr_subject,wr_content,wr_password FROM $t WHERE wr_10=".nc_q($marker));
  if($old){if($old['mb_id']!==$owner||$old['wr_subject']!==$title||$old['wr_content']!==$body||!check_password($password,$old['wr_password']))throw new DomainException('request_conflict');$id=(int)$old['wr_id'];}
  else{$num=(int)nc_one("SELECT COALESCE(MIN(wr_num),0)-1 AS n FROM $t")['n'];$id=nc_insert(['wr_num'=>$num,'wr_subject'=>$title,'wr_content'=>$body,'mb_id'=>$owner,'wr_name'=>$name,'wr_password'=>get_encrypt_string($password),'wr_10'=>$marker]);}
  nc_reconcile($id,$id,$owner);
 }finally{nc_unlock_write();}
 if(function_exists('nr_activity')){try{nr_activity('write',['bo_table'=>NC_REQUEST_BOARD],$id,'',time());}catch(Throwable $e){error_log('[noa-request-reward] '.get_class($e));}}
 return ['id'=>$id,'created'=>!$old];
}
function nc_comment(array $data):array{
 global $member;if(!nc_admin())throw new DomainException('comment_not_allowed');nc_board(NC_REQUEST_BOARD);$id=(int)($data['id']??0);$body=nc_text((string)($data['body']??''),5000,true);$request=nc_request_id((string)($data['requestId']??''));$owner=(string)$member['mb_id'];nc_rate('comment',30,60);nc_lock();
 try{
  $t=nc_write_table(NC_REQUEST_BOARD);$post=nc_one("SELECT wr_num FROM $t WHERE wr_id=$id AND wr_is_comment=0");if(!$post)throw new DomainException('post_not_available');$marker='NOA-COMMENT:'.$request;$old=nc_one("SELECT wr_id,wr_parent,mb_id,wr_content FROM $t WHERE wr_10=".nc_q($marker));
  if($old){if((int)$old['wr_parent']!==$id||$old['mb_id']!==$owner||$old['wr_content']!==$body)throw new DomainException('request_conflict');$cid=(int)$old['wr_id'];}
  else{$number=(int)nc_one("SELECT COALESCE(MAX(wr_comment),0)+1 AS n FROM $t WHERE wr_parent=$id AND wr_is_comment=1")['n'];$cid=nc_insert(['wr_num'=>(int)$post['wr_num'],'wr_parent'=>$id,'wr_is_comment'=>1,'wr_comment'=>$number,'wr_content'=>$body,'mb_id'=>$owner,'wr_name'=>(string)($member['mb_nick']??'관리자'),'wr_10'=>$marker]);}
  nc_reconcile($cid,$id,$owner);
 }finally{nc_unlock_write();}
 if(function_exists('nr_activity')){try{nr_activity('comment',['bo_table'=>NC_REQUEST_BOARD],$cid,'c',time());}catch(Throwable $e){error_log('[noa-request-comment-reward] '.get_class($e));}}
 return nc_content(NC_REQUEST_BOARD,$id);
}
