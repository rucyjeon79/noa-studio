<?php
declare(strict_types=1);
require_once dirname(__DIR__,2).'/deploy/noa-app/engine/authenticated-probe.php';
if(!in_array('sqlite',PDO::getAvailableDrivers(),true))exit(2);
$db=new PDO('sqlite::memory:');$db->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);
$db->exec("CREATE TABLE noa_documents(doc_key TEXT PRIMARY KEY,kind TEXT)");
$db->exec("INSERT INTO noa_documents VALUES('song-1','single')");
$e=['id'=>'evt-1','type'=>'audio.ready','source'=>'jukebox','subjectId'=>'song-1','occurredAt'=>'2026-10-23T00:00:00Z','schemaVersion'=>1,'correlationId'=>'job-1'];
$ctx=['authenticatedByServer'=>true,'principal'=>'jukebox_worker','permission'=>'catalog:read'];
if(n80_music_probe_authorized($db,$e,[])['error']!=='unauthenticated')exit(1);
if(n80_music_probe_authorized($db,$e,['authenticatedByServer'=>true,'principal'=>'web_user','permission'=>'catalog:read'])['error']!=='principal_not_allowed')exit(3);
$r=n80_music_probe_authorized($db,$e,$ctx);
if(!$r['ok']||$r['status']!=='catalog_present'||$r['ackEligible']!==false)exit(4);
$e['source']='youtube';if(n80_music_probe_authorized($db,$e,$ctx)['error']!=='unsupported_event_source')exit(5);
if((int)$db->query('SELECT COUNT(*) FROM noa_documents')->fetchColumn()!==1)exit(6);
echo "N80_AUTHORIZED_PROBE_OK\n";
