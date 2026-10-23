<?php
declare(strict_types=1);
require_once dirname(__DIR__,2).'/deploy/noa-app/engine/readonly-pipeline.php';
if(!in_array('sqlite',PDO::getAvailableDrivers(),true))exit(2);
$db=new PDO('sqlite::memory:');$db->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);
$db->exec("CREATE TABLE noa_documents(doc_key TEXT PRIMARY KEY,kind TEXT)");
$db->exec("INSERT INTO noa_documents VALUES('song-1','single')");
$db->exec('CREATE TABLE noa_jukebox_uploads(id TEXT, song_key TEXT, status TEXT)');
$db->exec('CREATE TABLE noa_jukebox_audio_jobs(id INTEGER, upload_id TEXT, status TEXT)');
$dir=sys_get_temp_dir().'/n80-pipeline-'.getmypid().'-'.bin2hex(random_bytes(4));mkdir($dir,0700);
$event=['id'=>'evt-1','type'=>'audio.ready','source'=>'jukebox','subjectId'=>'song-1','occurredAt'=>'2026-10-23T00:00:00Z','schemaVersion'=>1,'correlationId'=>'corr-1'];
$context=['authenticatedByServer'=>true,'principal'=>'jukebox_worker','permission'=>'catalog:read'];
try {
 if(n80_readonly_pipeline($db,$dir,$event,[])['error']!=='unauthorized')exit(1);
 $unsafe=n80_readonly_pipeline($db,dirname(__DIR__,2).'/deploy/noa-app/engine',$event,$context);
 if($unsafe['error']!=='unsafe_event_storage')exit(8);
 if(n80_verified_ready_pipeline($db,$dir,$event,$context)['error']!=='source_not_ready')exit(9);
 $db->exec("INSERT INTO noa_jukebox_uploads VALUES('upload-1','song-1','ready')");
 $db->exec("INSERT INTO noa_jukebox_audio_jobs VALUES(1,'upload-1','processing')");
 if(n80_verified_ready_pipeline($db,$dir,$event,$context)['error']!=='source_not_ready')exit(10);
 $db->exec("UPDATE noa_jukebox_audio_jobs SET status='ready' WHERE id=1");
 $verified=n80_verified_ready_pipeline($db,$dir,$event,$context);
 if(!$verified['ok']||$verified['ackEligible']!==false)exit(11);
 $first=n80_readonly_pipeline($db,$dir,$event,$context);
 if(!$first['ok']||$first['storageStatus']!=='stored'||$first['ackEligible']!==false||$first['workerExecuted']!==false)exit(3);
 $second=n80_readonly_pipeline($db,$dir,$event,$context);
 if(!$second['ok']||$second['storageStatus']!=='already_stored')exit(4);
 $bad=$event;$bad['subjectId']='missing';$bad['id']='evt-2';
 if(n80_readonly_pipeline($db,$dir,$bad,$context)['error']!=='catalog_missing')exit(5);
 if(count(glob($dir.'/*.json'))!==1)exit(6);
 if((int)$db->query('SELECT COUNT(*) FROM noa_documents')->fetchColumn()!==1)exit(7);
 echo "N80_READONLY_PIPELINE_OK\n";
}finally{
 foreach(glob($dir.'/{*,.*}',GLOB_BRACE) as $file)if(is_file($file))unlink($file);
 rmdir($dir);
}
