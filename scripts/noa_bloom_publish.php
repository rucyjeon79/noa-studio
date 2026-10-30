<?php
declare(strict_types=1);
ini_set('display_errors','0');header('Content-Type: application/json');header('Cache-Control: no-store');
if(time()>__EXPIRY__||!hash_equals('__TOKEN_SHA__',hash('sha256',$_SERVER['HTTP_X_NOA_DIAGNOSTIC']??''))){http_response_code(403);exit;}
require dirname(__DIR__).'/common.php';if(session_status()===PHP_SESSION_ACTIVE)session_write_close();
require_once __DIR__.'/storage.php';require_once __DIR__.'/sound-core.php';
$key='catalog:a785dbc3e646c64b54cd1536048100e5ee66f55ec9be69d39e6b5251c91f4bba';
$list='playlist:custom:9fed48ee44d5b75621e4c7be';
$db=noa_bridge_pdo();$db->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);
try{
 $write=$_SERVER['REQUEST_METHOD']==='POST';if($write)$db->beginTransaction();
 $q=$db->prepare('SELECT doc_key,kind,payload,revision,updated_by FROM noa_documents WHERE doc_key IN (?,?) ORDER BY doc_key'.($write?' FOR UPDATE':''));$q->execute([$key,$list]);$rows=$q->fetchAll(PDO::FETCH_ASSOC);
 if(count($rows)!==2)throw new RuntimeException('missing_rows');
 $by=array_column($rows,null,'doc_key');$row=$by[$key];$d=json_decode($row['payload'],true,512,JSON_THROW_ON_ERROR);$playlist=json_decode($by[$list]['payload'],true,512,JSON_THROW_ON_ERROR);
 if(($d['body']['confirmedTitle']??$d['title']??'')!=='BLOOM'||$row['kind']!=='story'||!empty($d['_noaTrash']))throw new RuntimeException('unexpected_target');
 $members=array_column($playlist['body']['members']??[],'key');if(!in_array(substr($key,8),$members,true)&&!in_array($key,$members,true))throw new RuntimeException('membership_changed');
 $digest=hash('sha256',json_encode($rows,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR));
 if(!$write){echo json_encode(['ok'=>true,'rows'=>$rows,'digest'=>$digest,'databaseWrites'=>0],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);exit;}
 $input=$_POST;
 if(!hash_equals($digest,$input['expectedDigest']??''))throw new RuntimeException('concurrent_change');
 if(($d['visibility']??'')!=='private')throw new RuntimeException('unexpected_visibility');
 $before=$d;$d['visibility']='public';$encoded=json_encode($d,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
 $q=$db->prepare('UPDATE noa_documents SET payload=?,revision=revision+1,updated_by=? WHERE doc_key=? AND revision=?');$q->execute([$encoded,'noa-bloom',$key,(int)$row['revision']]);if($q->rowCount()!==1)throw new RuntimeException('revision_conflict');
 $revision=(int)$row['revision']+1;$q=$db->prepare('INSERT INTO noa_document_history(doc_key,revision,payload,changed_by) VALUES(?,?,?,?)');$q->execute([$key,$revision,$encoded,'noa-bloom']);
 $q=$db->prepare('SELECT payload,revision FROM noa_documents WHERE doc_key=?');$q->execute([$key]);$saved=$q->fetch(PDO::FETCH_ASSOC);$after=json_decode($saved['payload'],true,512,JSON_THROW_ON_ERROR);$compare=$after;$compare['visibility']='private';
 if($compare!==$before||!noa_sound_visible($after,false)||(int)$saved['revision']!==$revision)throw new RuntimeException('verification_failed');
 $q->execute([$list]);$same=$q->fetch(PDO::FETCH_ASSOC);if($same['payload']!==$by[$list]['payload']||(int)$same['revision']!==(int)$by[$list]['revision'])throw new RuntimeException('collection_changed');
 $db->commit();echo json_encode(['ok'=>true,'title'=>'BLOOM','visibility'=>'public','revision'=>$revision,'memberVisible'=>true,'otherFieldsUnchanged'=>true,'collectionUnchanged'=>true,'documentsUpdated'=>1,'historyRowsAdded'=>1],JSON_THROW_ON_ERROR);
}catch(Throwable $e){if($db->inTransaction())$db->rollBack();http_response_code(200);echo json_encode(['ok'=>false,'error'=>($e instanceof PDOException?'database_error':$e->getMessage()),'exception'=>get_class($e),'sqlState'=>($e instanceof PDOException?$e->getCode():null),'driverCode'=>($e instanceof PDOException?($e->errorInfo[1]??null):null)]);}
