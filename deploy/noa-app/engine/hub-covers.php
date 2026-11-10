<?php
declare(strict_types=1);
/** N80 Hub schedules the existing Suno artwork and JukeBox publication services. */
function n80_hub_cover_identity(array $row):string{return hash('sha256',$row['key'].'|'.$row['sunoUrl']);}
function n80_hub_cover_retry(array &$state,array $row,int $now):void{
 $id=n80_hub_cover_identity($row);$attempt=min(10,1+(int)($state[$id]['attempts']??0));
 $state[$id]=['attempts'=>$attempt,'next'=>$now+min(86400,900*2**($attempt-1))];
}
function n80_hub_cover_inventory(PDO $db):array{
 // Missing schema is a failed installation, never an empty successful inventory.
 $assets=[];foreach($db->query('SELECT * FROM noa_jukebox_assets') as $a)$assets[$a['song_key']]=$a;
 $rows=[];$covered=0;$missingSource=0;
 foreach($db->query("SELECT doc_key,kind,payload,revision FROM noa_documents WHERE kind IN ('single','story') ORDER BY doc_key") as $r){
  $d=json_decode($r['payload'],true,512,JSON_THROW_ON_ERROR);if(!empty($d['_noaTrash']))continue;$source=noa_sound_suno($d['body']??[]);
  if(noa_music_asset_url($assets,$r['doc_key'],$source,'cover')||noa_sound_cover($d['body']??[])){$covered++;continue;}
  if(!$source){$missingSource++;continue;}
  $rows[]=['key'=>$r['doc_key'],'sunoUrl'=>$source,'revision'=>(int)$r['revision'],'ownerId'=>$d['ownerId']??''];
 }
 return ['rows'=>$rows,'covered'=>$covered,'missingSource'=>$missingSource];
}
/** Recheck ownership, revision, source and existing artwork under the same SQL locks. */
function n80_hub_cover_apply(PDO $db,array $row,array $prepared):array{
 $key=$row['key'];if(($prepared['source']??null)!==$row['sunoUrl'])throw new DomainException('hub_cover_source_changed');
 $db->beginTransaction();
 try{
  $q=$db->prepare('SELECT * FROM noa_jukebox_assets WHERE song_key=? FOR UPDATE');$q->execute([$key]);$old=$q->fetch(PDO::FETCH_ASSOC)?:null;
  $q=$db->prepare('SELECT kind,payload,revision FROM noa_documents WHERE doc_key=? FOR UPDATE');$q->execute([$key]);$current=$q->fetch(PDO::FETCH_ASSOC);
  if(!$current)throw new DomainException('hub_cover_song_changed');$doc=json_decode($current['payload'],true,512,JSON_THROW_ON_ERROR);
  if(!in_array($current['kind'],['single','story'],true)||!empty($doc['_noaTrash'])||(int)$current['revision']!==$row['revision']||($doc['ownerId']??'')!==$row['ownerId']||noa_sound_suno($doc['body']??[])!==$row['sunoUrl'])throw new DomainException('hub_cover_song_changed');
  if(noa_sound_cover($doc['body']??[])||($old&&nj_asset_source($old,'cover')===$row['sunoUrl']&&nj_verified($old,'cover')))throw new DomainException('hub_cover_existing_preserved');
  nsc_attach($db,$key,$doc,$prepared);$after=nj_find($db,$key);
  if(!$after||!nj_verified($after,'cover')||nj_asset_source($after,'cover')!==$row['sunoUrl'])throw new RuntimeException('hub_cover_readback_failed');
  nup_attach_asset($db,$key,$after);$after=nj_find($db,$key);
  if($old)foreach(['source_url','suno_id','suno_title','audio_path','audio_bytes','audio_sha256','source_analysis','correction','final_analysis','status','catalog_context','errors','verified_at'] as $field){if(($after[$field]??null)!==($old[$field]??null))throw new RuntimeException('hub_cover_audio_changed');}
  if(!nj_verified($after,'cover'))throw new RuntimeException('hub_cover_readback_failed');
  $proof=['action'=>'cover-only-repair','owner'=>'N80 Hub','coverSha256'=>$after['cover_sha256'],'audioPreserved'=>true];
  $db->prepare('INSERT INTO noa_jukebox_history(song_key,result) VALUES(?,?)')->execute([$key,json_encode($proof,JSON_THROW_ON_ERROR)]);
  $db->commit();return $proof;
 }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
}
function n80_hub_covers(PDO $db,string $root,?callable $prepare=null):array{
 if(!function_exists('curl_init')||!function_exists('imagewebp')||!class_exists('DOMDocument'))throw new RuntimeException('hub_cover_runtime_unavailable');
 $prepare??=static fn($db,$key,$source)=>nsc_prepare($db,$key,$source);
 $inventory=n80_hub_cover_inventory($db);$state=n80_hub_read($root,'covers-retry.json');$live=[];
 foreach($inventory['rows'] as $row)$live[n80_hub_cover_identity($row)]=true;$state=array_intersect_key($state,$live);
 $rows=$inventory['rows'];usort($rows,static fn($a,$b)=>($state[n80_hub_cover_identity($a)]['next']??0)<=>($state[n80_hub_cover_identity($b)]['next']??0));
 $report=['ok'=>true,'candidates'=>count($rows),'attempted'=>0,'recovered'=>0,'unavailable'=>0,'conflicts'=>0,'audioFilesChanged'=>0,'githubRequired'=>false];$deadline=microtime(true)+50;
 foreach($rows as $row){
  if($report['attempted']>=4||microtime(true)>$deadline)break;$id=n80_hub_cover_identity($row);if(($state[$id]['next']??0)>time())continue;$report['attempted']++;
  try{
   $prepared=$prepare($db,$row['key'],$row['sunoUrl']);if(!$prepared)throw new RuntimeException('hub_cover_source_unavailable');
   n80_hub_cover_apply($db,$row,$prepared);unset($state[$id]);$report['recovered']++;
  }catch(DomainException $e){$report['conflicts']++;n80_hub_cover_retry($state,$row,time());}
  catch(Throwable $e){
   $report['unavailable']++;n80_hub_cover_retry($state,$row,time());
   if($e->getMessage()!=='hub_cover_source_unavailable'){
    n80_hub_write($root,'covers-retry.json',$state);n80_hub_write($root,'covers-result.json',['ok'=>false,'error'=>'hub_cover_publication_failed','checkedAt'=>time()]+$report);
    throw new RuntimeException('hub_cover_publication_failed');
   }
  }
  // Persist after each item; a lost HTTP response cannot lose retry progress.
  n80_hub_write($root,'covers-retry.json',$state);
 }
 n80_hub_write($root,'covers-retry.json',$state);
 $report['remaining']=count(n80_hub_cover_inventory($db)['rows']);$report['checkedAt']=time();
 n80_hub_write($root,'covers-result.json',$report);return $report;
}
