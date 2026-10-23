<?php
declare(strict_types=1);
require_once dirname(__DIR__,2).'/deploy/noa-app/engine/music-adapter.php';
if(!in_array('sqlite',PDO::getAvailableDrivers(),true)){
    fwrite(STDERR,"PDO SQLite required for adapter test\n");exit(2);
}
$db=new PDO('sqlite::memory:');
$db->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);
$db->exec("CREATE TABLE noa_documents(doc_key TEXT PRIMARY KEY,kind TEXT)");
$db->exec("INSERT INTO noa_documents VALUES ('song-1','single')");
$e=['id'=>'evt-1','type'=>'audio.ready','source'=>'jukebox','subjectId'=>'song-1','occurredAt'=>'2026-10-23T00:00:00Z','schemaVersion'=>1,'correlationId'=>'job-1'];
$r=n80_music_catalog_probe($db,$e);
if(!$r['ok']||$r['status']!=='catalog_present'||$r['ackEligible']!==false)exit(1);
$e['subjectId']='unknown';
if(n80_music_catalog_probe($db,$e)['status']!=='catalog_missing')exit(2);
$e['source']='youtube';
if(n80_music_catalog_probe($db,$e)['error']!=='unsupported_event_source')exit(3);
if((int)$db->query('SELECT COUNT(*) FROM noa_documents')->fetchColumn()!==1)exit(4);
echo "N80_MUSIC_READONLY_ADAPTER_OK\n";
