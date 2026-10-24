<?php
// CI only. Repository sources and explicitly synthetic owner-list metrics, never production SQL.
declare(strict_types=1);define('_GNUBOARD_',true);
require dirname(__DIR__,2).'/bridge/home-store.php';
$db=new PDO('mysql:host=127.0.0.1;dbname=noa_restore_verification;charset=utf8mb4','root','noa-isolated-only',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);
$db->exec('SET TRANSACTION READ ONLY');$db->beginTransaction();$run=ny_latest($db);$before=nc_guard($db);$data=nh_load($db,$run);$repeat=nh_load($db,$run);$after=nc_guard($db);if($before!==$after)throw new RuntimeException('source_changed');$db->rollBack();
if(!is_file('quality-home/fixture-provenance.json'))throw new RuntimeException('source_fixture_provenance_required');
if($repeat!==$data)throw new RuntimeException('same_collection_read_model_not_deterministic');
$data['ok']=true;$data['runId']=$run['run_id'];$data['collectedAt']=json_decode($run['report'],true)['completedAt'];
$counts=[];foreach(['stories','covers','playlists'] as $s){$counts[$s]=['candidate'=>count($data[$s]),'sameCollectionReplay'=>count($repeat[$s])];if(!$data[$s])throw new RuntimeException('empty_candidate_'.$s);}
@mkdir('quality-home',0700,true);file_put_contents('quality-home/candidate.json',json_encode($data,JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR));
$report=['environment'=>'isolated MySQL repository-source fixture with synthetic metrics; not deployed','runId'=>$run['run_id'],'sameCollectionAsLive'=>false,'sameCollectionDeterministicReplay'=>true,'productionSqlUsed'=>false,'sourceGuardUnchanged'=>true,'counts'=>$counts,'diagnostics'=>$data['diagnostics'],'catalogGenres'=>$db->query('SELECT genre_id,COUNT(*) AS songs FROM noa_catalog_songs GROUP BY genre_id')->fetchAll(PDO::FETCH_ASSOC)];
file_put_contents('quality-home/report.json',json_encode($report,JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR));echo 'NOA_HOME_AUDIT '.json_encode($report,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)."\n";

