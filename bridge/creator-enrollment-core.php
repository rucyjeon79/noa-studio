<?php
declare(strict_types=1);
require_once __DIR__.'/creator-core.php';
const NCE_MARKER='NOA-CREATOR-ENROLLMENT-V1';
function nce_table(string $s):string{if(!preg_match('/^[A-Za-z0-9_]+$/D',$s))throw new RuntimeException('invalid_table');return '`'.$s.'`';}
function nce_one(PDO $db,string $sql,array $args=[]):?array{$q=$db->prepare($sql);$q->execute($args);return $q->fetch(PDO::FETCH_ASSOC)?:null;}
function nce_root():string{$p=dirname(G5_PATH).'/noa-creator-enrollment';if(!is_dir($p)||is_link($p))throw new RuntimeException('application_storage_unavailable');return $p;}
function nce_key():string{$p=nce_root().'/master.key';if(is_link($p))throw new RuntimeException('application_key_unavailable');$key=file_get_contents($p);if(strlen($key)!==32)throw new RuntimeException('application_key_unavailable');return $key;}
function nce_seal(array $v):string{$iv=random_bytes(12);$tag='';$encrypted=openssl_encrypt(json_encode($v,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),'aes-256-gcm',nce_key(),OPENSSL_RAW_DATA,$iv,$tag,NCE_MARKER);if($encrypted===false)throw new RuntimeException('application_encrypt_failed');return base64_encode($iv.$tag.$encrypted);}
function nce_open(string $v):array{$raw=base64_decode($v,true);if($raw===false||strlen($raw)<29)throw new RuntimeException('application_invalid');$plain=openssl_decrypt(substr($raw,28),'aes-256-gcm',nce_key(),OPENSSL_RAW_DATA,substr($raw,0,12),substr($raw,12,16),NCE_MARKER);if($plain===false)throw new RuntimeException('application_invalid');return json_decode($plain,true,32,JSON_THROW_ON_ERROR);}
function nce_schema(PDO $db):void{
 $db->exec("CREATE TABLE IF NOT EXISTS noa_creator_applications (id CHAR(32) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,owner_id VARCHAR(20) NOT NULL,existing_member TINYINT NOT NULL,identity_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,claim_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,state VARCHAR(20) NOT NULL,payload LONGTEXT NOT NULL,revision INT UNSIGNED NOT NULL DEFAULT 1,reviewer VARCHAR(20) NOT NULL DEFAULT '',review_note VARCHAR(1000) NOT NULL DEFAULT '',created_at BIGINT NOT NULL,updated_at BIGINT NOT NULL,UNIQUE KEY owner(owner_id),UNIQUE KEY identity(identity_hash),KEY review(state,created_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='NOA-CREATOR-ENROLLMENT-V1'");
 $db->exec("CREATE TABLE IF NOT EXISTS noa_creator_limits (bucket CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,hits INT UNSIGNED NOT NULL,expires BIGINT NOT NULL) ENGINE=InnoDB COMMENT='NOA-CREATOR-ENROLLMENT-V1'");
}
function nce_rate(PDO $db,string $purpose,int $max=10):void{$key=hash_hmac('sha256',$purpose.'|'.($_SERVER['REMOTE_ADDR']??''),nce_key());$now=time();$q=$db->prepare('INSERT INTO noa_creator_limits VALUES(?,1,?) ON DUPLICATE KEY UPDATE hits=IF(expires<?,1,hits+1),expires=IF(expires<?,VALUES(expires),expires)');$q->execute([$key,$now+3600,$now,$now]);if((int)nce_one($db,'SELECT hits FROM noa_creator_limits WHERE bucket=?',[$key])['hits']>$max)throw new DomainException('try_later');}
function nce_cert_options(array $config):array{
 if((int)($config['cf_cert_use']??0)!==2)return [];
 $out=[];$hp=$config['cf_cert_hp']??'';$definitions=['kcb'=>['G5_OKNAME_URL','/hpcert1.php','kcb-hp','cf_cert_kcb_cd'],'kcp'=>['G5_KCPCERT_URL','/kcpcert_form.php','kcp-hp','cf_cert_kcp_cd'],'kcp_v2'=>['G5_KCPCERT_V2_URL','/kcpcert_form.php','kcp_v2-hp','cf_cert_kcp_cd'],'lg'=>['G5_LGXPAY_URL','/AuthOnlyReq.php','lg-hp','cf_lg_mid']];
 if(isset($definitions[$hp])){[$constant,$path,$type,$key]=$definitions[$hp];if(defined($constant)&&!empty($config[$key]))$out[]=['label'=>'휴대폰 본인인증','url'=>constant($constant).$path.'?pageType=register','type'=>$type];}
 if(!empty($config['cf_cert_simple'])&&defined('G5_INICERT_URL')&&!empty($config['cf_cert_simple_mid']))$out[]=['label'=>'간편 본인인증','url'=>G5_INICERT_URL.'/ini_request.php?pageType=register','type'=>'simple'];
 return $out;
}
/** Only native provider callbacks or an already certified native account can attest identity. */
function nce_identity(array $b,array $m,array $session,array $config,int $now):?array{
 $name=trim((string)($b['mb_name']??''));$hp=hyphen_hp_number((string)($b['mb_hp']??''));
 if(!empty($m['mb_id'])&&!empty($m['mb_certify'])&&!empty($m['mb_dupinfo'])&&hash_equals((string)$m['mb_name'],$name)&&hash_equals(hyphen_hp_number((string)$m['mb_hp']),$hp))return ['type'=>$m['mb_certify'],'dupinfo'=>$m['mb_dupinfo'],'birth'=>$m['mb_birth'],'name'=>$name,'hp'=>$hp,'verifiedAt'=>$now,'source'=>'native_member'];
 if((int)($config['cf_cert_use']??0)!==2||($session['noa_creator_cert_started']??0)<$now-1800)return null;
 $type=$session['ss_cert_type']??'';$no=$session['ss_cert_no']??'';$birth=$session['ss_cert_birth']??'';$dup=$session['ss_cert_dupinfo']??'';
 if(!in_array($type,['hp','simple'],true)||!is_string($no)||$no===''||!is_string($dup)||$dup===''||!preg_match('/^\d{8}$/D',(string)$birth))return null;
 $hash=md5($name.$type.$birth.$hp.$no);if(!hash_equals($hash,(string)($session['ss_cert_hash']??'')))return null;
 return ['type'=>$type,'dupinfo'=>$dup,'birth'=>$birth,'name'=>$name,'hp'=>$hp,'verifiedAt'=>$now,'source'=>'native_session'];
}
function nce_text(array $b,string $k,int $min,int $max):string{$v=$b[$k]??'';if(!is_string($v)||!mb_check_encoding($v,'UTF-8')||str_contains($v,"\0")||mb_strlen(trim($v))<$min||mb_strlen(trim($v))>$max)throw new InvalidArgumentException('invalid_'.$k);return trim($v);}
function nce_fields(array $b,array $m):array{
 $v=[];foreach(['mb_name'=>[2,60],'mb_hp'=>[9,20],'mb_email'=>[3,254],'nickname'=>[2,40],'region'=>[2,100],'artistName'=>[2,80],'field'=>[2,100],'experience'=>[0,2000],'portfolio'=>[0,500],'title'=>[2,80],'description'=>[10,2000]] as $k=>$len)$v[$k]=nce_text($b,$k,...$len);
 if(!filter_var($v['mb_email'],FILTER_VALIDATE_EMAIL)||!preg_match('/^[0-9+() -]{9,20}$/D',$v['mb_hp']))throw new InvalidArgumentException('invalid_contact');
 if($v['portfolio']!==''&&(!filter_var($v['portfolio'],FILTER_VALIDATE_URL)||!str_starts_with($v['portfolio'],'https://')))throw new InvalidArgumentException('invalid_portfolio');
 if(($b['privacy']??'')!=='1'||($b['terms']??'')!=='1'||($b['rights']??'')!=='1')throw new InvalidArgumentException('consent_required');
 $v['consent']=['version'=>'20261029','at'=>time(),'privacy'=>true,'terms'=>true,'rights'=>true];
 $v['ownerId']=!empty($m['mb_id'])?(string)$m['mb_id']:strtolower(nce_text($b,'accountId',3,20));
 if(!preg_match('/^[a-zA-Z0-9_]{3,20}$/D',$v['ownerId']))throw new InvalidArgumentException('invalid_accountId');
 if(empty($m['mb_id'])){$password=$b['password']??'';if(!is_string($password)||strlen($password)<12||strlen($password)>128||$password!==($b['passwordConfirm']??''))throw new InvalidArgumentException('invalid_password');$v['passwordHash']=get_encrypt_string($password);}
 return $v;
}
function nce_member(PDO $db,string $owner,bool $lock=false):?array{global $g5;return nce_one($db,'SELECT * FROM '.nce_table($g5['member_table']).' WHERE mb_id=?'.($lock?' FOR UPDATE':''),[$owner]);}
function nce_duplicate(PDO $db,array $v,?array $identity,bool $existing):void{
 global $g5;$table=nce_table($g5['member_table']);$owner=$v['ownerId'];$m=nce_member($db,$owner);
 if(!$existing&&$m)throw new DomainException('account_unavailable');
 if($existing&&(!$m||!in_array((int)$m['mb_level'],[2,3,4],true)||$m['mb_leave_date']!==''||$m['mb_intercept_date']!==''))throw new DomainException('application_not_allowed');
 if(nce_one($db,"SELECT mb_id FROM $table WHERE mb_id<>? AND (mb_email=? OR mb_nick=?)",[$owner,$v['mb_email'],$v['nickname']]))throw new DomainException('contact_unavailable');
 if($identity&&nce_one($db,"SELECT mb_id FROM $table WHERE mb_id<>? AND mb_dupinfo=?",[$owner,$identity['dupinfo']]))throw new DomainException('identity_already_registered');
}
function nce_owned_application(PDO $db,array $m,string $claim):?array{
 if(!empty($m['mb_id']))return nce_one($db,'SELECT * FROM noa_creator_applications WHERE owner_id=? AND existing_member=1',[(string)$m['mb_id']]);
 if(!preg_match('/^[a-f0-9]{64}$/D',$claim))return null;return nce_one($db,'SELECT * FROM noa_creator_applications WHERE claim_hash=?',[hash('sha256',$claim)]);
}
function nce_save(PDO $db,array $b,array $m,array $session,array $config,string $claim,string $symbol='',bool $submit=false):array{
 $v=nce_fields($b,$m);$existing=!empty($m['mb_id']);$identity=nce_identity($b,$m,$session,$config,time());
 if($submit&&!$identity)throw new DomainException('identity_verification_required');nce_duplicate($db,$v,$identity,$existing);
 $old=nce_owned_application($db,$m,$claim);if($old&&in_array($old['state'],['pending','approved'],true))throw new DomainException('application_already_submitted');
 if($old&&($b['revision']??'')!==(string)$old['revision'])throw new DomainException('revision_conflict');
 if($old&&$old['owner_id']!==$v['ownerId'])throw new DomainException('account_locked');
 if($old){$previous=nce_open($old['payload']);if($symbol==='')$symbol=$previous['symbol']??'';}
 $v['identity']=$identity;$v['symbol']=$symbol;$id=$old['id']??bin2hex(random_bytes(16));$state=$submit?'pending':'draft';$now=time();$hash=$identity?hash_hmac('sha256',$identity['dupinfo'],nce_key()):null;
 try{$db->beginTransaction();if($old){$q=$db->prepare('UPDATE noa_creator_applications SET state=?,payload=?,identity_hash=?,review_note=\'\',revision=revision+1,updated_at=? WHERE id=? AND revision=? AND state IN (\'draft\',\'rejected\')');$q->execute([$state,nce_seal($v),$hash,$now,$id,$old['revision']]);if($q->rowCount()!==1)throw new DomainException('revision_conflict');}else{$q=$db->prepare('INSERT INTO noa_creator_applications(id,owner_id,existing_member,identity_hash,claim_hash,state,payload,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)');$q->execute([$id,$v['ownerId'],(int)$existing,$hash,hash('sha256',$claim),$state,nce_seal($v),$now,$now]);}$db->commit();}catch(Throwable $e){if($db->inTransaction())$db->rollBack();if($e instanceof PDOException&&$e->getCode()==='23000')throw new DomainException('application_duplicate');throw $e;}
 return nce_one($db,'SELECT * FROM noa_creator_applications WHERE id=?',[$id]);
}
function nce_symbol_upload(array $f):string{
 if(($f['error']??UPLOAD_ERR_NO_FILE)===UPLOAD_ERR_NO_FILE)return '';
 if(($f['error']??1)!==UPLOAD_ERR_OK||($f['size']??0)>5242880||!is_uploaded_file($f['tmp_name']))throw new InvalidArgumentException('invalid_symbol');
 $info=getimagesize($f['tmp_name']);if(!$info||!in_array($info[2],[IMAGETYPE_JPEG,IMAGETYPE_PNG,IMAGETYPE_WEBP],true)||$info[0]>8000||$info[1]>8000||$info[0]*$info[1]>20000000)throw new InvalidArgumentException('invalid_symbol');
 $src=imagecreatefromstring(file_get_contents($f['tmp_name']));if(!$src)throw new InvalidArgumentException('invalid_symbol');$w=$info[0];$h=$info[1];$scale=min(1,1000/max($w,$h));$dest=imagecreatetruecolor((int)round($w*$scale),(int)round($h*$scale));imagefill($dest,0,0,imagecolorallocate($dest,244,241,234));imagecopyresampled($dest,$src,0,0,0,0,imagesx($dest),imagesy($dest),$w,$h);$id=bin2hex(random_bytes(24));$path=nce_root().'/symbols/'.$id.'.jpg';if(!imagejpeg($dest,$path,88))throw new RuntimeException('symbol_save_failed');chmod($path,0600);imagedestroy($src);imagedestroy($dest);return $id;
}
function nce_board_id(string $owner):string{return 'nc_'.substr(hash('sha256',$owner),0,16);}
/** DDL is staged before the member/channel transaction; marker and membership gates hide unfinished boards. */
function nce_board(PDO $db,string $owner,string $title):string{
 global $g5;$id=nce_board_id($owner);$marker='NOA-CHANNEL-V1:'.hash('sha256',$owner);$boards=nce_table($g5['board_table']);$tableName=$g5['write_prefix'].$id;$table=nce_table($tableName);
 $row=nce_one($db,"SELECT * FROM $boards WHERE bo_table=?",[$id]);if($row&&(($row['bo_10']??'')!==$marker||$row['bo_admin']!==$owner))throw new DomainException('board_owner_conflict');
 $meta=nce_one($db,'SELECT TABLE_COMMENT FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?',[$tableName]);if($meta&&$meta['TABLE_COMMENT']!==$marker)throw new DomainException('board_table_conflict');
 if(!$meta){$db->exec('CREATE TABLE '.$table.' LIKE '.nce_table($g5['write_prefix'].'free'));$db->exec('ALTER TABLE '.$table.' ENGINE=InnoDB, COMMENT='.$db->quote($marker));}
 if(!$row){$row=nce_one($db,"SELECT * FROM $boards WHERE bo_table='free'");if(!$row)throw new RuntimeException('board_template_missing');
  $overrides=['bo_table'=>$id,'bo_subject'=>$title.' · 채널 게시판','bo_mobile_subject'=>$title.' · 채널 게시판','bo_admin'=>$owner,'bo_list_level'=>2,'bo_read_level'=>2,'bo_write_level'=>3,'bo_reply_level'=>3,'bo_comment_level'=>3,'bo_html_level'=>10,'bo_link_level'=>3,'bo_upload_level'=>5,'bo_download_level'=>2,'bo_use_secret'=>0,'bo_use_cert'=>'','bo_use_search'=>1,'bo_use_rss_view'=>0,'bo_use_sideview'=>1,'bo_use_email'=>0,'bo_use_sns'=>0,'bo_count_write'=>0,'bo_count_comment'=>0,'bo_notice'=>'','bo_upload_count'=>2,'bo_upload_size'=>5242880,'bo_read_point'=>0,'bo_write_point'=>0,'bo_comment_point'=>0,'bo_download_point'=>0,'bo_skin'=>'basic','bo_mobile_skin'=>'basic','bo_include_head'=>'','bo_include_tail'=>'','bo_content_head'=>'','bo_content_tail'=>'','bo_mobile_content_head'=>'','bo_mobile_content_tail'=>'','bo_10'=>$marker];
  foreach($overrides as $k=>$v)if(array_key_exists($k,$row))$row[$k]=$v;
  $q=$db->prepare('INSERT INTO '.$boards.' ('.implode(',',array_map('nce_table',array_keys($row))).') VALUES ('.implode(',',array_fill(0,count($row),'?')).')');$q->execute(array_values($row));
 }return $id;
}
function nce_native_insert(PDO $db,array $v):void{
 global $g5,$config;$now=date('Y-m-d H:i:s');$identity=$v['identity'];
 $values=['mb_id'=>$v['ownerId'],'mb_password'=>$v['passwordHash'],'mb_name'=>$identity['name'],'mb_nick'=>$v['nickname'],'mb_email'=>$v['mb_email'],'mb_level'=>5,'mb_hp'=>$identity['hp'],'mb_birth'=>$identity['birth'],'mb_certify'=>$identity['type'],'mb_dupinfo'=>$identity['dupinfo'],'mb_nick_date'=>date('Y-m-d'),'mb_open_date'=>date('Y-m-d'),'mb_datetime'=>$now,'mb_today_login'=>$now,'mb_email_certify'=>$now,'mb_signature'=>'','mb_profile'=>'','mb_memo'=>'','mb_lost_certify'=>''];
 if(!empty($config['cf_use_email_certify']))throw new DomainException('native_email_policy_review_required');
 $q=$db->prepare('INSERT INTO '.nce_table($g5['member_table']).' ('.implode(',',array_map('nce_table',array_keys($values))).') VALUES ('.implode(',',array_fill(0,count($values),'?')).')');$q->execute(array_values($values));
}
function nce_review(PDO $db,string $id,int $revision,string $action,string $note,string $reviewer,bool $super):array{
 global $g5;if(!$super||$reviewer==='')throw new DomainException('super_required');if(!preg_match('/^[a-f0-9]{32}$/D',$id)||!in_array($action,['approve','reject'],true)||mb_strlen($note)>1000||($action==='reject'&&trim($note)===''))throw new InvalidArgumentException('invalid_review');
 if((int)$db->query("SELECT GET_LOCK('noa-creator-approval',10)")->fetchColumn()!==1)throw new DomainException('review_busy');
 try{
  $a=nce_one($db,'SELECT * FROM noa_creator_applications WHERE id=?',[$id]);if(!$a)throw new DomainException('application_missing');
  if($a['state']==='approved'&&$action==='approve')return ['state'=>'approved','replayed'=>true,'channelId'=>hash('sha256',$a['owner_id'])];
  if($a['state']!=='pending'||(int)$a['revision']!==$revision)throw new DomainException('revision_conflict');$v=nce_open($a['payload']);
  if($action==='approve'){
   if(empty($v['identity']['verifiedAt'])||empty($v['identity']['dupinfo'])||!hash_equals((string)$a['identity_hash'],hash_hmac('sha256',$v['identity']['dupinfo'],nce_key())))throw new DomainException('identity_verification_required');
   nce_duplicate($db,$v,$v['identity'],(bool)$a['existing_member']);
   $board=nce_board($db,$a['owner_id'],$v['title']);
  }
  $db->beginTransaction();$current=nce_one($db,'SELECT * FROM noa_creator_applications WHERE id=? FOR UPDATE',[$id]);if((int)$current['revision']!==$revision||$current['state']!=='pending')throw new DomainException('revision_conflict');
  if($action==='approve'){
   $m=nce_member($db,$a['owner_id'],true);nce_duplicate($db,$v,$v['identity'],(bool)$a['existing_member']);
   if(!$a['existing_member'])nce_native_insert($db,$v);else{$q=$db->prepare('UPDATE '.nce_table($g5['member_table']).' SET mb_level=5,mb_name=?,mb_hp=?,mb_birth=?,mb_certify=?,mb_dupinfo=? WHERE mb_id=? AND mb_level IN (2,3,4)');$q->execute([$v['identity']['name'],$v['identity']['hp'],$v['identity']['birth'],$v['identity']['type'],$v['identity']['dupinfo'],$a['owner_id']]);if($q->rowCount()!==1)throw new DomainException('member_changed');}
   $key=nc_channel_key($a['owner_id']);$channel=nc_row($db,$key);if($channel)throw new DomainException('channel_already_exists');
   nup_store($db,$key,'prefs',['ownerId'=>$a['owner_id'],'channelId'=>hash('sha256',$a['owner_id']),'title'=>$v['title'],'description'=>$v['description'],'artistName'=>$v['artistName'],'symbol'=>$v['symbol'],'boardId'=>$board,'approvedAt'=>time()],0,$reviewer);
   unset($v['passwordHash']);$next='approved';
  }else{$next='rejected';unset($v['passwordHash']);}
  $q=$db->prepare('UPDATE noa_creator_applications SET state=?,payload=?,reviewer=?,review_note=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?');$q->execute([$next,nce_seal($v),$reviewer,$note,time(),$id,$revision]);$db->commit();return ['state'=>$next,'channelId'=>$next==='approved'?hash('sha256',$a['owner_id']):null,'replayed'=>false];
 }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}finally{$db->query("SELECT RELEASE_LOCK('noa-creator-approval')");}
}
function nce_public_application(?array $a,bool $private=false):?array{if(!$a)return null;$v=nce_open($a['payload']);$out=['id'=>$a['id'],'state'=>$a['state'],'revision'=>(int)$a['revision'],'createdAt'=>(int)$a['created_at'],'reviewNote'=>$a['review_note'],'channelTitle'=>$v['title'],'verified'=>!empty($v['identity']['verifiedAt']),'existing'=>(bool)$a['existing_member']];if($private){unset($v['passwordHash'],$v['identity']['dupinfo']);$out['fields']=$v;}return $out;}
