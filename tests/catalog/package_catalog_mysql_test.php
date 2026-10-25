<?php
/** Real catalog publication with installation enabled, in a separate disposable DB. */
declare(strict_types=1);define('_GNUBOARD_',true);$dsn=getenv('NOA_MYSQL_DSN');if(!str_contains((string)$dsn,'dbname=noa_inline_edit_test;'))throw new RuntimeException('isolated_database_required');
$root=sys_get_temp_dir().'/noa-package-catalog-'.bin2hex(random_bytes(6));mkdir($root);mkdir($root.'/html');mkdir($root.'/noa-ai-lab');define('G5_PATH',$root.'/html');require __DIR__.'/../../bridge/catalog-store.php';require_once __DIR__.'/../../bridge/package-record.php';
$db=new PDO($dsn,'root','noa-test-only',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);$db->exec('CREATE DATABASE noa_package_catalog_test CHARACTER SET utf8mb4');$db->exec('USE noa_package_catalog_test');
$db->exec('CREATE TABLE noa_documents(doc_key VARCHAR(191) PRIMARY KEY,kind VARCHAR(32),payload LONGTEXT,revision BIGINT,updated_by VARCHAR(20));CREATE TABLE noa_document_history(doc_key VARCHAR(191),revision BIGINT,payload LONGTEXT,changed_by VARCHAR(20),PRIMARY KEY(doc_key,revision));');
$db->beginTransaction();nup_store($db,'meta:package-record-policy','meta',['schema'=>1,'installed'=>true],0,'fixture');$db->commit();
$seed=require __DIR__.'/../../bridge/catalog-seed.php';$sources=$seed['sources'];foreach($sources as &$s)$s['raw']=$seed['blobs'][$s['sha256']];unset($s);$p=nc_merge($sources,$seed['limits']);$p['sourceGuard']=nc_guard($db);$p['blobs']=[];foreach($p['sources'] as &$s){$p['blobs'][$s['sha256']]=$s['raw'];unset($s['raw']);}unset($s);
$next=['stage'=>'start','offset'=>0];for($turn=0;$turn<1000;$turn++){$next=nc_apply($db,$p,$next['stage'],$next['offset'],'fixture');if(!empty($next['done']))break;}
if(empty($next['done'])||$next['registeredCompleteRecords']!==$p['report']['songs'])throw new RuntimeException('complete_song_registration_failed');
if(!nc_apply($db,$p,'start',0,'fixture')['replayed'])throw new RuntimeException('published_import_retry_not_idempotent');
$key=$db->query("SELECT doc_key FROM noa_documents WHERE kind='story' ORDER BY doc_key LIMIT 1")->fetchColumn();$db->beginTransaction();$q=$db->prepare('SELECT payload,revision FROM noa_documents WHERE doc_key=?');$q->execute([$key]);$r=$q->fetch(PDO::FETCH_ASSOC);$d=json_decode($r['payload'],true);$d['body']['communityPost']='사용자 새 수정';nup_store($db,$key,'story',$d,(int)$r['revision'],'fixture');$db->commit();
try{nc_apply($db,$p,'start',0,'fixture');throw new RuntimeException('later_user_change_was_not_guarded');}catch(DomainException $e){if($e->getMessage()!=='source_changed_reextract_required')throw $e;}
echo "UNIFIED_REAL_CATALOG_PUBLICATION_REGISTRATION_LOST_RESPONSE_RETRY_AND_LATER_USER_GUARD_OK\n";
