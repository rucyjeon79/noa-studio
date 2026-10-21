<?php
declare(strict_types=1);
if(!defined('_GNUBOARD_')){http_response_code(403);exit;}
require_once __DIR__.'/taxonomy-core.php';require_once __DIR__.'/youtube-store.php';
function nt_ready(PDO $db):bool{return nc_exists($db,'noa_classification_runs')&&nc_exists($db,'noa_content_matches');}
function nt_log(PDO $db,?string $run,string $type,string $id,string $event,array $result,string $actor):void{
 $json=nt_json($result);$hash=hash('sha256',nt_json([$run,$type,$id,$event,$result,$actor]));$q=$db->prepare('INSERT IGNORE INTO noa_classification_logs(run_id,content_type,content_id,event,result,actor,event_hash) VALUES(?,?,?,?,?,?,?)');$q->execute([$run,$type,$id,$event,$json,$actor,$hash]);
}
function nt_defaults():array{
 $rules=[];$add=function($id,$category,$kind,$values,$priority=100)use(&$rules){$rules[]=['rule_id'=>$id,'name'=>$id,'category_id'=>$category,'condition'=>['kind'=>$kind,'values'=>$values],'priority'=>$priority,'enabled'=>1];};
 foreach(['your-story'=>'PLEPMKciKgvch9TGMAcBdKzhVt1QeYsfKB','cover-reborn'=>'PLEPMKciKgvcjGmuO2ZcqrkHGfD5Qbb_Eb']as $g=>$id){$add('owner-list:'.$g,$g,'playlist_id',[$id]);$add('catalog:'.$g,$g,'catalog_genre',[$g]);}
 $add('owner-list-title:stories','your-story','playlist_title',['당신의\s*이야기\s*,\s*우리의\s*음악']);$add('owner-list-title:covers','cover-reborn','playlist_title',['AInoa의\s*유명곡\s*커버']);
 $add('catalog:kpop','original','catalog_genre',['kpop-original']);
 // Existing unified-master §1.B defines these nine as collections of originals.
 $add('catalog:collections','collection','catalog_genre',['joseon-ballad','panpop','echoes-of-joseon','latin-afrobeats-edm','edm-kpop-club','dreamy-deep-house','fantasy-ambient-edm','groovy-airy-pop','narrative-piano-indie']);
 $add('owner-title:kpop','original','playlist_title',['^🎧\s*NOA\s*:\s*Original Songs[「\s]*K-POP','^「Korean POP」$']);
 $add('explicit-title:stories','your-story','video_title',['사연곡']);$add('explicit-title:covers','cover-reborn','video_title',['\bCover\s+by\s+AInoa\b']);
 return $rules;
}
function nt_migrate(PDO $db,string $actor):array{
 if($db->inTransaction())throw new DomainException('migration_outside_transaction_required');
 $definitions=require __DIR__.'/taxonomy-schema.php';$created=[];
 foreach($definitions as $table=>$definition){$exists=nc_exists($db,$table);$db->exec('CREATE TABLE IF NOT EXISTS '.$table.' '.$definition.' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin');
  preg_match_all('/(?:^\(|,)([a-z][a-z0-9_]*)\s+(?:VARCHAR|CHAR|LONGTEXT|INT|TINYINT|TIMESTAMP|BIGINT)/i',$definition,$m);$actual=$db->query('SHOW COLUMNS FROM '.$table)->fetchAll(PDO::FETCH_COLUMN);if(array_diff($m[1],$actual))throw new RuntimeException('existing_taxonomy_schema_conflict:'.$table);if(!$exists)$created[]=$table;
 }
 $db->beginTransaction();try{
  $q=$db->prepare('INSERT IGNORE INTO noa_categories(category_id,parent_id,name,sort_order) VALUES(?,?,?,?)');foreach([['your-story',null,'사연곡',10],['cover-reborn',null,'커버곡',20],['kpop-original',null,'K-POP 원곡',30],['original','kpop-original','오리지널',10],['collection','kpop-original','컬렉션',20]]as $c)$q->execute($c);
  $q=$db->prepare('INSERT IGNORE INTO noa_classification_rules(rule_id,name,category_id,conditions,priority,enabled,updated_by) VALUES(?,?,?,?,?,?,?)');foreach(nt_defaults()as $r)$q->execute([$r['rule_id'],$r['name'],$r['category_id'],nt_json($r['condition']),$r['priority'],$r['enabled'],$actor]);
  $import=nt_import_rules($db,$actor);$db->commit();return ['created'=>$created,'productionRules'=>$import];
 }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
}
function nt_import_rules(PDO $db,string $actor):array{
 $rows=require __DIR__.'/taxonomy-rule-seed.php';
 $prefs=[];
 if(nc_exists($db,'noa_source_files'))foreach($db->query("SELECT source_path,source_bytes,sha256 FROM noa_source_files WHERE source_path LIKE '사용자설정/%'")as $r){if(hash('sha256',$r['source_bytes'])!==$r['sha256'])throw new RuntimeException('source_rule_checksum');if(preg_match('~^사용자설정/(공통|장르/([a-z0-9-]+))[.]json$~u',$r['source_path'],$m)){$genre=$m[2]??null;$prefs[$genre?:'__common']=['body'=>json_decode($r['source_bytes'],true,512,JSON_THROW_ON_ERROR),'path'=>$r['source_path']];}}
 foreach($db->query("SELECT doc_key,payload FROM noa_documents WHERE kind='prefs'")as $r){$key=substr($r['doc_key'],5);if($key!=='__common'&&!preg_match('/^[a-z0-9-]+$/D',$key))continue;$p=json_decode($r['payload'],true,512,JSON_THROW_ON_ERROR);if(!is_array($p))continue;$prefs[$key]=['body'=>array_replace($prefs[$key]['body']??[],$p),'path'=>'mysql:noa_documents/'.$r['doc_key']];}
 // Store only production fields; account/provider settings never enter rule editors.
 $allow=array_flip(['titleFormat','fixRule','descRules','communityRules','thumbImage','thumbFont','thumbDecor','thumbLayout','youtubeSeo','sunoLimit','outputOrder','thumbCastRule','lang','langRule','titleMode','titleModeRule','focus','reality','motion','extra','sunoBase','vocalStyle','musicStyle','rewriteRules','structure','moodLineRule','thumbGenreLine','forbidList','guideText','output','actOutput','lockDescLyrics','lockRule','matchRule','community','descLyrics','actPlaylist']);
 foreach($prefs as $key=>$p){$body=nt_json(array_intersect_key($p['body'],$allow));$rows[]=['rule_id'=>($key==='__common'?'common':'genre:'.$key).':prefs','scope'=>$key==='__common'?'common':'genre','genre_id'=>$key==='__common'?null:$key,'format'=>'json','body'=>$body,'source_path'=>$p['path'],'source_sha256'=>hash('sha256',$body)];}
 $count=0;$skipped=0;$different=[];
 foreach($rows as $r){$sha=hash('sha256',$r['body']);if($sha!==$r['source_sha256'])throw new RuntimeException('rule_seed_checksum');$q=$db->prepare('INSERT IGNORE INTO noa_production_rules(rule_id,scope,genre_id,format,body,sha256,source_path,source_sha256,updated_by) VALUES(?,?,?,?,?,?,?,?,?)');$q->execute([$r['rule_id'],$r['scope'],$r['genre_id'],$r['format'],$r['body'],$sha,$r['source_path'],$r['source_sha256'],$actor]);if($q->rowCount()){$count++;$q=$db->prepare('INSERT INTO noa_production_rule_revisions(rule_id,revision,body,sha256,actor,reason) VALUES(?,1,?,?,?,?)');$q->execute([$r['rule_id'],$r['body'],$sha,$actor,'initial_preserved_import']);}else{$skipped++;$q=$db->prepare('SELECT source_sha256 FROM noa_production_rules WHERE rule_id=?');$q->execute([$r['rule_id']]);if($q->fetchColumn()!==$sha)$different[]=$r['rule_id'];}}
 return ['sourceFiles'=>24,'imported'=>$count,'preservedExisting'=>$skipped,'upstreamDifferentNotOverwritten'=>$different];
}
function nt_rules(PDO $db):array{$out=[];foreach($db->query('SELECT * FROM noa_classification_rules ORDER BY priority,rule_id')as $r){$r['condition']=json_decode($r['conditions'],true,512,JSON_THROW_ON_ERROR);unset($r['conditions']);$out[]=$r;}return $out;}
function nt_categories(PDO $db):array{
 $rows=$db->query('SELECT * FROM noa_categories ORDER BY sort_order,category_id')->fetchAll(PDO::FETCH_ASSOC);$children=[];foreach($rows as $r)$children[$r['parent_id']??''][]=$r;$out=[];$walk=function($parent)use(&$walk,&$out,$children){foreach($children[$parent]??[] as $r){$out[]=$r;$walk($r['category_id']);}};$walk('');if(count($out)!==count($rows))throw new DomainException('invalid_category_tree');return $out;
}
function nt_effective_rules(PDO $db,string $genre):array{
 $out=['common'=>[],'genre'=>[]];$q=$db->prepare('SELECT * FROM noa_production_rules WHERE scope=? OR genre_id=? ORDER BY (format=\'json\'),rule_id');$q->execute(['common',$genre]);
 foreach($q as $r){$scope=$r['scope']==='common'?'common':'genre';if(hash('sha256',$r['body'])!==$r['sha256'])throw new RuntimeException('production_rule_integrity');if($r['format']==='json')$out[$scope]=array_replace($out[$scope],json_decode($r['body'],true,512,JSON_THROW_ON_ERROR));elseif(str_ends_with($r['rule_id'],':suno'))$out[$scope]['sunoBase']=$r['body'];else $out[$scope]['productionGuidelines']=($out[$scope]['productionGuidelines']??'')."\n".$r['body'];}
 return $out;
}
function nt_write_relation(PDO $db,string $type,string $id,array $result,string $actor,string $run):void{
 $q=$db->prepare("SELECT * FROM noa_content_categories WHERE content_type=? AND content_id=? AND source='manual' AND active=1");$q->execute([$type,$id]);if($q->fetch())return;
 $wanted=$result['status']==='classified'?$result['categories']:[];$q=$db->prepare("SELECT category_id,evidence,active FROM noa_content_categories WHERE content_type=? AND content_id=? AND source='auto'");$q->execute([$type,$id]);$old=[];foreach($q as $r)$old[$r['category_id']]=$r;
 foreach($old as $cat=>$r)if($r['active']&&!in_array($cat,$wanted,true)){$q=$db->prepare("UPDATE noa_content_categories SET active=0,revision=revision+1,updated_by=? WHERE content_type=? AND content_id=? AND category_id=? AND source='auto'");$q->execute([$actor,$type,$id,$cat]);nt_log($db,$run,$type,$id,'category_deactivated',['category'=>$cat],$actor);}
 foreach($wanted as $cat){$e=nt_json($result['evidence']);if(isset($old[$cat])&&$old[$cat]['active']&&$old[$cat]['evidence']===$e)continue;$q=$db->prepare("INSERT INTO noa_content_categories(content_type,content_id,category_id,source,evidence,updated_by) VALUES(?,?,?,'auto',?,?) ON DUPLICATE KEY UPDATE active=1,evidence=VALUES(evidence),revision=revision+1,updated_by=VALUES(updated_by)");$q->execute([$type,$id,$cat,$e,$actor]);nt_log($db,$run,$type,$id,'category_assigned',['category'=>$cat,'evidence'=>$result['evidence']],$actor);}
}
function nt_sync(PDO $db,string $actor='automation'):array{
 if(!nt_ready($db))throw new DomainException('taxonomy_install_required');if(!(int)$db->query("SELECT GET_LOCK('noa_taxonomy_writer',0)")->fetchColumn())throw new DomainException('taxonomy_sync_busy');
 try{
  $run=ny_latest($db);if(!$run||$run['channel_id']!==NT_CHANNEL)throw new DomainException('verified_collection_required');$songs=ny_songs($db,ny_batch($db));$videos=ny_videos($db,$run,false);$rules=nt_rules($db);$categories=nt_categories($db);$enabled=array_column(array_filter($categories,fn($c)=>(bool)$c['enabled']),null,'category_id');$rules=array_values(array_filter($rules,fn($r)=>isset($enabled[$r['category_id']])));
  $playlists=[];$membership=[];$q=$db->prepare('SELECT payload FROM noa_youtube_playlists WHERE run_id=?');$q->execute([$run['run_id']]);foreach($q as $r){$p=json_decode($r['payload'],true,512,JSON_THROW_ON_ERROR);if(($p['snippet']['channelId']??'')===NT_CHANNEL&&($p['status']['privacyStatus']??'')==='public'&&empty($p['systemUploads']))$playlists[$p['id']]=$p;}
  $q=$db->prepare('SELECT playlist_id,video_id FROM noa_youtube_items WHERE run_id=? ORDER BY playlist_id,position,item_id');$q->execute([$run['run_id']]);foreach($q as $r)if(isset($playlists[$r['playlist_id']]))$membership[$r['video_id']][$r['playlist_id']]=$playlists[$r['playlist_id']];
  $manual=$db->query("SELECT * FROM noa_content_categories WHERE source='manual' ORDER BY content_type,content_id,category_id")->fetchAll(PDO::FETCH_ASSOC);$matches=$db->query("SELECT * FROM noa_content_matches WHERE source='manual' ORDER BY video_id")->fetchAll(PDO::FETCH_ASSOC);
  $input=hash('sha256',nt_json([$run['run_id'],ny_batch($db),$songs,$videos,$playlists,$membership,$rules,$categories,$manual,$matches]));
  $q=$db->prepare('SELECT result FROM noa_classification_runs WHERE input_hash=?');$q->execute([$input]);if($old=$q->fetchColumn())return json_decode($old,true,512,JSON_THROW_ON_ERROR)+['replayed'=>true];
  $db->beginTransaction();$counts=['unclassifiedReasons'=>[],'classificationReview'=>0,'matchingReview'=>0,'autoPlaylistMatched'=>0,'playlistReview'=>0,'collected'=>count($videos),'songs'=>count($songs),'playlists'=>count($playlists),'classified'=>0,'autoMatched'=>0,'preservedMatches'=>0,'review'=>0,'unclassified'=>0,'errors'=>0,'at'=>gmdate('c'),'runId'=>$run['run_id'],'inputHash'=>$input];
  foreach($songs as $id=>$song){$c=nt_classify([], $song,[],$rules);nt_write_relation($db,'song',$id,$c,$actor,$input);}
  $manualBy=[];foreach($manual as $r)if($r['active'])$manualBy[$r['content_type'].':'.$r['content_id']][]=$r['category_id'];
  $catalogLists=nt_catalog_playlists($db);foreach($catalogLists as $cid=>$catalogList)nt_write_relation($db,'playlist',$cid,nt_classify([],['genre_id'=>$catalogList['genre_id']],[],$rules),$actor,$input);
  foreach($playlists as $id=>$p){$pm=nt_store_playlist_match($db,'playlist',$id,nt_match_playlist($p,$catalogLists));if($pm['status']==='confirmed')$counts['autoPlaylistMatched']++;if($pm['status']==='review')$counts['playlistReview']++;nt_log($db,$input,'playlist',$id,'playlist_matching',$pm,$actor);$c=nt_classify([],null,[$p],$rules);nt_write_relation($db,'playlist',$id,$c,$actor,$input);nt_log($db,$input,'playlist',$id,($pm['status']==='review'||$c['status']==='review')?'review':$c['status'],['classification'=>$c,'playlistMatching'=>$pm],$actor);}
  foreach($videos as $id=>$v){
   $v['_ownerPlaylistIds']=array_keys($membership[$id]??[]);$pm=nt_store_playlist_match($db,'video',$id,nt_match_playlist($v,$catalogLists));if($pm['status']==='confirmed')$counts['autoPlaylistMatched']++;if($pm['status']==='review')$counts['playlistReview']++;
   $sid=$v['match']['songId']??null;$c=nt_classify($v,$songs[$sid??'']??null,array_values($membership[$id]??[]),$rules);
   if($sid&&isset($manualBy['song:'.$sid]))$c=['status'=>'classified','categories'=>$manualBy['song:'.$sid],'evidence'=>[['kind'=>'administrator_song']]];
   if(isset($manualBy['video:'.$id]))$c=['status'=>'classified','categories'=>$manualBy['video:'.$id],'evidence'=>[['kind'=>'administrator']]];
   $m=nt_match($v,$songs,$c);if($c['status']==='unclassified'&&!empty($pm['playlistId'])&&isset($catalogLists[$pm['playlistId']]))$c=nt_classify($v,['genre_id'=>$catalogLists[$pm['playlistId']]['genre_id']],array_values($membership[$id]??[]),$rules);$q=$db->prepare('SELECT * FROM noa_content_matches WHERE video_id=? FOR UPDATE');$q->execute([$id]);$previous=$q->fetch(PDO::FETCH_ASSOC);
   if($previous&&in_array($previous['status'],['confirmed','manual'],true)){
    if(!empty($m['songId'])&&$m['songId']!==$previous['song_id']){$m=['status'=>'review','songId'=>$previous['song_id'],'reason'=>'existing_confirmed_conflict','proposedSongId'=>$m['songId']];}else{$m=['status'=>'preserved','songId'=>$previous['song_id'],'reason'=>'existing_confirmed_link'];}
   }elseif($m['status']==='confirmed'){$q=$db->prepare("INSERT INTO noa_content_matches(video_id,song_id,status,source,evidence,updated_by) VALUES(?,?,'confirmed','auto',?,?) ON DUPLICATE KEY UPDATE song_id=VALUES(song_id),status='confirmed',source='auto',evidence=VALUES(evidence),revision=revision+1,updated_by=VALUES(updated_by)");$q->execute([$id,$m['songId'],nt_json($m),$actor]);$counts['autoMatched']++;}
   if($m['status']==='preserved')$counts['preservedMatches']++;
   if(!empty($m['songId'])&&isset($songs[$m['songId']])&&$c['status']==='unclassified')$c=nt_classify($v,$songs[$m['songId']],array_values($membership[$id]??[]),$rules);
   nt_write_relation($db,'video',$id,$c,$actor,$input);if($c['status']==='unclassified'){$reason=$c['reason']??'no_category_evidence';$counts['unclassifiedReasons'][$reason]=($counts['unclassifiedReasons'][$reason]??0)+1;}if($c['status']==='review')$counts['classificationReview']++;if($m['status']==='review')$counts['matchingReview']++;$counts[$c['status']==='classified'?'classified':($c['status']==='review'?'review':'unclassified')]++;if($m['status']==='review'&&$c['status']!=='review')$counts['review']++;
   nt_log($db,$input,'video',$id,($c['status']==='review'||$m['status']==='review')?'review':'processed',['classification'=>$c,'matching'=>$m,'playlistMatching'=>$pm],$actor);
  }
  $q=$db->prepare('INSERT INTO noa_classification_runs(input_hash,collection_id,catalog_batch,result) VALUES(?,?,?,?)');$q->execute([$input,$run['run_id'],ny_batch($db),nt_json($counts)]);$db->commit();return $counts+['replayed'=>false];
 }catch(Throwable $e){if($db->inTransaction())$db->rollBack();try{nt_log($db,$input??null,'system','synchronization','error',['errorType'=>get_class($e),'code'=>(string)$e->getCode(),'retryRequired'=>true],$actor);}catch(Throwable $auditError){error_log('[noa-taxonomy-audit] '.get_class($auditError));}throw $e;}finally{$db->query("SELECT RELEASE_LOCK('noa_taxonomy_writer')");}
}
/** Overlay only: raw YouTube/catalog decisions remain untouched. */
function nt_overlay(PDO $db,array $videos,array $songs):array{
 if(!nt_ready($db))return $videos;$classificationReady=(bool)$db->query('SELECT COUNT(*) FROM noa_classification_runs')->fetchColumn();
 $matches=[];foreach($db->query("SELECT video_id,song_id FROM noa_content_matches WHERE status IN ('confirmed','manual')")as $m)$matches[$m['video_id']]=$m['song_id'];
 $cats=[];foreach($db->query("SELECT r.content_id,r.category_id,r.source FROM noa_content_categories r JOIN noa_categories c ON c.category_id=r.category_id WHERE r.content_type='video' AND r.active=1 AND c.enabled=1")as $r)$cats[$r['content_id']][]=$r;
 foreach($videos as $id=>&$v){if(empty($v['match']['songId'])&&($v['match']['status']??'')!=='rejected'&&isset($matches[$id],$songs[$matches[$id]]))$v['match']=['status'=>'auto_confirmed','songId'=>$matches[$id],'source'=>'sql_multiple_evidence'];$v['sqlClassificationReady']=$classificationReady;$v['sqlCategories']=array_column($cats[$id]??[],'category_id');$v['sqlCategorySource']=in_array('manual',array_column($cats[$id]??[],'source'),true)?'manual':'auto';}unset($v);return $videos;
}
function nt_counts(PDO $db):array{
 $cats=nt_categories($db);$map=array_column($cats,null,'category_id');$members=[];
 foreach($db->query("SELECT content_id,category_id FROM noa_content_categories WHERE content_type='song' AND active=1") as $r){$cat=$r['category_id'];while($cat!==null&&isset($map[$cat])){$members[$cat][$r['content_id']]=true;$cat=$map[$cat]['parent_id'];}}
 return array_map(fn($c)=>['id'=>$c['category_id'],'parent'=>$c['parent_id'],'name'=>$c['name'],'songs'=>count($members[$c['category_id']]??[])],$cats);
}
function nt_annotate_records(PDO $db,array $rows):array{
 if(!nt_ready($db))return $rows;$batch=ny_batch($db);$q=$db->prepare('SELECT alias_key,entity_id FROM noa_catalog_aliases WHERE batch_id=?');$q->execute([$batch]);$aliases=[];foreach($q as $r)$aliases[$r['alias_key']][$r['entity_id']]=true;
 $cats=[];foreach($db->query('SELECT content_type,content_id,category_id FROM noa_content_categories WHERE active=1')as $r)$cats[$r['content_type'].':'.$r['content_id']][]=$r['category_id'];$songs=ny_songs($db,$batch);
 foreach($rows as &$r){$ids=array_keys($aliases[$r['key']]??[]);$sid=count($ids)===1?$ids[0]:($r['catalogId']??null);$song=$songs[$sid??'']??null;$r['catalogSongId']=$song?$sid:null;$r['categories']=$cats[($r['kind']==='playlist'?'playlist:':'song:').($sid??'')]??[];$r['language']=$song['language']??'und';$r['version']=$song['version_name']??'';}unset($r);return $rows;
}
function nt_public_data(PDO $db):array{
 if(!nt_ready($db))return ['ok'=>true,'installed'=>false,'categories'=>[],'videos'=>[]];$run=ny_latest($db);$songs=ny_songs($db,ny_batch($db));$videos=$run?ny_videos($db,$run):[];$out=[];$playlistMatches=[];foreach($db->query("SELECT m.content_id,a.act_number,a.genre_id FROM noa_playlist_matches m JOIN noa_catalog_acts a ON a.act_id=m.catalog_playlist_id WHERE m.content_type='video' AND m.status='confirmed'")as $p)$playlistMatches[$p['content_id']]=$p;
 foreach($videos as $id=>$v){if(($v['snippet']['channelId']??'')!==NT_CHANNEL||($v['status']['privacyStatus']??'')!=='public'||empty($v['status']['embeddable']))continue;$sid=$v['match']['songId']??null;$s=$songs[$sid??'']??null;$out[]=['id'=>$id,'title'=>(string)($v['snippet']['title']??''),'categories'=>$v['sqlCategories']??[],'songId'=>$s?$sid:null,'matched'=>!empty($sid),'genre'=>$s['genre_id']??'unclassified','language'=>$s['language']??nt_language((string)($v['snippet']['title']??'')),'version'=>$s['version_name']??null,'ep'=>$s['ep']??nt_ep((string)($v['snippet']['title']??'')),'act'=>$playlistMatches[$id]['act_number']??(!empty($s['ep'])?(int)ceil((int)$s['ep']/10):null),'thumbnail'=>'/noa-bridge/youtube-thumbnail.php?id='.$id,'href'=>'/noa-youtube.php?track='.rawurlencode($id).'&play=1'];}
 return ['ok'=>true,'installed'=>true,'categories'=>array_values(array_filter(nt_categories($db),fn($c)=>(bool)$c['enabled'])),'videos'=>$out];
}

