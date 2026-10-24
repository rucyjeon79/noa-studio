<?php
declare(strict_types=1);
require_once dirname(__DIR__,2).'/deploy/noa-app/engine/live-observer.php';
$db=new PDO('sqlite::memory:');$db->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);
$db->exec('CREATE TABLE noa_documents(doc_key TEXT PRIMARY KEY,kind TEXT)');
$db->exec('CREATE TABLE noa_jukebox_uploads(id TEXT,song_key TEXT,status TEXT)');
$db->exec('CREATE TABLE noa_jukebox_audio_jobs(id INTEGER,upload_id TEXT,status TEXT,finished_at TEXT)');
$db->exec("INSERT INTO noa_documents VALUES('song-1','single')");
$db->exec("INSERT INTO noa_jukebox_uploads VALUES('u1','song-1','ready'),('u2','song-2','ready'),('qa','jukebox:qa:one','ready')");
$db->exec("INSERT INTO noa_jukebox_audio_jobs VALUES(1,'u1','ready','2026-10-23 10:00:00'),(2,'u2','ready','2026-10-23 10:00:00'),(3,'qa','ready','2026-10-23 10:00:00')");
// SQLite read-only enforcement rejects any accidental mutation in the live adapter.
$db->exec('PRAGMA query_only=ON');
$a=n80_live_observe($db,dirname(__DIR__,2).'/deploy',10);
$b=n80_live_observe($db,dirname(__DIR__,2).'/deploy',10);
if($a['observed']!==1||$a['sampledJobs']!==2||count($a['rejected'])!==1)exit(1);
if($a['receipts']!==$b['receipts']||$a['businessAck']||$a['queueMutation']||$a['productionWrites']!==0)exit(2);
if($a['receipts'][0]['effect']!=='catalog_observation_only')exit(3);
$db->exec('PRAGMA query_only=OFF');
$db->exec("INSERT INTO noa_jukebox_uploads VALUES('replacement','song-1','processing')");
$db->exec("INSERT INTO noa_jukebox_audio_jobs VALUES(4,'replacement','processing',NULL)");
$db->exec('PRAGMA query_only=ON');
if(n80_live_observe($db,dirname(__DIR__,2).'/deploy',10)['observed']!==0)exit(4);
try{n80_live_observe($db,'unused',26);exit(5);}catch(InvalidArgumentException $e){}
echo "N80_LIVE_OBSERVER_READ_ONLY_OK\n";
