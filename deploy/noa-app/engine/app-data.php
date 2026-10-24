<?php
declare(strict_types=1);
/** Single SELECT-only data contract across existing app stores; no schema helpers. */
function n80_app_phase(string $phase): void {$GLOBALS['n80_app_phase']=$phase;}
function n80_app_schema(PDO $db): array {
    n80_app_phase('schema');
    $out=[];
    if($db->getAttribute(PDO::ATTR_DRIVER_NAME)==='sqlite'){
        foreach($db->query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'") as $r){
            $name=$r['name'];if(!preg_match('/^[A-Za-z0-9_]+$/D',$name))continue;
            $out[$name]=array_column($db->query('PRAGMA table_info(`'.$name.'`)')->fetchAll(PDO::FETCH_ASSOC),'name');
        }
    }else{
        foreach($db->query("SELECT c.TABLE_NAME,c.COLUMN_NAME FROM information_schema.COLUMNS c JOIN information_schema.TABLES t ON t.TABLE_SCHEMA=c.TABLE_SCHEMA AND t.TABLE_NAME=c.TABLE_NAME WHERE c.TABLE_SCHEMA=DATABASE() AND t.TABLE_TYPE='BASE TABLE' ORDER BY c.TABLE_NAME,c.ORDINAL_POSITION") as $r){
            if(!preg_match('/^[A-Za-z0-9_]+$/D',$r['TABLE_NAME']))throw new RuntimeException('unsupported_table_identifier');
            $out[$r['TABLE_NAME']][]=$r['COLUMN_NAME'];
        }
    }
    return $out;
}
function n80_app_has(array $schema,string $table,array $columns=[]): bool {
    return isset($schema[$table])&&!array_diff($columns,$schema[$table]);
}
/** Normalize legacy documents and recovered catalog keys without copying data. */
function n80_app_references(PDO $db,array $schema): array {
    $refs=[];
    if(n80_app_has($schema,'noa_documents',['doc_key','kind']))
        foreach($db->query("SELECT doc_key,kind FROM noa_documents WHERE kind IN ('single','playlist','story','jukebox_qa')") as $r)$refs[$r['doc_key']]='document';
    $batch=null;
    if(n80_app_has($schema,'noa_catalog_batches',['batch_id','status','applied_at']))
        $batch=$db->query("SELECT batch_id FROM noa_catalog_batches WHERE status='applied' ORDER BY applied_at DESC,batch_id DESC LIMIT 1")->fetchColumn()?:null;
    if($batch&&n80_app_has($schema,'noa_catalog_versions',['batch_id','entity_id','entity_type'])&&n80_app_has($schema,'noa_catalog_songs',['song_id'])){
        $q=$db->prepare("SELECT s.song_id FROM noa_catalog_songs s JOIN noa_catalog_versions v ON v.entity_id=s.song_id AND v.entity_type='song' WHERE v.batch_id=?");$q->execute([$batch]);
        foreach($q as $r)$refs['catalog:'.$r['song_id']]='catalog';
    }
    return ['keys'=>$refs,'currentBatch'=>$batch];
}
function n80_app_audit(PDO $db,string $root,string $memberTable): array {
    $schema=n80_app_schema($db);$tables=[];$issues=[];$checks=[];
    foreach($schema as $name=>$columns){
        n80_app_phase('table_count:'.$name);
        try{$tables[$name]=['rows'=>(int)$db->query('SELECT COUNT(*) FROM `'.$name.'`')->fetchColumn(),'columns'=>count($columns),'state'=>'verified'];}
        catch(PDOException $e){$tables[$name]=['state'=>'unreadable'];$issues[]=['code'=>'table_unreadable','severity'=>'error','table'=>$name];}
    }
    $groups=[
      'music'=>['noa_documents','noa_catalog_batches','noa_catalog_songs','noa_catalog_acts','noa_catalog_playlists','noa_catalog_versions','noa_catalog_tracks'],
      'jukebox'=>['noa_jukebox_assets','noa_jukebox_uploads','noa_jukebox_audio_jobs'],
      'playlist'=>['noa_user_playlists','noa_documents'],
      'youtube'=>['noa_youtube_runs','noa_youtube_videos','noa_youtube_playlists','noa_youtube_items'],
      'world'=>['noa_youtube_runs','noa_youtube_playlists','noa_youtube_items'],
      'taxonomy'=>['noa_categories','noa_content_categories','noa_content_matches','noa_playlist_matches'],
      'ranking'=>['noa_ranking_runs','noa_ranking_rows','noa_play_sessions','noa_valid_plays'],
      'members'=>[$memberTable],
      'settings'=>['noa_documents'],
      'community'=>[substr($memberTable,0,-6).'board',substr($memberTable,0,-6).'board_file'],
    ];$modules=[];
    foreach($groups as $id=>$required){$missing=array_values(array_diff($required,array_keys($schema)));$modules[$id]=['state'=>$missing?'missing_schema':'connected','tables'=>$required,'missingTables'=>$missing];if($missing)$issues[]=['code'=>'module_schema_missing','severity'=>'error','module'=>$id];}
    n80_app_phase('catalog_references');
    $refs=n80_app_references($db,$schema);$keys=$refs['keys'];
    foreach(['noa_jukebox_assets'=>'song_key','noa_jukebox_uploads'=>'song_key'] as $table=>$column){
        if(!n80_app_has($schema,$table,[$column]))continue;$missing=0;$recovered=0;$qa=0;
        foreach($db->query('SELECT DISTINCT `'.$column.'` k FROM `'.$table.'`') as $r){$key=$r['k'];if(str_starts_with($key,'jukebox:qa:')){$qa++;continue;}if(!isset($keys[$key]))$missing++;elseif($keys[$key]==='catalog')$recovered++;}
        $checks[$table.'_references']=['missing'=>$missing,'recoveredCatalogKeys'=>$recovered,'syntheticQaPreserved'=>$qa];
        if($missing)$issues[]=['code'=>'unresolved_music_reference','severity'=>'error','table'=>$table,'count'=>$missing];
    }
    $relations=[
      ['job_upload','noa_jukebox_audio_jobs','upload_id','noa_jukebox_uploads','id'],
      ['track_playlist','noa_catalog_tracks','playlist_id','noa_catalog_playlists','playlist_id'],
      ['track_song','noa_catalog_tracks','song_id','noa_catalog_songs','song_id'],
      ['playlist_act','noa_catalog_playlists','act_id','noa_catalog_acts','act_id'],
      ['video_run','noa_youtube_videos','run_id','noa_youtube_runs','run_id'],
      ['youtube_playlist_run','noa_youtube_playlists','run_id','noa_youtube_runs','run_id'],
      ['ranking_run','noa_ranking_rows','hour_utc','noa_ranking_runs','hour_utc'],
      ['category_parent','noa_categories','parent_id','noa_categories','category_id'],
      ['category_assignment','noa_content_categories','category_id','noa_categories','category_id'],
      ['user_playlist_owner','noa_user_playlists','owner_id',$memberTable,'mb_id'],
    ];
    foreach($relations as [$id,$child,$fk,$parent,$pk]){
        n80_app_phase('relation:'.$id);
        if(!n80_app_has($schema,$child,[$fk])||!n80_app_has($schema,$parent,[$pk])){$checks[$id]=['state'=>'not_checked','reason'=>'missing_schema'];continue;}
        $sql='SELECT COUNT(*) FROM `'.$child.'` c LEFT JOIN `'.$parent.'` p ON p.`'.$pk.'`=c.`'.$fk.'` WHERE c.`'.$fk.'` IS NOT NULL AND p.`'.$pk.'` IS NULL';
        $n=(int)$db->query($sql)->fetchColumn();$checks[$id]=['state'=>'verified','orphanRows'=>$n];
        if($n)$issues[]=['code'=>'orphan_reference','severity'=>$id==='user_playlist_owner'?'warning':'error','relation'=>$id,'count'=>$n];
    }
    n80_app_phase('playlist_tracks');
    if(n80_app_has($schema,'noa_user_playlists',['tracks'])){
        $missing=0;$invalid=0;$total=0;
        foreach($db->query('SELECT tracks FROM noa_user_playlists') as $r){$tracks=json_decode($r['tracks'],true);if(!is_array($tracks)||!array_is_list($tracks)){$invalid++;continue;}foreach($tracks as $key){$total++;if(!is_string($key)||!isset($keys[$key]))$missing++;}}
        $checks['playlist_tracks']=['references'=>$total,'unresolved'=>$missing,'invalidJson'=>$invalid];if($missing||$invalid)$issues[]=['code'=>'playlist_track_integrity','severity'=>'error','count'=>$missing+$invalid];
    }
    foreach(['noa_documents'=>['payload'],'noa_catalog_versions'=>['fields_json'],'noa_youtube_videos'=>['payload','match_json'],'noa_youtube_playlists'=>['payload']] as $table=>$columns){
        n80_app_phase('json:'.$table);
        foreach($columns as $column)if(n80_app_has($schema,$table,[$column])){
            $n=(int)$db->query('SELECT COUNT(*) FROM `'.$table.'` WHERE `'.$column.'` IS NULL OR JSON_VALID(`'.$column.'`)=0')->fetchColumn();
            $checks[$table.'.'.$column]=['invalidJson'=>$n];if($n)$issues[]=['code'=>'invalid_json','severity'=>'error','table'=>$table,'column'=>$column,'count'=>$n];
        }
    }
    n80_app_phase('module_summaries');
    if(n80_app_has($schema,'noa_jukebox_audio_jobs',['status'])){$counts=[];foreach($db->query('SELECT status,COUNT(*) n FROM noa_jukebox_audio_jobs GROUP BY status') as $r)$counts[$r['status']]=(int)$r['n'];$modules['jukebox']['jobStates']=$counts;}
    if(n80_app_has($schema,'noa_youtube_runs',['created_at','run_id'])){
        $latest=$db->query('SELECT run_id,created_at FROM noa_youtube_runs ORDER BY created_at DESC,run_id DESC LIMIT 1')->fetch(PDO::FETCH_ASSOC);$modules['youtube']['latestCollection']=$latest?:null;
        if(!$latest)$issues[]=['code'=>'youtube_collection_missing','severity'=>'error'];
    }
    if(n80_app_has($schema,'noa_youtube_playlists',['playlist_id'])){$n=(int)$db->query("SELECT COUNT(*) FROM noa_youtube_playlists WHERE playlist_id='PLEPMKciKgvchOwm5hQfGAP2jDQloI2RVY'")->fetchColumn();$modules['world']['officialPlaylistCollected']=$n>0;if(!$n)$issues[]=['code'=>'world_official_playlist_missing','severity'=>'error'];}
    if(n80_app_has($schema,'noa_ranking_runs',['hour_utc','status'])){$latest=$db->query("SELECT hour_utc FROM noa_ranking_runs WHERE status='published' ORDER BY hour_utc DESC LIMIT 1")->fetchColumn();$modules['ranking']['latestPublishedHourUtc']=$latest?:null;if(!$latest)$issues[]=['code'=>'ranking_snapshot_missing','severity'=>'warning'];}
    $modules['home']=['state'=>'connected','dataSources'=>['youtube','music','ranking']];
    $modules['admin']=['state'=>'connected','dataSources'=>['settings','members','database']];
    $modules['database']=['state'=>'connected','tablesDiscovered'=>count($schema),'tablesVerified'=>count(array_filter($tables,fn($r)=>$r['state']==='verified'))];
    return ['engine'=>'N80 ENGINE','contract'=>'app_data_v1','checkedAt'=>gmdate('c'),'modules'=>$modules,'tables'=>$tables,'checks'=>$checks,'issues'=>$issues,'referenceSources'=>['documents'=>count(array_filter($keys,fn($s)=>$s==='document')),'recoveredCatalog'=>count(array_filter($keys,fn($s)=>$s==='catalog'))],'currentCatalogBatch'=>$refs['currentBatch'],'integrityOk'=>!array_filter($issues,fn($i)=>$i['severity']==='error'),'databaseWrites'=>0,'businessDispatch'=>false];
}
/** Read private AI state once; never decrypt or expose credentials, prompts or jobs. */
function n80_app_ai_summary(string $path): array {
    if(!is_file($path)||is_link($path)||filesize($path)>16777216)return ['state'=>'unavailable'];
    $state=json_decode((string)file_get_contents($path),true);
    if(!is_array($state))return ['state'=>'invalid_json'];
    $counts=[];foreach($state['jobs']??[] as $j){$status=(string)($j['state']??'unknown');$counts[$status]=($counts[$status]??0)+1;}
    return ['state'=>'connected','revision'=>(int)($state['revision']??0),'jobStates'=>$counts,'channels'=>count($state['channels']??[]),'workerEnabled'=>(bool)($state['config']['workerEnabled']??false),'generationEnabled'=>(bool)($state['config']['generationEnabled']??false),'textEnabled'=>(bool)($state['config']['textEnabled']??false),'lastWorkerAt'=>$state['worker']['at']??null];
}
/** Verify every registered file in bounded, canonical service directories. */
function n80_app_media(PDO $db,array $schema,string $root): array {
    n80_app_phase('media');
    if(!n80_app_has($schema,'noa_jukebox_assets',['song_key','audio_path','audio_bytes','audio_sha256','cover_path','cover_bytes','cover_sha256']))return ['state'=>'missing_schema'];
    $bases=[realpath(dirname($root).'/noa-jukebox-private/media'),realpath($root.'/noa-jukebox')];
    $out=['state'=>'verified','audio'=>0,'covers'=>0,'audioBytes'=>0,'invalidAudio'=>0,'invalidCovers'=>0,'syntheticQaPreserved'=>0];
    $q=$db->query('SELECT song_key,audio_path,audio_bytes,audio_sha256,cover_path,cover_bytes,cover_sha256 FROM noa_jukebox_assets');
    foreach($q as $r){$qa=str_starts_with($r['song_key'],'jukebox:qa:');if($qa)$out['syntheticQaPreserved']++;
        foreach(['audio','cover'] as $type){$rel=(string)($r[$type.'_path']??'');if($rel==='')continue;$valid=false;
            if(!str_contains($rel,"\0")&&!str_contains($rel,'\\')&&!str_starts_with($rel,'/')&&!preg_match('~(?:^|/)\.{1,2}(?:/|$)~',$rel)){
                foreach($bases as $base){if(!$base)continue;$path=realpath($base.'/'.$rel);
                    if($path&&str_starts_with($path,$base.'/')&&is_file($path)&&is_readable($path)&&filesize($path)===(int)$r[$type.'_bytes']&&preg_match('/^[a-f0-9]{64}$/D',(string)$r[$type.'_sha256'])&&hash_equals($r[$type.'_sha256'],hash_file('sha256',$path))){$valid=$type==='audio'||getimagesize($path)!==false;if($valid)break;}
                }
            }
            if($qa)continue;
            if($valid){$out[$type==='audio'?'audio':'covers']++;if($type==='audio')$out['audioBytes']+=(int)$r['audio_bytes'];}
            else $out[$type==='audio'?'invalidAudio':'invalidCovers']++;
        }
    }
    return $out;
}
