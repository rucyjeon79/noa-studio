<?php
/** Runner-owned, expiring QA helper. Installed temporarily, then removed via SFTP. */
declare(strict_types=1);ini_set('display_errors','0');
if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||time()>__QA_EXPIRY__||!hash_equals('__QA_TOKEN_HASH__',hash('sha256',(string)($_SERVER['HTTP_X_NOA_QA']??'')))){http_response_code(404);exit;}
register_shutdown_function(static function(){ $e=error_get_last();if($e&&in_array($e['type'],[E_ERROR,E_PARSE,E_COMPILE_ERROR,E_CORE_ERROR],true)){http_response_code(500);header('Content-Type: application/json');echo json_encode(['ok'=>false,'error'=>'qa_runtime_failure','file'=>basename($e['file']),'line'=>$e['line']]);}});
require_once dirname(__DIR__).'/common.php';require_once __DIR__.'/storage.php';require_once __DIR__.'/creator-core.php';require_once __DIR__.'/sound-core.php';require_once dirname(__DIR__).'/noa-app/jukebox/core.php';
header('Content-Type: application/json');header('Cache-Control: no-store');
try{
 $b=json_decode(file_get_contents('php://input',false,null,0,4097),true,16,JSON_THROW_ON_ERROR);$db=noa_bridge_pdo();$ids=['__QA_ID_A__','__QA_ID_B__'];$id=$ids[(int)($b['owner']??0)]??'';if($id==='')throw new RuntimeException('invalid_owner');$table=$g5['member_table'];if(!preg_match('/^[A-Za-z0-9_]+$/D',$table))throw new RuntimeException('table_invalid');$marker='NOA release QA __QA_NONCE__';
 $q=$db->prepare('SELECT mb_profile FROM `'.$table.'` WHERE mb_id=?');$q->execute([$id]);$existing=$q->fetchColumn();if($existing!==false&&$existing!==$marker)throw new RuntimeException('existing_member_preserved');
 $action=$b['action']??'';$result=[];
 if($action==='setup'){
  if($existing!==false)throw new RuntimeException('qa_member_already_exists');$password=$b['password']??'';if(!is_string($password)||strlen($password)<32)throw new RuntimeException('qa_password_required');$fields=[];
  foreach($db->query('SHOW COLUMNS FROM `'.$table.'`')as $col){if(preg_match('/^(?:date|datetime|timestamp)/i',$col['Type'])&&str_starts_with((string)$col['Default'],'0000-')){$fields[$col['Field']]=strtolower($col['Type'])==='date'?date('Y-m-d'):date('Y-m-d H:i:s');continue;}if(str_contains($col['Extra'],'auto_increment')||$col['Default']!==null||$col['Null']==='YES')continue;$type=strtolower($col['Type']);$fields[$col['Field']]=preg_match('/int|decimal|float|double|bit/',$type)?0:(preg_match('/date|time/',$type)?date('Y-m-d H:i:s'):'');}
  $fields=array_replace($fields,['mb_id'=>$id,'mb_password'=>get_encrypt_string($password),'mb_name'=>'NOA QA','mb_nick'=>'NOA QA '.substr($id,-7),'mb_nick_date'=>date('Y-m-d'),'mb_email'=>$id.'@example.invalid','mb_level'=>5,'mb_profile'=>$marker,'mb_datetime'=>date('Y-m-d H:i:s'),'mb_email_certify'=>date('Y-m-d H:i:s'),'mb_ip'=>'127.0.0.1','mb_login_ip'=>'127.0.0.1','mb_today_login'=>date('Y-m-d H:i:s')]);
  $db->prepare('INSERT INTO `'.$table.'` (`'.implode('`,`',array_keys($fields)).'`) VALUES('.implode(',',array_fill(0,count($fields),'?')).')')->execute(array_values($fields));$result=['created'=>true];
 }elseif($action==='level'){
  if($existing===false)throw new RuntimeException('qa_member_missing');$level=$b['level']??0;if(!in_array($level,[2,3,4,5,6],true))throw new RuntimeException('qa_only_consumer_levels');$db->prepare('UPDATE `'.$table.'` SET mb_level=? WHERE mb_id=? AND mb_profile=?')->execute([$level,$id,$marker]);$result=['level'=>$level];
 }elseif($action==='subscription_state'){
  require_once __DIR__.'/subscription-core.php';$policy=ns_policy();$q=$db->prepare('SELECT COALESCE(SUM(po_point),0) FROM `'.$g5['point_table'].'` WHERE mb_id=?');$q->execute([$id]);$result=['configured'=>$policy['values']['enabled'],'revision'=>$policy['revision'],'balance'=>(int)$q->fetchColumn(),'grantExists'=>ns_doc(ns_member_key($id))!==null,'storage'=>ns_storage(true)];
 }elseif($action==='subscription_fixture'){
  if($existing===false)throw new RuntimeException('qa_member_missing');require_once __DIR__.'/subscription-core.php';$m=$db->prepare('SELECT mb_level FROM `'.$table.'` WHERE mb_id=?');$m->execute([$id]);$base=ns_family((int)$m->fetchColumn());if($base===null)throw new RuntimeException('qa_member_family_required');$now=time();$active=($b['active']??false)===true;
  $grant=['ownerId'=>$id,'baseLevel'=>$base,'paidLevel'=>$base===5?6:4,'status'=>'active','until'=>$active?$now+300:$now-1,'anchorDay'=>1,'lastOrderId'=>'qa-fixture-__QA_NONCE__','source'=>'qa_fixture','updatedAt'=>$now];
  ns_atomic($id,false,function()use($id,$grant){$old=ns_doc(ns_member_key($id),true);ns_put(ns_member_key($id),'prefs',$grant,$old['revision']??0,$id);});$result=['fixtureActive'=>$active,'base'=>$base];
 }elseif($action==='asset'){
  if($existing===false)throw new RuntimeException('qa_member_missing');$key=(string)($b['key']??'');nc_own($db,$key,['mb_id'=>$id]);$relative='qa-member-__QA_NONCE__/audio.mp3';$path=nj_file($relative);if(!$path||hash_file('sha256',$path)!=='__QA_AUDIO_SHA__')throw new RuntimeException('qa_audio_mismatch');
  $old=nj_find($db,$key);if($old)throw new RuntimeException('existing_asset_preserved');$db->prepare("INSERT INTO noa_jukebox_assets(song_key,source_url,title,audio_path,audio_bytes,audio_sha256,status,verified_at) VALUES(?,'','NOA QA',?,?,?,'ready',CURRENT_TIMESTAMP)")->execute([$key,$relative,filesize($path),'__QA_AUDIO_SHA__']);$result=['fixtureReady'=>true];
 }elseif($action==='cleanup'){
  if($existing===false){$result=['alreadyClean'=>true];}else{
   $keys=[];$q=$db->prepare("SELECT doc_key,payload FROM noa_documents WHERE doc_key LIKE ? OR doc_key=? OR doc_key=? OR (kind IN ('subscription_order','subscription_receipt') AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.ownerId'))=?)");$q->execute(['creator:'.hash('sha256',$id).':%',nc_channel_key($id),'subscription:member:'.hash('sha256',$id),$id]);foreach($q as $r){if((str_starts_with($r['doc_key'],'creator:')||str_starts_with($r['doc_key'],'subscription:'))&&!nam_owner(json_decode($r['payload'],true),['mb_id'=>$id]))throw new RuntimeException('foreign_record_preserved');$keys[]=$r['doc_key'];}
   foreach($keys as $key){$q=$db->prepare("SELECT COUNT(*) FROM noa_jukebox_uploads WHERE song_key=? AND status NOT IN ('failed','ready')");$q->execute([$key]);if((int)$q->fetchColumn())throw new RuntimeException('active_qa_upload_preserved');}
   $db->beginTransaction();foreach($keys as $key){foreach(['noa_jukebox_downloads','noa_jukebox_assets','noa_jukebox_uploads']as $name)$db->prepare('DELETE FROM '.$name.' WHERE song_key=?')->execute([$key]);$db->prepare('DELETE FROM noa_document_history WHERE doc_key=?')->execute([$key]);$db->prepare('DELETE FROM noa_documents WHERE doc_key=?')->execute([$key]);}
   if(!empty($g5['point_table'])&&preg_match('/^[A-Za-z0-9_]+$/D',$g5['point_table']))$db->prepare('DELETE FROM `'.$g5['point_table'].'` WHERE mb_id=?')->execute([$id]);$db->prepare('DELETE FROM `'.$table.'` WHERE mb_id=? AND mb_profile=?')->execute([$id,$marker]);$db->commit();$result=['cleaned'=>true,'ownDocuments'=>count($keys)];
  }
 }else throw new RuntimeException('invalid_action');
 echo json_encode(['ok'=>true]+$result,JSON_THROW_ON_ERROR);
}catch(Throwable $e){if(isset($db)&&$db->inTransaction())$db->rollBack();http_response_code(200);echo json_encode(['ok'=>false,'error'=>$e->getMessage()]);}
