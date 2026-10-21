<?php
// CI only. A verified private snapshot is restored to disposable MySQL first.
declare(strict_types=1);define('_GNUBOARD_',true);
require dirname(__DIR__,2).'/bridge/home-store.php';
$db=new PDO('mysql:host=127.0.0.1;dbname=noa_restore_verification;charset=utf8mb4','root','noa-isolated-only',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);
$db->exec('SET TRANSACTION READ ONLY');$db->beginTransaction();$run=ny_latest($db);$before=nc_guard($db);$data=nh_load($db,$run);$after=nc_guard($db);if($before!==$after)throw new RuntimeException('source_changed');$db->rollBack();
$live=json_decode(file_get_contents('https://noastudio.ai.kr/noa-bridge/home.php'),true,512,JSON_THROW_ON_ERROR);
if(!$live['ok']||$live['runId']!==$run['run_id'])throw new RuntimeException('live_snapshot_run_mismatch');
$data['ok']=true;$data['runId']=$run['run_id'];$data['collectedAt']=json_decode($run['report'],true)['completedAt'];
$counts=[];foreach(['stories','covers','playlists'] as $s){$counts[$s]=['live'=>count($live[$s]),'candidate'=>count($data[$s])];if(!$data[$s])throw new RuntimeException('empty_candidate_'.$s);}
@mkdir('quality-home',0700,true);file_put_contents('quality-home/candidate.json',json_encode($data,JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR));
$report=['environment'=>'isolated MySQL verified production snapshot; not deployed','runId'=>$run['run_id'],'sameCollectionAsLive'=>true,'sourceGuardUnchanged'=>true,'counts'=>$counts,'diagnostics'=>$data['diagnostics'],'catalogGenres'=>$db->query('SELECT genre_id,COUNT(*) AS songs FROM noa_catalog_songs GROUP BY genre_id')->fetchAll(PDO::FETCH_ASSOC)];
file_put_contents('quality-home/report.json',json_encode($report,JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR));echo 'NOA_HOME_AUDIT '.json_encode($report,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)."\n";
