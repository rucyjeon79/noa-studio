<?php
declare(strict_types=1);
/** Field-presence inventory only. No repair is inferred from a guessed alias. */
function np0_paths():array{return [
 'title'=>['body.displayTitle','body.confirmedTitle','title'],'ep'=>['ep'],'act'=>['act'],'genre'=>['genreId'],
 'vocal'=>['body.vocalInfo','body.vocal','body.sourceVocal','body.thumbCast'],'originalArtist'=>['body.originalArtist','body.originalSinger','body.coverArtist'],
 'lyrics'=>['body.lyricsBlock','body.lyrics','lyrics'],'lyricsTranslation'=>['body.lyricsTranslation','body.translatedLyrics','body.translation','body.translationBlock'],
 'songDescription'=>['body.songDescription','body.descriptionBlock','body.description'],'sunoStyle'=>['body.sunoStyle','body.sunoPrompt','body.stylePrompt'],
 'productionPrompt'=>['body.productionPrompt','body.creationPrompt','body.prompt'],'imagePrompt'=>['body.geminiPrompt','body.imagePrompt','body.thumbnailPrompt'],
 'characterPrompt'=>['body.characterPrompt','body.characterFixedPrompt','body.characterPromptBlock'],'sunoUrl'=>['body.sunoShareUrl','body.sunoUrl'],
 'youtubeUrl'=>['body.youtubeUrl'],'youtubeTitle'=>['body.youtubeTitle'],'youtubeDescription'=>['body.youtubeDescription'],
 'communityPost'=>['body.communityPost','body.fanLetter'],'cardImage'=>['body.cardImageLocation','body.coverImageUrl','body.thumbUrl'],
 'mp3'=>['body.audioFileLocation','body.audioUrl'],'playlistMembership'=>['body.members'],'sortOrder'=>['order','sortOrder','body.sortOrder']];}
