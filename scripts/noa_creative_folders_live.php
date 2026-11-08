<?php
// Short-lived deployment maintenance: invokes the existing N80 document/media owner.
declare(strict_types=1);ini_set('display_errors','0');header('Content-Type: application/json');header('Cache-Control: no-store');
if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||time()>__EXPIRY__||!hash_equals('__TOKEN_SHA__',hash('sha256',$_SERVER['HTTP_X_NOA_CONTROL']??''))){http_response_code(404);exit;}
$level=ob_get_level();ob_start();require_once dirname(__DIR__).'/common.php';if(session_status()===PHP_SESSION_ACTIVE)session_write_close();
try{
 require_once __DIR__.'/storage.php';require_once __DIR__.'/sound-core.php';require_once __DIR__.'/creative-publication.php';
 $db=noa_bridge_pdo();$owner=(string)$config['cf_admin'];$changed=0;$deferred=0;$reported=[];
 $legacy=static function(array $a):bool{foreach(['audio_path','cover_path'] as $f)if(!empty($a[$f])&&preg_match('/ \[[a-f0-9]{16}\]$/D',dirname($a[$f])))return true;return false;};
 $rows=$db->query("SELECT a.song_key,a.audio_path,a.cover_path FROM noa_jukebox_assets a JOIN noa_documents d ON d.doc_key=a.song_key WHERE d.kind IN ('single','story','n80_creative_draft') AND JSON_EXTRACT(d.payload,'$._noaTrash') IS NULL ORDER BY a.song_key")->fetchAll(PDO::FETCH_ASSOC);
 foreach($rows as $row){
  if(!$legacy($row))continue;if($changed>=20)break;
  try{
   $db->beginTransaction();$q=$db->prepare('SELECT kind,payload,revision FROM noa_documents WHERE doc_key=? FOR UPDATE');$q->execute([$row['song_key']]);$r=$q->fetch(PDO::FETCH_ASSOC);if(!$r)throw new RuntimeException('document_missing');$d=json_decode($r['payload'],true,512,JSON_THROW_ON_ERROR);
   $q=$db->prepare('SELECT * FROM noa_jukebox_assets WHERE song_key=? FOR UPDATE');$q->execute([$row['song_key']]);$before=$q->fetch(PDO::FETCH_ASSOC);
   if(!$legacy($before)){$db->rollBack();continue;}
   nup_store($db,$row['song_key'],$r['kind'],$d,(int)$r['revision'],$owner);
   $after=nj_find($db,$row['song_key']);$stored=nj_document($db,$row['song_key']);
   foreach(['audio'=>'audioFileLocation','cover'=>'cardImageLocation'] as $type=>$field){
    if(empty($before[$type.'_path']))continue;
    if(!nj_verified($after,$type)||$after[$type.'_sha256']!==$before[$type.'_sha256']||$stored['body'][$field]!==$after[$type.'_path'])throw new RuntimeException('relocated_media_verification_failed');
   }
   if($legacy($after))throw new RuntimeException('legacy_folder_remains');
   $db->commit();$changed++;nml_cleanup($db);
   if(($d['title']??'')==='행간의 연서(行間戀書)')$reported[]=['audio'=>$after['audio_path'],'cover'=>$after['cover_path'],'verified'=>true];
  }catch(DomainException $e){if($db->inTransaction())$db->rollBack();nml_cleanup($db);if($e->getMessage()!=='upload_busy')throw $e;$deferred++;}
 }
 $remaining=0;foreach($db->query("SELECT a.audio_path,a.cover_path FROM noa_jukebox_assets a JOIN noa_documents d ON d.doc_key=a.song_key WHERE d.kind IN ('single','story','n80_creative_draft') AND JSON_EXTRACT(d.payload,'$._noaTrash') IS NULL")->fetchAll(PDO::FETCH_ASSOC) as $a)if($legacy($a))$remaining++;
 $out=['ok'=>true,'result'=>['changed'=>$changed,'remaining'=>$remaining,'activeUploadsDeferred'=>$deferred,'reportedSong'=>$reported]];
}catch(Throwable $e){if(isset($db)&&$db->inTransaction())$db->rollBack();http_response_code(500);$out=['ok'=>false,'error'=>$e->getMessage()];}
while(ob_get_level()>$level)ob_end_clean();echo json_encode($out,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
