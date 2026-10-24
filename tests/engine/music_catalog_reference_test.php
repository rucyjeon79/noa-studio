<?php
declare(strict_types=1);
require_once dirname(__DIR__,2).'/deploy/noa-app/engine/music-adapter.php';
$db=new PDO('sqlite::memory:');$db->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);
$db->exec('CREATE TABLE noa_documents(doc_key TEXT,kind TEXT)');
$db->exec('CREATE TABLE noa_catalog_songs(song_id TEXT)');
$db->exec('CREATE TABLE noa_catalog_versions(batch_id TEXT,entity_id TEXT,entity_type TEXT)');
$db->exec('CREATE TABLE noa_catalog_batches(batch_id TEXT,status TEXT,applied_at TEXT)');
$id=str_repeat('a',64);$db->exec("INSERT INTO noa_catalog_songs VALUES('$id')");
$db->exec("INSERT INTO noa_catalog_batches VALUES('old','applied','2026-10-22'),('current','applied','2026-10-23')");
$db->exec("INSERT INTO noa_catalog_versions VALUES('current','$id','song')");
$long='single:'.str_repeat('b',150);$db->exec("INSERT INTO noa_documents VALUES('$long','single')");
$db->exec('PRAGMA query_only=ON');
$event=['id'=>'evt','type'=>'audio.ready','source'=>'jukebox','subjectId'=>'catalog:'.$id,'occurredAt'=>'2026-10-24T00:00:00Z','schemaVersion'=>1,'correlationId'=>'corr'];
if(n80_music_catalog_probe($db,$event)['status']!=='catalog_present')exit(1);
$event['subjectId']=$long;if(n80_music_catalog_probe($db,$event)['status']!=='catalog_present')exit(2);
$db->exec('PRAGMA query_only=OFF');$db->exec("UPDATE noa_catalog_versions SET batch_id='old'");$db->exec('PRAGMA query_only=ON');
$event['subjectId']='catalog:'.$id;if(n80_music_catalog_probe($db,$event)['status']!=='catalog_missing')exit(3);
echo "N80_RECOVERED_CATALOG_AND_LONG_KEY_OK\n";
