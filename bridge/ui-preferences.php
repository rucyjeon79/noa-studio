<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/common.php';
require_once __DIR__.'/storage.php';
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: private, no-store');header('X-Content-Type-Options: nosniff');
function noa_ui_reply(int $status,array $value):never{http_response_code($status);echo json_encode($value,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);exit;}
$design=json_decode(file_get_contents(dirname(__DIR__).'/noa-design.json'),true,512,JSON_THROW_ON_ERROR);
$ids=array_column($design['themes'],'id');$method=$_SERVER['REQUEST_METHOD']??'GET';$logged=!empty($is_member)&&!empty($member['mb_id']);$admin=$logged&&($is_admin??'')==='super';
if(!in_array($method,['GET','POST'],true))noa_ui_reply(405,['error'=>'method_not_allowed']);
if(empty($_SESSION['noa_ui_token']))$_SESSION['noa_ui_token']=bin2hex(random_bytes(32));
try{
 $db=noa_bridge_pdo();$defaults=['theme'=>$design['defaultTheme'],'enabled'=>$ids];$policyRevision=0;
 $q=$db->prepare("SELECT payload,revision FROM noa_documents WHERE doc_key=? AND kind='prefs'");$q->execute(['ui:policy']);$policy=$q->fetch(PDO::FETCH_ASSOC);
 if($policy){$saved=json_decode($policy['payload'],true,512,JSON_THROW_ON_ERROR);if(in_array($saved['theme']??'', $ids,true)&&is_array($saved['enabled']??null)){$defaults=$saved;$policyRevision=(int)$policy['revision'];}}
 $key=$logged?'ui:user:'.hash('sha256',(string)$member['mb_id']):'';$settings=null;$revision=0;
 if($logged){$q->execute([$key]);$row=$q->fetch(PDO::FETCH_ASSOC);if($row){$settings=json_decode($row['payload'],true,512,JSON_THROW_ON_ERROR);$revision=(int)$row['revision'];}}
 $defaults=['theme'=>$design['defaultTheme'],'enabled'=>$ids];
 if(is_array($settings))$settings=array_merge($settings,['theme'=>in_array($settings['theme']??null,$ids,true)?$settings['theme']:$design['defaultTheme'],'design'=>'ios','radius'=>'soft']);
 if($method==='GET')noa_ui_reply(200,['member'=>$logged,'admin'=>$admin,'displayName'=>$logged?get_text((string)$member['mb_nick']):'','settings'=>$settings,'revision'=>$revision,'defaults'=>$defaults,'policyRevision'=>$policyRevision,'csrf'=>$logged?$_SESSION['noa_ui_token']:null]);
 if(!$logged)noa_ui_reply(401,['error'=>'login_required']);
 if(($_SERVER['HTTP_ORIGIN']??'')!=='https://noastudio.ai.kr'||!hash_equals($_SESSION['noa_ui_token'],$_SERVER['HTTP_X_NOA_CSRF']??'')||strtolower(trim(explode(';',$_SERVER['CONTENT_TYPE']??'')[0]))!=='application/json')noa_ui_reply(403,['error'=>'request_verification_failed']);
 $raw=file_get_contents('php://input',false,null,0,8193);if($raw===false||strlen($raw)>8192)noa_ui_reply(413,['error'=>'too_large']);
 $data=json_decode($raw,true);if(!is_array($data))noa_ui_reply(400,['error'=>'invalid_settings']);$expected=$data['expectedRevision']??null;$v=$data['settings']??null;
 if(!is_int($expected)||$expected<0||!is_array($v)||!in_array($v['theme']??'', $ids,true))noa_ui_reply(400,['error'=>'invalid_settings']);
 $scope=$data['scope']??'user';
 if($scope==='policy'){
  if(!$admin)noa_ui_reply(403,['error'=>'administrator_required']);
  $enabled=$v['enabled']??null;if(!is_array($enabled)||!array_is_list($enabled)||!$enabled||array_diff($enabled,$ids)||!in_array($v['theme'],$enabled,true))noa_ui_reply(400,['error'=>'invalid_policy']);
  $key='ui:policy';$v=['theme'=>$v['theme'],'enabled'=>array_values(array_unique($enabled))];
 }elseif($scope==='user'){
  if(!in_array($v['language']??'',['ko','ja','en','th'],true)||!in_array($v['radius']??'',['soft','sharp'],true)||!in_array($v['design']??'',['ios','plain'],true)||!in_array($v['theme'],$defaults['enabled'],true))noa_ui_reply(400,['error'=>'invalid_settings']);
  $v=array_intersect_key($v,array_flip(['theme','language','radius','design']));
 }else noa_ui_reply(400,['error'=>'invalid_scope']);
 // Verify the existing additive NOA schema before any write. Never alter GnuBoard tables.
 foreach(['noa_documents'=>['doc_key','kind','payload','revision','updated_by'],'noa_document_history'=>['doc_key','revision','payload','changed_by']] as $table=>$cols)if(array_diff($cols,$db->query('SHOW COLUMNS FROM '.$table)->fetchAll(PDO::FETCH_COLUMN)))noa_ui_reply(503,['error'=>'schema_mismatch']);
 $encoded=json_encode($v,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);$owner=(string)$member['mb_id'];$db->beginTransaction();
 $q=$db->prepare("INSERT IGNORE INTO noa_documents(doc_key,kind,payload,revision,updated_by) VALUES(?,'prefs','{}',0,?)");$q->execute([$key,$owner]);
 $q=$db->prepare('SELECT kind,payload,revision FROM noa_documents WHERE doc_key=? FOR UPDATE');$q->execute([$key]);$current=$q->fetch(PDO::FETCH_ASSOC);
 if(!$current||$current['kind']!=='prefs'){ $db->rollBack();noa_ui_reply(409,['error'=>'settings_conflict']);}
 if((int)$current['revision']===$expected+1&&$current['payload']===$encoded){$db->commit();noa_ui_reply(200,['revision'=>(int)$current['revision'],'replayed'=>true]);}
 if((int)$current['revision']!==$expected){$db->rollBack();noa_ui_reply(409,['error'=>'revision_conflict']);}
 if($current['payload']===$encoded){$db->commit();noa_ui_reply(200,['revision'=>$expected,'unchanged'=>true]);}
 $next=$expected+1;$q=$db->prepare('UPDATE noa_documents SET payload=?,revision=?,updated_by=? WHERE doc_key=?');$q->execute([$encoded,$next,$owner,$key]);
 $q=$db->prepare('INSERT INTO noa_document_history(doc_key,revision,payload,changed_by) VALUES(?,?,?,?)');$q->execute([$key,$next,$encoded,$owner]);$db->commit();noa_ui_reply(200,['revision'=>$next]);
}catch(Throwable $e){if(isset($db)&&$db->inTransaction())$db->rollBack();error_log('[noa-ui] '.get_class($e));noa_ui_reply(503,['error'=>'settings_unavailable']);}
