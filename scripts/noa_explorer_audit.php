<?php
declare(strict_types=1);ini_set('display_errors','0');header('Content-Type: application/json');header('Cache-Control: no-store');
if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||time()>NOA_CREATOR_EXPIRY||!hash_equals('NOA_CREATOR_TOKEN_SHA',hash('sha256',(string)($_SERVER['HTTP_X_NOA_CONTROL']??'')))){http_response_code(404);exit;}
$stage='workspace';$buffer=ob_get_level();ob_start();require_once dirname(__DIR__).'/common.php';
try{
 require_once __DIR__.'/storage.php';require_once __DIR__.'/creator-core.php';require_once __DIR__.'/sound-core.php';require_once __DIR__.'/music-readmodel.php';require_once dirname(__DIR__).'/noa-app/jukebox/upload-core.php';
 $db=noa_bridge_pdo();$owner=(string)$config['cf_admin'];$channel=nc_row($db,nc_channel_key($owner));if(!$channel||!nam_owner($channel['document'],['mb_id'=>$owner]))throw new RuntimeException('channel_owner');
 $start=hrtime(true);
 $records=nc_owned_records($db,$owner);
 $aliases=nc_record_aliases($db,$records);
 $oldBytes=2;$keys=[];
 foreach ($records as $r) {
  $d=json_decode($r['payload'],true,512,JSON_THROW_ON_ERROR);
  if(!nam_owner($d,['mb_id'=>$owner])||!empty($d['_noaTrash']))continue;
  $key=$r['doc_key'];
  $full=nc_editor_record($db,$r,$d,['admin'=>true,'ownDownload'=>true],$aliases[$key]);
  $oldBytes+=strlen(json_encode($full,JSON_UNESCAPED_UNICODE|JSON_HEX_TAG|JSON_THROW_ON_ERROR))+($keys?1:0);
  $keys[$key]=$full['title'];
 }
 $oldMs=round((hrtime(true)-$start)/1e6,1);$start=hrtime(true);
 $index=nc_song_index($db,$owner,true);
 if(array_column($index,'title','key')!==$keys)throw new RuntimeException('owner_index_mismatch');
 $newBytes=strlen(json_encode($index,JSON_UNESCAPED_UNICODE|JSON_HEX_TAG|JSON_THROW_ON_ERROR));
 $timings=['records'=>count($keys),'oldSongBytes'=>$oldBytes,'newSongBytes'=>$newBytes,
     'oldListMs'=>$oldMs,'newListMs'=>round((hrtime(true)-$start)/1e6,1)];
 $assets=nj_assets($db);$counts=['records'=>0,'songs'=>0,'collections'=>0,'verifiedCovers'=>0,'acquiredCovers'=>0,'channelFallback'=>0,'emptyCovers'=>0];
 foreach($records as $r){$d=json_decode($r['payload'],true);if(!empty($d['_noaTrash']))continue;$counts['records']++;if($r['kind']==='playlist'){$counts['collections']++;continue;}$counts['songs']++;$b=$d['body']??[];$s=noa_sound_suno($b);if(noa_music_asset_url($assets,$r['doc_key'],$s,'cover'))$counts['verifiedCovers']++;elseif(noa_sound_cover($b))$counts['acquiredCovers']++;else $counts['channelFallback']++;if(function_exists('noa_music_cover')&&noa_music_cover($assets,$r['doc_key'],$s,$b,$owner)==='')$counts['emptyCovers']++;}
 // Exercise both production previews without creating a batch or waking either worker.
 $stage='batch-dependencies';
 require_once __DIR__.'/generation-rules.php';
 require_once __DIR__.'/channel-batch-ai.php';
 require_once __DIR__.'/channel-batch-audio.php';
 $sample=array_slice(array_column(array_filter($index,static fn($r)=>$r['kind']!=='playlist'),'key'),0,20);
 if (!$sample) throw new RuntimeException('missing_batch_sample');
 $stage='read-only-transaction';
 $db->exec('SET TRANSACTION READ ONLY'); $db->beginTransaction();
 try {
     $stage='ai-preview';
     $ai=ncbai_items($db,$owner,[$sample,['youtubeTitle'],false]);
     $stage='audio-preview';
     $audio=ncb_preview($db,$sample,$owner,true);
     $stage='selection-counts';
     if (array_column($ai,'key')!==$sample || array_column($audio['items'],'key')!==$sample
         || $audio['eligible']+$audio['skipped']+$audio['missing']+$audio['processing']!==count($sample))
         throw new RuntimeException('batch_selection_mismatch');
     $batchCheck=['sample'=>count($sample),'aiEligible'=>count(array_filter($ai,static fn($r)=>$r['status']==='queued')),
         'aiSkipped'=>count(array_filter($ai,static fn($r)=>$r['status']==='skipped')),
         'audio'=>array_intersect_key($audio,array_flip(['eligible','skipped','missing','processing']))];
 } finally { $db->rollBack(); }
 $stage='worker-config';
 $workerConfig=dirname(__DIR__,2).'/noa-ai-lab/gpt-action/state.json';
 $worker=is_file($workerConfig)?json_decode(file_get_contents($workerConfig),true,32,JSON_THROW_ON_ERROR):[];
 $batchCheck['n80Configured']=($worker['owner']??null)===$owner && !empty($worker['workerHash'])
     && (trim((string)getenv('NOA_GITHUB_DISPATCH_TOKEN'))!=='' || !empty($worker['dispatchToken']));
 unset($worker);
 $result=['ok'=>true,'channelOwned'=>true,'counts'=>$counts,'workspace'=>$timings,'batchPreview'=>$batchCheck,'databaseWrites'=>0,'memberRowsChanged'=>0,'pointDebits'=>0];
}catch(Throwable $e){http_response_code(500);$result=['ok'=>false,'error'=>'explorer_audit_failed','class'=>get_class($e),'stage'=>$stage,'sqlstate'=>$e instanceof PDOException ? $e->getCode() : null];}
while(ob_get_level()>$buffer)ob_end_clean();echo json_encode($result,JSON_THROW_ON_ERROR);
