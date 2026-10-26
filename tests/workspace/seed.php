<?php
declare(strict_types=1);define('_GNUBOARD_',true);
if(!str_contains((string)getenv('NOA_MYSQL_DSN'),'dbname=noa_workspace_test;'))throw new RuntimeException('isolated_database_required');
require __DIR__.'/../../bridge/storage.php';require __DIR__.'/../../bridge/catalog-store.php';require __DIR__.'/../../bridge/youtube-store.php';require __DIR__.'/../../bridge/package-record.php';
$db=noa_bridge_pdo();
$db->exec('CREATE TABLE noa_documents(doc_key VARCHAR(191) PRIMARY KEY,kind VARCHAR(32),payload LONGTEXT,revision BIGINT,updated_by VARCHAR(20),updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB');
$db->exec('CREATE TABLE noa_document_history(doc_key VARCHAR(191),revision BIGINT,payload LONGTEXT,changed_by VARCHAR(20),PRIMARY KEY(doc_key,revision)) ENGINE=InnoDB');
$db->exec('CREATE TABLE noa_request_log(request_id CHAR(36) PRIMARY KEY,doc_key VARCHAR(191),request_hash CHAR(64),revision BIGINT) ENGINE=InnoDB');nc_schema($db);ny_schema($db);
$batch=str_repeat('f',64);nc_insert($db,'noa_catalog_batches',['batch_id'=>$batch,'status'=>'applied','report'=>'{}','source_guard'=>str_repeat('0',64),'created_by'=>'fixture'],['batch_id']);$db->exec('UPDATE noa_catalog_batches SET applied_at=CURRENT_TIMESTAMP');
foreach([['a','story:test','your-story','검색 검증곡'],['b','single:test','kpop-original','EP 검증곡'],['c','story:private','cover-reborn','비공개 검증곡']] as [$letter,$key,$genre,$title]){
 $id=str_repeat($letter,64);$ep=$letter==='b'?'02':'';$body=['confirmedTitle'=>$title,'lyricsBlock'=>"[Verse]\n보존할 원문 가사",'songDescription'=>'기존 소개','youtubeUrl'=>'https://www.youtube.com/watch?v='.($letter==='a'?'abcdefghijk':($letter==='b'?'lmnopqrstuv':'ZYXWVUTSRQP')),'customSource'=>['preserve'=>true]];
 nc_insert($db,'noa_catalog_songs',['song_id'=>$id,'identity_json'=>'[]','genre_id'=>$genre,'language'=>'ko','version_name'=>'original','ep'=>$ep],['song_id']);
 nc_insert($db,'noa_catalog_versions',['batch_id'=>$batch,'entity_id'=>$id,'entity_type'=>'song','fields_json'=>json_encode(['title'=>'예전 제목']+$body),'fields_sha'=>str_repeat('0',64),'review_fields'=>'[]','public_verified'=>1],['batch_id','entity_id']);
 nc_insert($db,'noa_catalog_aliases',['batch_id'=>$batch,'alias_key'=>$key,'entity_id'=>$id],['batch_id','alias_key','entity_id']);
 $d=nup_normalize(['title'=>$title,'genreId'=>$genre,'ep'=>$ep,'visibility'=>$letter==='c'?'private':'public','body'=>$body],'single');$db->beginTransaction();nup_store($db,$key,'single',$d,0,'fixture');$db->commit();
}
echo "WORKSPACE_DISPOSABLE_MYSQL_READY\n";
