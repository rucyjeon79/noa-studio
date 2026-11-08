<?php
declare(strict_types=1);
require_once dirname(__DIR__,2).'/deploy/noa-app/engine/app-data.php';
require_once dirname(__DIR__,2).'/deploy/noa-app/engine/live-observer.php';
function check(bool $ok,string $message):void{if(!$ok)throw new RuntimeException($message);}
$db=new PDO('sqlite::memory:');$db->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);
check(n80_jukebox_draft_references($db)===[],'older schema has no private draft owners');
$db->exec('CREATE TABLE noa_documents(doc_key TEXT PRIMARY KEY,kind TEXT,payload TEXT)');
$db->exec('CREATE TABLE noa_creative_drafts(draft_id TEXT,doc_key TEXT,owner_id TEXT)');
$db->exec('CREATE TABLE noa_jukebox_assets(song_key TEXT)');
$db->exec('CREATE TABLE noa_jukebox_uploads(id TEXT,song_key TEXT,status TEXT)');
$db->exec('CREATE TABLE noa_jukebox_audio_jobs(id INTEGER,upload_id TEXT,status TEXT,finished_at TEXT)');
$db->exec('CREATE TABLE noa_user_playlists(owner_id TEXT,tracks TEXT)');
$db->exec('CREATE TABLE g5_member(mb_id TEXT)');
$db->exec("INSERT INTO noa_documents VALUES('single:published','single','{}')");
$insert=$db->prepare('INSERT INTO noa_documents VALUES(?,?,?)');
$index=$db->prepare('INSERT INTO noa_creative_drafts VALUES(?,?,?)');
foreach(['a','b','c','d','e'] as $letter){
    $id=str_repeat($letter,32);$key='n80:draft:'.$id;
    $draft=['ownerId'=>$letter==='c'?'wrong-owner':'owner','visibility'=>$letter==='d'?'public':'draft','_creative'=>['id'=>$id]];
    if($letter==='b')$draft['_creative']['publication']=['key'=>'single:published'];
    $insert->execute([$key,'n80_creative_draft',json_encode($draft)]);
    if($letter!=='e')$index->execute([$id,$key,'owner']);
    $db->prepare('INSERT INTO noa_jukebox_assets VALUES(?)')->execute([$key]);
}
$db->exec("INSERT INTO noa_jukebox_uploads VALUES('public','single:published','ready'),('missing','single:missing','ready')");
$db->exec("INSERT INTO noa_jukebox_audio_jobs VALUES(1,'public','ready','2026-11-08 00:00:00'),(2,'missing','ready','2026-11-08 00:00:00')");
foreach(['a'=>3,'b'=>4] as $letter=>$id){
    $db->prepare('INSERT INTO noa_jukebox_uploads VALUES(?,?,?)')->execute([$letter,'n80:draft:'.str_repeat($letter,32),'ready']);
    $db->prepare('INSERT INTO noa_jukebox_audio_jobs VALUES(?,?,?,?)')->execute([$id,$letter,'ready','2026-11-08 00:00:00']);
}
$db->prepare('INSERT INTO noa_user_playlists VALUES(?,?)')->execute(['owner',json_encode(['single:published','n80:draft:'.str_repeat('a',32)])]);
$db->exec("INSERT INTO g5_member VALUES('owner')");
$db->exec('PRAGMA query_only=ON');
$drafts=n80_jukebox_draft_references($db);
check(count($drafts)===2,'only owner-bound indexed private drafts are valid');
check(!isset(n80_app_references($db,n80_app_schema($db))['keys']['n80:draft:'.str_repeat('a',32)]),'private draft is not a public playlist key');
$audit=n80_app_audit($db,'unused','g5_member');
check($audit['checks']['noa_jukebox_assets_references']['privateDrafts']===2,'draft attachments retained');
check($audit['checks']['noa_jukebox_assets_references']['missing']===3,'invalid ownership and missing index remain errors');
check($audit['checks']['noa_jukebox_uploads_references']['missing']===1,'unknown public key remains an error');
check($audit['checks']['playlist_tracks']['unresolved']===1,'private draft must not enter a public playlist');
$live=n80_live_observe($db,dirname(__DIR__,2).'/deploy',10);
check($live['observed']===1&&count($live['privateDrafts'])===2&&count($live['rejected'])===1,'private retention is separate from public receipts');
check($live['privateDrafts']===n80_live_observe($db,dirname(__DIR__,2).'/deploy',10)['privateDrafts'],'private observation is stable on replay');
foreach($live['privateDrafts'] as $row)check($row['ackEligible']===false&&$row['catalogPublished']===false,'private upload cannot authorize public playback');
check($live['productionWrites']===0&&!$live['businessAck']&&!$live['queueMutation'],'observation has no business mutation');
$event=n80_ready_event_from_job($db,3)['event'];
check(n80_music_catalog_probe($db,$event)['status']==='catalog_missing','public MUSIC adapter remains strict');
check(!str_contains(json_encode($live),'n80:draft:')&&!str_contains(json_encode($audit),'wrong-owner'),'audit output must not expose private identity');
echo "N80_JUKEBOX_PRIVATE_REFERENCE_ISOLATION_OK\n";