function nt_catalog_playlists(PDO $db):array{
 $q=$db->prepare("SELECT p.*,a.genre_id,a.act_number FROM noa_catalog_playlists p JOIN noa_catalog_acts a ON a.act_id=p.playlist_id JOIN noa_catalog_versions v ON v.entity_id=p.playlist_id AND v.entity_type='playlist' WHERE v.batch_id=? AND p.owner_id IS NULL");$q->execute([ny_batch($db)]);return array_column($q->fetchAll(PDO::FETCH_ASSOC),null,'playlist_id');
}
function nt_store_playlist_match(PDO $db,string $type,string $id,array $match):array{
 $q=$db->prepare('SELECT * FROM noa_playlist_matches WHERE content_type=? AND content_id=? FOR UPDATE');$q->execute([$type,$id]);$old=$q->fetch(PDO::FETCH_ASSOC);if($old){if(!empty($match['playlistId'])&&$old['catalog_playlist_id']!==$match['playlistId'])return ['status'=>'review','reason'=>'existing_playlist_conflict','playlistId'=>$old['catalog_playlist_id'],'proposed'=>$match['playlistId']];return ['status'=>'preserved','playlistId'=>$old['catalog_playlist_id']];}
 if($match['status']==='confirmed'){$q=$db->prepare("INSERT INTO noa_playlist_matches(content_type,content_id,catalog_playlist_id,status,source,evidence) VALUES(?,?,?,'confirmed','auto',?)");$q->execute([$type,$id,$match['playlistId'],nt_json($match)]);}return $match;
}
