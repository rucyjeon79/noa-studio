<?php
/** Build reproducible public-source test data in the fresh Actions MySQL service.
 * No host credentials, production SQL, network collection or SQL dump artifacts.
 * The original mysql_test.php intentionally remains unchanged and runs twice.
 */
declare(strict_types=1);
if(getenv('NOA_POPULARITY_SOURCE_FIXTURE')!=='1'||getenv('GITHUB_ACTIONS')!=='true')throw new RuntimeException('explicit disposable Actions fixture required');
define('_GNUBOARD_',true);
require __DIR__.'/../../bridge/popularity-plays.php';
$db=new PDO('mysql:host=127.0.0.1;dbname=noa_restore_verification;charset=utf8mb4','root','noa-isolated-only',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);
$db->exec("SET time_zone='+00:00'");
if($db->query('SHOW TABLES')->fetchColumn()!==false)throw new RuntimeException('fixture_database_must_be_empty');
$db->exec('CREATE TABLE noa_documents(doc_key VARCHAR(191) PRIMARY KEY,kind VARCHAR(32),payload LONGTEXT,revision INT) ENGINE=InnoDB');
$db->exec('CREATE TABLE g5_member(mb_id VARCHAR(20) PRIMARY KEY,mb_name VARCHAR(50)) ENGINE=InnoDB');
$db->exec("INSERT INTO g5_member VALUES('fixture-preserve','Public source fixture account')");
// Reuse the same source bundle, merge/import/checksum pipeline as catalog CI.
$seed=require __DIR__.'/../../bridge/catalog-seed.php';$sources=$seed['sources'];
foreach($sources as &$source)$source['raw']=$seed['blobs'][$source['sha256']];unset($source);
$plan=nc_merge($sources,$seed['limits']);$plan['sourceGuard']=nc_guard($db);$plan['blobs']=[];
foreach($plan['sources']as &$source){$plan['blobs'][$source['sha256']]=$source['raw'];unset($source['raw']);}unset($source);
$next=['stage'=>'start','offset'=>0];
for($turn=0;$turn<1000;$turn++){$next=nc_apply($db,$plan,$next['stage'],$next['offset'],'fixture-source');if(!empty($next['done']))break;}
if(empty($next['done']))throw new RuntimeException('source_catalog_import_incomplete');
$songs=ny_songs($db,ny_batch($db));ksort($songs,SORT_STRING);
if(count($songs)<2)throw new RuntimeException('source_catalog_required');
ny_schema($db);$run=substr(hash('sha256','noa-popularity-source-fixture-1'),0,32);$at=gmdate('Y-m-d H:i:s',time()-86400);
$q=$db->prepare('INSERT INTO noa_youtube_runs(run_id,channel_id,catalog_batch,report,created_at) VALUES(?,?,?,?,?)');
$q->execute([$run,NP_CHANNEL,ny_batch($db),np_json(['completedAt'=>gmdate('c',time()-86400),'fixture'=>true]),$at]);
// Synthetic recorded counts deliberately do not represent production YouTube views.
// Each video maps to an imported source song, including the first ordered song
// used by the unchanged replay test's real valid-play ledger assertions.
$q=$db->prepare('INSERT INTO noa_youtube_videos(run_id,video_id,payload,match_json) VALUES(?,?,?,?)');
$videoIds=[];$number=0;
foreach(array_slice($songs,0,20,true)as $sid=>$song){
 $video=sprintf('fixt%07d',++$number);$videoIds[]=$video;
 $payload=['id'=>$video,'snippet'=>['title'=>'Source fixture EP '.$number,'channelId'=>NP_CHANNEL,'description'=>'Synthetic metric fixture only'],'status'=>['privacyStatus'=>'public','embeddable'=>true],'statistics'=>['viewCount'=>(string)(100000-$number)]];
 $q->execute([$run,$video,np_json($payload),np_json(['status'=>'matched','songId'=>$sid,'candidates'=>[]])]);
}
// Include owner playlist membership and all nine real taxonomy tables/default
// rules so original classification/confirmed-relation preservation guards run.
$playlist='PL_source_fixture_ACT_01';
$q=$db->prepare('INSERT INTO noa_youtube_playlists(run_id,playlist_id,payload) VALUES(?,?,?)');
$q->execute([$run,$playlist,np_json(['id'=>$playlist,'snippet'=>['title'=>'ACT 1 Playlist','channelId'=>NP_CHANNEL],'status'=>['privacyStatus'=>'public']])]);
$q=$db->prepare('INSERT INTO noa_youtube_items(run_id,playlist_id,item_id,position,video_id,payload) VALUES(?,?,?,?,?,?)');
foreach($videoIds as $position=>$video)$q->execute([$run,$playlist,'fixture-'.$position,$position,$video,np_json(['videoId'=>$video])]);
$taxonomy=nt_migrate($db,'fixture-source');
$firstSid=array_key_first($songs);$firstVideo=$videoIds[0];
$q=$db->prepare("INSERT INTO noa_content_matches(video_id,song_id,status,source,evidence,updated_by) VALUES(?,?,'confirmed','manual',?,'fixture-source')");$q->execute([$firstVideo,$firstSid,nt_json(['fixture'=>'source-confirmed'])]);
$q=$db->prepare("INSERT INTO noa_content_categories(content_type,content_id,category_id,source,evidence,updated_by) VALUES('song',?,'original','manual',?,'fixture-source')");$q->execute([$firstSid,nt_json(['fixture'=>'manual-value-preservation'])]);
if(nc_exists($db,'noa_valid_plays'))throw new RuntimeException('fixture_must_not_preinstall_popularity');
$provenance=['fixtureKind'=>'repository_sources_and_synthetic_youtube_metrics','sourceCommit'=>getenv('GITHUB_SHA')?:null,'sourceSongs'=>count($songs),'recordedFixtureVideos'=>count($videoIds),'taxonomyTables'=>count($taxonomy['created']),'productionSqlUsed'=>false,'hostConnectionUsed'=>false,'sourceCatalogChecksumVerified'=>true,'scope'=>'disposable source regression, not production backup restoration','legacyReportFieldNote'=>'realBackupTotalsYoutube in unchanged mysql_test.php contains synthetic fixture view totals in this CI'];
@mkdir('quality-popularity',0700,true);file_put_contents('quality-popularity/fixture-provenance.json',json_encode($provenance,JSON_THROW_ON_ERROR));
echo json_encode($provenance,JSON_THROW_ON_ERROR)."\n";