function np0_at(array $d,string $path):mixed{foreach(explode('.',$path)as $part){if(!is_array($d)||!array_key_exists($part,$d))return null;$d=$d[$part];}return $d;}
function np0_present(mixed $v):bool{return is_string($v)?trim($v)!=='':($v!==null&&$v!==[]&&$v!==false);}
function np0_digest(mixed $v):string{return hash('sha256',json_encode($v,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR));}
function np0_inventory(PDO $db):array{
 $tables=$db->query("SELECT TABLE_NAME,ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('noa_documents','noa_document_history','noa_catalog_sources','noa_source_files','noa_catalog_versions','noa_catalog_tracks','noa_jukebox_uploads','noa_jukebox_audio_jobs')")->fetchAll(PDO::FETCH_KEY_PAIR);
 $db->exec('SET TRANSACTION READ ONLY');$db->beginTransaction();
 try{
  $docs=$db->query("SELECT doc_key,kind,payload,revision,updated_by FROM noa_documents WHERE kind IN ('single','story','playlist') ORDER BY doc_key")->fetchAll(PDO::FETCH_ASSOC);
  $batch=$db->query("SELECT batch_id FROM noa_catalog_batches WHERE status='applied' ORDER BY applied_at DESC,batch_id DESC LIMIT 1")->fetchColumn();
  $q=$db->prepare('SELECT entity_id,fields_json,review_fields,fields_sha FROM noa_catalog_versions WHERE batch_id=?');$q->execute([$batch]);$catalog=[];foreach($q as $r)$catalog[$r['entity_id']]=['fields'=>json_decode($r['fields_json'],true),'review'=>json_decode($r['review_fields'],true),'sha'=>$r['fields_sha']];
  $q=$db->prepare('SELECT alias_key,entity_id FROM noa_catalog_aliases WHERE batch_id=?');$q->execute([$batch]);$aliases=[];foreach($q as $r)$aliases[$r['alias_key']][]=$r['entity_id'];
  $history=$db->query('SELECT doc_key,COUNT(*) n,MAX(revision) last_revision FROM noa_document_history GROUP BY doc_key')->fetchAll(PDO::FETCH_UNIQUE|PDO::FETCH_ASSOC);
  $q=$db->prepare('SELECT song_id,COUNT(*) n FROM noa_catalog_tracks WHERE batch_id=? GROUP BY song_id');$q->execute([$batch]);$tracks=$q->fetchAll(PDO::FETCH_KEY_PAIR);
  $assetRows=$db->query('SELECT song_key,audio_path,cover_path,status FROM noa_jukebox_assets')->fetchAll(PDO::FETCH_UNIQUE|PDO::FETCH_ASSOC);
  $paths=np0_paths();$stats=[];foreach($paths as $field=>$unused)$stats[$field]=['present'=>0,'missing'=>0,'blankPrimary'=>0,'alternatePresent'=>0,'catalogDifferent'=>0,'notApplicable'=>0];$rows=[];$bodyKeys=[];$docHash=hash_init('sha256');$kinds=[];
  foreach($docs as $r){hash_update($docHash,json_encode(array_values($r),JSON_UNESCAPED_UNICODE));$d=json_decode($r['payload'],true,512,JSON_THROW_ON_ERROR);$kind=$r['kind'];$kinds[$kind]=($kinds[$kind]??0)+1;$b=$d['body']??[];foreach($b as $k=>$v)if(np0_present($v))$bodyKeys[$k]=($bodyKeys[$k]??0)+1;
   $ids=$aliases[$r['doc_key']]??(str_starts_with($r['doc_key'],'catalog:')?[substr($r['doc_key'],8)]:[]);$ids=array_values(array_unique($ids));$cat=count($ids)===1?($catalog[$ids[0]]??null):null;
   $row=['key'=>$r['doc_key'],'kind'=>$kind,'revision'=>(int)$r['revision'],'sourcePath'=>$d['sourcePath']??null,'packageType'=>nup_type($d,$kind),'catalogIdentity'=>count($ids)===1?$ids[0]:null,'ambiguousIdentity'=>count($ids)>1,'missing'=>[],'blankPrimary'=>[],'alternatePresent'=>[],'catalogDifferent'=>[],'historyRows'=>(int)($history[$r['doc_key']]['n']??0),'historyRevision'=>(int)($history[$r['doc_key']]['last_revision']??0)];
   foreach($paths as $field=>$candidates){
    $na=($field==='originalArtist'&&($d['genreId']??'')!=='cover-reborn')||($kind==='playlist'&&in_array($field,['lyrics','lyricsTranslation','sunoStyle','productionPrompt','vocal'],true));
    if($na){$stats[$field]['notApplicable']++;continue;}
    $values=[];foreach($candidates as $path){$v=np0_at($d,$path);if(np0_present($v))$values[$path]=$v;}
    $linked=$field==='playlistMembership'&&!empty($ids[0])&&!empty($tracks[$ids[0]]);
    $asset=$assetRows[$r['doc_key']]??[];if($field==='mp3'&&($asset['status']??'')==='ready'&&!empty($asset['audio_path']))$linked=true;if($field==='cardImage'&&!empty($asset['cover_path']))$linked=true;
    if(!$values&&!$linked){$stats[$field]['missing']++;$row['missing'][]=$field;}else $stats[$field]['present']++;
    $first=np0_at($d,$candidates[0]);if($first!==null&&!np0_present($first)){$stats[$field]['blankPrimary']++;$row['blankPrimary'][]=$field;}
    if(!np0_present($first)&&$values){$stats[$field]['alternatePresent']++;$row['alternatePresent'][$field]=array_keys($values);}
    if($cat&&$values){$cv=[];foreach($candidates as $path){$name=preg_replace('/^body\./','',$path);if(np0_present($cat['fields'][$name]??null))$cv[]=np0_digest($cat['fields'][$name]);}if($cv&&!array_intersect($cv,array_map('np0_digest',array_values($values)))){$stats[$field]['catalogDifferent']++;$row['catalogDifferent'][]=$field;}}
   }$rows[]=$row;
  }
  arsort($bodyKeys);$sourcePaths=[];$sourceCounts=[];
  if(isset($tables['noa_source_files']))foreach($db->query('SELECT source_path,sha256,source_bytes FROM noa_source_files ORDER BY source_path')as $r){if(hash('sha256',$r['source_bytes'])!==$r['sha256'])throw new RuntimeException('archived_source_checksum');$sourcePaths[]=['path'=>$r['source_path'],'sha256'=>$r['sha256'],'bytes'=>strlen($r['source_bytes'])];$v=json_decode($r['source_bytes'],true);$fields=is_array($v)?($v['body']??$v['pkg']??[]):[];if(is_array($fields))foreach($fields as $k=>$value)if(np0_present($value))$sourceCounts[$k]=($sourceCounts[$k]??0)+1;}
  $result=['checkedAt'=>gmdate('c'),'documents'=>count($docs),'kinds'=>$kinds,'documentFingerprint'=>hash_final($docHash),'tableEngines'=>$tables,'catalogBatch'=>$batch,'catalogRecords'=>count($catalog),'fieldStats'=>$stats,'documentBodyFields'=>$bodyKeys,'archivedSourceFields'=>$sourceCounts,'archivedSources'=>$sourcePaths,'rows'=>$rows,'databaseWrites'=>0,'restoredFields'=>0];
  $db->commit();return $result;
 }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
}
