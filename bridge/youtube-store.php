<?php
declare(strict_types=1);
if(!defined('_GNUBOARD_')){http_response_code(403);exit;}
require_once __DIR__.'/catalog-store.php';require_once __DIR__.'/youtube-core.php';
function ny_schema(PDO $db):void{
 $common=' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin';
 foreach([
 'runs'=>'(run_id CHAR(32) PRIMARY KEY,channel_id VARCHAR(64) NOT NULL,catalog_batch CHAR(64) NOT NULL,report LONGTEXT NOT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
 'videos'=>'(run_id CHAR(32) NOT NULL,video_id VARCHAR(32) NOT NULL,payload LONGTEXT NOT NULL,match_json LONGTEXT NOT NULL,PRIMARY KEY(run_id,video_id))',
 'playlists'=>'(run_id CHAR(32) NOT NULL,playlist_id VARCHAR(100) NOT NULL,payload LONGTEXT NOT NULL,PRIMARY KEY(run_id,playlist_id))',
 'items'=>'(run_id CHAR(32) NOT NULL,playlist_id VARCHAR(100) NOT NULL,item_id VARCHAR(100) NOT NULL,position INT NOT NULL,video_id VARCHAR(32) NULL,payload LONGTEXT NOT NULL,PRIMARY KEY(run_id,playlist_id,item_id),KEY ordered_items(run_id,playlist_id,position))',
 'decisions'=>'(decision_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,channel_id VARCHAR(64) NOT NULL,object_type VARCHAR(16) NOT NULL,object_id VARCHAR(100) NOT NULL,entity_id CHAR(64) NULL,classification VARCHAR(24) NOT NULL,actor VARCHAR(20) NOT NULL,reason TEXT NOT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,KEY decision_lookup(channel_id,object_type,object_id,decision_id))',
 'analytics'=>'(run_id CHAR(32) NOT NULL,period_end DATE NOT NULL,payload LONGTEXT NOT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(run_id,period_end))'
 ] as $suffix=>$columns)$db->exec('CREATE TABLE IF NOT EXISTS noa_youtube_'.$suffix.' '.$columns.$common);
}
function ny_batch(PDO $db):string{if(!nc_exists($db,'noa_catalog_batches'))throw new DomainException('catalog_required');$id=$db->query("SELECT batch_id FROM noa_catalog_batches WHERE status='applied' ORDER BY applied_at DESC,batch_id DESC LIMIT 1")->fetchColumn();if(!$id)throw new DomainException('catalog_required');return $id;}
function ny_songs(PDO $db,string $batch):array{$q=$db->prepare("SELECT s.*,v.fields_json,v.review_fields,v.public_verified FROM noa_catalog_songs s JOIN noa_catalog_versions v ON v.entity_id=s.song_id WHERE v.batch_id=? AND v.entity_type='song'");$q->execute([$batch]);$out=[];foreach($q as $s){$s['fields']=json_decode($s['fields_json'],true,512,JSON_THROW_ON_ERROR);$out[$s['song_id']]=$s;}return $out;}
function ny_token(array $state,string $channel):string{$c=$state['channels'][$channel]??null;if(!$c)throw new DomainException('youtube_oauth_required');$secrets=lab_unseal($state['secrets']??null);$tokens=lab_unseal($c['tokens']??null);if(empty($tokens['refresh_token'])||empty($secrets['oauthClientSecret']))throw new DomainException('youtube_oauth_required');$r=lab_https('https://oauth2.googleapis.com/token',[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>http_build_query(['client_id'=>$state['config']['oauthClientId'],'client_secret'=>$secrets['oauthClientSecret'],'refresh_token'=>$tokens['refresh_token'],'grant_type'=>'refresh_token']),CURLOPT_HTTPHEADER=>['Content-Type: application/x-www-form-urlencoded']]);if(empty($r['access_token']))throw new DomainException('youtube_reauthorize_required');return $r['access_token'];}
function ny_get(string $token,string $method,array $query):array{if(!in_array($method,['channels','playlists','playlistItems','videos','analytics'],true))throw new InvalidArgumentException('invalid_method');$root=$method==='analytics'?'https://youtubeanalytics.googleapis.com/v2/reports':'https://www.googleapis.com/youtube/v3/'.$method;$curl=curl_init($root.'?'.http_build_query($query));curl_setopt_array($curl,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_CONNECTTIMEOUT=>3,CURLOPT_TIMEOUT=>8,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,CURLOPT_HTTPHEADER=>['Authorization: Bearer '.$token]]);$raw=curl_exec($curl);$status=(int)curl_getinfo($curl,CURLINFO_RESPONSE_CODE);curl_close($curl);return ny_api_response($raw,$status);}
function ny_sync_step(array &$state,PDO $db,array $body,callable $get):array{
 $run=&$state['youtubeSync'];if(!is_array($run??null)||($run['id']??'')!==($body['id']??''))throw new DomainException('sync_missing');
 if(($body['expectedRevision']??null)!==$run['revision'])return ny_progress($run);if($run['stage']==='done')return ny_progress($run);
 $channel=$run['channel'];$token=null;$call=fn(string $method,array $q)=>$get($method,$q);
 if($run['stage']==='verify'){
  $target=$call('channels',['part'=>'id,snippet,contentDetails','forHandle'=>NY_HANDLE]);$mine=$call('channels',['part'=>'id','mine'=>'true','maxResults'=>50]);$targetId=$target['items'][0]['id']??'';
  if($targetId!==$channel||!in_array($channel,array_column($mine['items']??[],'id'),true))throw new DomainException('target_channel_owner_mismatch');
  $run['channelData']=$target['items'][0];$upload=$target['items'][0]['contentDetails']['relatedPlaylists']['uploads']??'';if(!$upload)throw new DomainException('uploads_playlist_missing');$run['uploads']=$upload;$run['lists'][$upload]=['id'=>$upload,'snippet'=>['title'=>'업로드 전체'],'systemUploads'=>true];$run['stage']='playlists';
 }elseif($run['stage']==='playlists'){
  $r=$call('playlists',['part'=>'id,snippet,status,contentDetails','mine'=>'true','maxResults'=>50,'pageToken'=>$run['pageToken']]);foreach($r['items']??[] as $p)$run['lists'][$p['id']]=$p;
  if(!ny_page($run,'playlists',$r)){$run['queue']=array_keys($run['lists']);$run['listOffset']=0;$run['stage']='items';}
 }elseif($run['stage']==='items'){
  $pid=$run['queue'][$run['listOffset']];$r=$call('playlistItems',['part'=>'id,snippet,contentDetails,status','playlistId'=>$pid,'maxResults'=>50,'pageToken'=>$run['pageToken']]);
  foreach($r['items']??[] as $i){$run['items'][$pid][$i['id']]=$i;$id=$i['contentDetails']['videoId']??$i['snippet']['resourceId']['videoId']??'';if(preg_match('/^[A-Za-z0-9_-]{11}$/D',$id))$run['videoIds'][$id]=true;}
  if(!ny_page($run,'items:'.$pid,$r)){$expected=$run['lists'][$pid]['contentDetails']['itemCount']??null;if($expected!==null&&(int)$expected!==count($run['items'][$pid]??[]))$run['warnings'][]='playlist_count_changed_or_inaccessible:'.$pid;$run['listOffset']++;if($run['listOffset']>=count($run['queue'])){$run['queue']=array_keys($run['videoIds']);$run['videoOffset']=0;$run['stage']='videos';}}
 }elseif($run['stage']==='videos'){
  $ids=array_slice($run['queue'],$run['videoOffset'],50);if($ids){$r=$call('videos',['part'=>'id,snippet,contentDetails,statistics,status','id'=>implode(',',$ids),'maxResults'=>50]);foreach($r['items']??[] as $v){if(($v['snippet']['channelId']??'')===$channel)$run['videos'][$v['id']]=$v;else $run['externalVideos'][$v['id']]=true;}$run['videoOffset']+=count($ids);}
  if($run['videoOffset']>=count($run['queue']))$run['stage']='commit';
 }elseif($run['stage']==='commit'){
  ny_commit($db,$run);$run['stage']='done';unset($run['items'],$run['videos'],$run['lists'],$run['videoIds'],$run['queue'],$run['seenTokens']);
 }else throw new DomainException('invalid_sync_stage');
 $run['revision']++;$run['updatedAt']=gmdate('c');return ny_progress($run);
}
function ny_progress(array $r):array{return array_intersect_key($r,array_flip(['id','channel','stage','revision','pages','listOffset','videoOffset','updatedAt','report','warnings']));}
function ny_commit(PDO $db,array &$run):void{
 ny_schema($db);$q=$db->prepare('SELECT report FROM noa_youtube_runs WHERE run_id=?');$q->execute([$run['id']]);if($saved=$q->fetchColumn()){$run['report']=json_decode($saved,true);return;}
 if(ny_batch($db)!==$run['batch'])throw new DomainException('catalog_changed_start_new_sync');$songs=ny_songs($db,$run['batch']);$matches=[];$matched=0;$added=0;$embeddable=0;
 foreach($run['videos'] as $id=>$v){$m=ny_match($v,$songs);$matches[$id]=$m;if($m['songId']){$matched++;if(empty($songs[$m['songId']]['fields']['youtubeUrl']))$added++;}if(($v['status']['privacyStatus']??'')==='public'&&!empty($v['status']['embeddable']))$embeddable++;}
 $run['report']=['videos'=>count($run['videos']),'playlists'=>count($run['lists'])-1,'matched'=>$matched,'unmatched'=>count($run['videos'])-$matched,'missingUrlLinks'=>$added,'embeddable'=>$embeddable,'playbackVerified'=>0,'pages'=>$run['pages'],'externalPlaylistVideos'=>count($run['externalVideos']??[]),'unavailableVideoIds'=>count($run['videoIds'])-count($run['videos'])-count($run['externalVideos']??[]),'completedAt'=>gmdate('c'),'warnings'=>$run['warnings'],'oauth'=>'owner_verified','analytics'=>'not_fetched'];
 $db->beginTransaction();try{
  $q=$db->prepare('INSERT INTO noa_youtube_runs(run_id,channel_id,catalog_batch,report) VALUES(?,?,?,?)');$q->execute([$run['id'],$run['channel'],$run['batch'],nc_json($run['report'])]);
  $q=$db->prepare('INSERT INTO noa_youtube_videos VALUES(?,?,?,?)');foreach($run['videos'] as $id=>$v)$q->execute([$run['id'],$id,nc_json($v),nc_json($matches[$id])]);
  $q=$db->prepare('INSERT INTO noa_youtube_playlists VALUES(?,?,?)');foreach($run['lists'] as $id=>$p)$q->execute([$run['id'],$id,nc_json($p)]);
  $q=$db->prepare('INSERT INTO noa_youtube_items VALUES(?,?,?,?,?,?)');foreach($run['items'] as $pid=>$items)foreach($items as $i)$q->execute([$run['id'],$pid,$i['id'],(int)($i['snippet']['position']??0),$i['contentDetails']['videoId']??null,nc_json($i)]);
  $db->commit();
 }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
}
function ny_latest(PDO $db):?array{if(!nc_exists($db,'noa_youtube_runs'))return null;$r=$db->query('SELECT * FROM noa_youtube_runs ORDER BY created_at DESC,run_id DESC LIMIT 1')->fetch(PDO::FETCH_ASSOC);return $r?:null;}
function ny_decisions(PDO $db,string $channel):array{if(!nc_exists($db,'noa_youtube_decisions'))return [];$q=$db->prepare('SELECT * FROM noa_youtube_decisions WHERE channel_id=? ORDER BY decision_id');$q->execute([$channel]);$out=[];foreach($q as $d)$out[$d['object_type'].':'.$d['object_id']]=$d;return $out;}
function ny_videos(PDO $db,array $run):array{$q=$db->prepare('SELECT * FROM noa_youtube_videos WHERE run_id=? ORDER BY video_id');$q->execute([$run['run_id']]);$decisions=ny_decisions($db,$run['channel_id']);$out=[];foreach($q as $r){$v=json_decode($r['payload'],true);$v['match']=json_decode($r['match_json'],true);$d=$decisions['video:'.$r['video_id']]??null;if($d){$v['match']['songId']=$d['entity_id'];$v['match']['status']=$d['entity_id']?'approved':'rejected';}$v['classification']=$d['classification']??'music';$out[$v['id']]=$v;}return $out;}
function ny_review(PDO $db,array $body,string $actor):void{
 $run=ny_latest($db);if(!$run)throw new DomainException('sync_required');$type=$body['type']??'';$id=(string)($body['objectId']??'');$entity=$body['entityId']??null;$classification=$body['classification']??'music';$reason=trim((string)($body['reason']??''));if(!in_array($type,['video','playlist'],true)||!in_array($classification,['music','official_mv'],true)||$reason===''||strlen($reason)>2000)throw new InvalidArgumentException('review_reason_required');
 $table=$type==='video'?'videos':'playlists';$column=$type==='video'?'video_id':'playlist_id';$q=$db->prepare('SELECT COUNT(*) FROM noa_youtube_'.$table.' WHERE run_id=? AND '.$column.'=?');$q->execute([$run['run_id'],$id]);if(!$q->fetchColumn())throw new DomainException('unknown_object');
 if($entity!==null){$q=$db->prepare('SELECT COUNT(*) FROM noa_catalog_versions WHERE batch_id=? AND entity_id=? AND entity_type=?');$q->execute([$run['catalog_batch'],$entity,$type==='video'?'song':'playlist']);if(!$q->fetchColumn())throw new DomainException('unknown_entity');}
 $q=$db->prepare('INSERT INTO noa_youtube_decisions(channel_id,object_type,object_id,entity_id,classification,actor,reason) VALUES(?,?,?,?,?,?,?)');$q->execute([$run['channel_id'],$type,$id,$entity,$classification,$actor,$reason]);
}
function ny_analytics(PDO $db,array $run,string $token,?callable $getter=null):array{
 $end=gmdate('Y-m-d',time()-86400);$start=gmdate('Y-m-d',time()-30*86400);$get=$getter??fn($method,$q)=>ny_get($token,$method,$q);$metrics=[];$offset=1;
 do{$r=$get('analytics',['ids'=>'channel=='.$run['channel_id'],'startDate'=>$start,'endDate'=>$end,'dimensions'=>'video','metrics'=>'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained,subscribersLost','maxResults'=>200,'startIndex'=>$offset,'sort'=>'video']);$cols=array_column($r['columnHeaders']??[],'name');foreach($r['rows']??[] as $row){$m=array_combine($cols,$row);$metrics[$m['video']]=$m;}$count=count($r['rows']??[]);$offset+=$count;if($offset>20000)throw new DomainException('analytics_size_limit');}while($count===200);
 $videos=ny_videos($db,$run);$songs=ny_songs($db,$run['catalog_batch']);$ep=[];$bySong=[];foreach($videos as $id=>$v){$sid=$v['match']['songId']??null;if(!$sid||!isset($songs[$sid]))continue;$s=$songs[$sid];$bySong[$sid][]=$id;$key=$s['genre_id'].' · EP.'.$s['ep'].' · '.$s['language'].' · '.$s['version_name'];$ep[$key][]=$id;}
 $act=[];$q=$db->prepare('SELECT DISTINCT a.genre_id,a.act_number,t.song_id FROM noa_catalog_tracks t JOIN noa_catalog_acts a ON a.act_id=t.playlist_id WHERE t.batch_id=?');$q->execute([$run['catalog_batch']]);foreach($q as $t){$key=$t['genre_id'].' · ACT.'.$t['act_number'];foreach($bySong[$t['song_id']]??[] as $id)$act[$key][]=$id;}
 $result=['startDate'=>$start,'endDate'=>$end,'fetchedAt'=>gmdate('c'),'status'=>'connected','videos'=>$metrics,'ep'=>array_map(fn($ids)=>ny_rollup($metrics,$ids),$ep),'act'=>array_map(fn($ids)=>ny_rollup($metrics,$ids),$act),'thumbnailImpressions'=>null,'thumbnailCTR'=>null,'reachStatus'=>'configured_analytics_api_does_not_provide_reach_report'];
 $q=$db->prepare('INSERT INTO noa_youtube_analytics(run_id,period_end,payload) VALUES(?,?,?) ON DUPLICATE KEY UPDATE payload=VALUES(payload),created_at=CURRENT_TIMESTAMP');$q->execute([$run['run_id'],$end,nc_json($result)]);return $result;
}
function ny_song_links(PDO $db,string $song,bool $admin=false):array{
 $run=ny_latest($db);if(!$run)return [];$out=[];foreach(ny_videos($db,$run) as $v)if(($v['match']['songId']??'')===$song&&($admin||($v['status']['privacyStatus']??'')==='public'))$out[]=['id'=>$v['id'],'classification'=>$v['classification']];return $out;
}
