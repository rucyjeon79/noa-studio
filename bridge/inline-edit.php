<?php
declare(strict_types=1);
/** Shared complete-record editor and read projection. Legacy sidecars are read-only migration input. */
require_once __DIR__.'/package-record.php';
function nie_identity(PDO $db,string $key):string{
 if(preg_match('/^catalog:([a-f0-9]{64})$/D',$key,$m))return $m[1];
 $q=$db->prepare("SELECT DISTINCT entity_id FROM noa_catalog_aliases WHERE alias_key=? AND batch_id=(SELECT batch_id FROM noa_catalog_batches WHERE status='applied' ORDER BY applied_at DESC,batch_id DESC LIMIT 1)");
 $q->execute([$key]);$ids=$q->fetchAll(PDO::FETCH_COLUMN);return count($ids)===1?(string)$ids[0]:$key;
}
function nie_song_id(string $id):string{return preg_match('/^[a-f0-9]{64}$/D',$id)?$id:hash('sha256','record:'.$id);}
function nie_meta_key(string $type,string $id):string{return 'meta:inline-'.$type.':'.$id;}
function nie_overrides(PDO $db):array{
 $out=[];
 foreach($db->query("SELECT doc_key,payload,revision FROM noa_documents WHERE kind='meta' AND doc_key LIKE 'meta:inline-%' ORDER BY doc_key") as $r){
  $p=json_decode($r['payload'],true);if(!is_array($p)||($p['inlineEdit']??null)!==1||!is_array($p['fields']??null)||!is_array($p['target']??null))continue;
  $type=$p['target']['type']??'';$id=$p['target']['id']??'';if(!in_array($type,['song','act'],true)||!is_string($id)||nie_meta_key($type,$id)!==$r['doc_key'])continue;
  $valid=[];foreach(['title','description','lyrics','cast'] as $field)if(isset($p['fields'][$field])&&is_string($p['fields'][$field]))$valid[$field]=$p['fields'][$field];
  $out[$r['doc_key']]=['key'=>$r['doc_key'],'revision'=>(int)$r['revision'],'payload'=>$p,'fields'=>$valid];
 }
 $classification=nsc_context($db);
 $aliases=nup_song_aliases($db);$pool=[];$packages=[];
 foreach($db->query("SELECT doc_key,kind,payload,revision FROM noa_documents WHERE kind IN ('single','story','playlist') ORDER BY doc_key") as $r){
  $d=json_decode($r['payload'],true);if(!empty($d['_noaTrash']))continue;
  $key=$r['doc_key'];
  if($r['kind']!=='playlist')foreach(nup_song_ids($key,$aliases) as $id)$pool[$id][$key]=true;
  if(!empty($d['packageSchema']))$packages[]=[$key,$r['kind'],(int)$r['revision'],$d];
 }
 $memberships=nup_collection_memberships($pool,nup_collections($db));$ids=[];
 foreach($pool as $id=>$matches)if(count($matches)===1)$ids[array_key_first($matches)][]=$id;
 foreach($packages as [$key,$kind,$revision,$d]){$d=nsc_document($d,$classification);$fields=nup_fields($d);
  if($kind==='playlist'){if(!isset($d['body']['displayTitle']))unset($fields['title']);$targets=[nie_meta_key('act',($d['genreId']??'').':'.(int)($d['act']??0))];}
  else{$fields['canonicalRecordKey']=$key;$fields['collectionIds']=array_values($memberships[$key]??[]);$targets=array_map(fn($id)=>nie_meta_key('song',nie_song_id($id)),$ids[$key]??[]);}
  foreach($targets as $target)$out[$target]=['key'=>$key,'revision'=>$revision,'payload'=>$d,'fields'=>$fields];
 }
 return $out;
}
function nie_fields(array $edits,array $record):array{
 $id=(string)(($record['orderKey']??'')?:($record['catalogSongId']??$record['catalogId']??$record['key']??''));$id=preg_replace('/^catalog:/','',$id);
 $keys=[nie_meta_key('song',nie_song_id($id))];if(!empty($record['video']))$keys[]=nie_meta_key('song',nie_song_id('youtube:'.$record['video']));
 foreach($keys as $key)if(isset($edits[$key]))return $edits[$key]['fields'];return [];
}
function nie_project(array $edits,array $rows):array{
 foreach($rows as &$r){$f=($r['kind']??'')==='playlist'&&((int)($r['act']??0)>0)?($edits[nie_meta_key('act',$r['genre'].':'.(int)$r['act'])]['fields']??[]):nie_fields($edits,$r);foreach(['title','description','cast','vocal','originalArtist','genre','collectionIds','canonicalRecordKey'] as $name)if(array_key_exists($name,$f))$r[$name]=$f[$name];if(array_key_exists('lyrics',$f)){$r['rawLyrics']=$f['lyrics'];$r['lyrics']=noa_sound_lyrics($f['lyrics']);}}unset($r);return $rows;
}
function nie_act_labels(array $edits,array $rows):array{
 $out=[];foreach($rows as $r){$act=(int)($r['act']??0);if(!$act&&is_numeric($r['ep']??null))$act=(int)ceil((int)$r['ep']/10);if(!$act)continue;$id=$r['genre'].':'.$act;$f=$edits[nie_meta_key('act',$id)]['fields']??[];if(isset($f['title']))$out[$id]=$f['title'];}return $out;
}
function nie_resolve(PDO $db,array $input):array{
 $type=$input['type']??'';$source=$input['source']??'';$key=$input['key']??'';$genre='';$ep='';$act='';$fields=['title'=>'','description'=>'','lyrics'=>'','cast'=>''];$context=[];$document=null;$documentKey='';$documentKind='single';$documentRevision=0;
 if($type==='new'){
  $genre=$input['genre']??'';$kind=$input['kind']??'single';$number=$input['number']??'';$nonce=$input['id']??'';
  if(!in_array($genre,NUP_GENRES,true)||!in_array($kind,['single','story','playlist'],true)||!is_string($number)||!is_string($nonce)||!preg_match('/^[a-f0-9]{24}$/D',$nonce))throw new InvalidArgumentException('invalid_new_record');
  $numbered=$kind==='single'||($kind==='playlist'&&!in_array($genre,['your-story','cover-reborn'],true));
  if($numbered&&!preg_match('/^[1-9][0-9]{0,2}$/D',ltrim($number,'0')))throw new InvalidArgumentException('number_required');
  $documentKind=$kind;$ep=$kind==='single'?str_pad((string)(int)$number,2,'0',STR_PAD_LEFT):'';$act=$kind==='playlist'&&$numbered?(string)(int)$number:'';
  $documentKey=$kind.':'.$genre.':'.($ep!==''?$ep:($act!==''?'act-'.$act:$nonce));
  $q=$db->prepare('SELECT revision FROM noa_documents WHERE doc_key=?');$q->execute([$documentKey]);if($q->fetchColumn()!==false)throw new DomainException('record_already_exists');
  $document=['genreId'=>$genre,'ep'=>$ep,'act'=>$act,'title'=>'','confirmed'=>false,'body'=>[]];$context=['genre'=>$genre,'ep'=>$ep,'act'=>$act];$id=$documentKey;
 }elseif($type==='act'){
  $genre=$input['genre']??'';$act=$input['act']??'';
  $genres=['kpop-original','jpop-original','pop-original','thai-original','joseon-ballad','echoes-of-joseon','groovy-airy-pop','narrative-piano-indie','dreamy-deep-house','fantasy-ambient-edm','edm-kpop-club','latin-afrobeats-edm','panpop','your-story','cover-reborn'];
  if(!in_array($genre,$genres,true)||!is_scalar($act)||!preg_match('/^[1-9][0-9]{0,2}$/D',(string)$act))throw new InvalidArgumentException('invalid_act');
  $id=$genre.':'.(int)$act;$fields['title']='ACT '.(int)$act;$context=['genre'=>$genre,'ep'=>'','act'=>(string)$act,'range'=>'EP.'.(((int)$act-1)*10+1).'–'.((int)$act*10)];
  $q=$db->query("SELECT doc_key,payload,revision FROM noa_documents WHERE kind='playlist' ORDER BY doc_key");$matches=[];foreach($q as $row){$d=json_decode($row['payload'],true);if(($d['genreId']??'')===$genre&&(int)($d['act']??0)===(int)$act)$matches[]=$row;}
  if(count($matches)>1)throw new DomainException('ambiguous_playlist');
  if(count($matches)===1){$r=$matches[0];$document=json_decode($r['payload'],true);$documentKey=$r['doc_key'];$documentRevision=(int)$r['revision'];$documentKind='playlist';$b=$document['body']??[];$fields['description']=(string)($b['songDescription']??$b['descriptionBlock']??'');$context['tracklist']=(string)($b['tracklist']??'');}
  if(!$document){$documentKey='playlist:unified:'.$genre.':act-'.(int)$act;$documentKind='playlist';$document=['genreId'=>$genre,'act'=>(int)$act,'title'=>$fields['title'],'body'=>[]];}
 }elseif($type==='song'){
  if(!is_string($key)||!preg_match('/^[A-Za-z0-9:_-]{1,190}$/D',$key)||!in_array($source,['music','youtube'],true))throw new InvalidArgumentException('invalid_song');
  $document=null;$video=null;
  if($source==='youtube'){
   if(!preg_match('/^[A-Za-z0-9_-]{11}$/D',$key))throw new InvalidArgumentException('invalid_video');
   require_once __DIR__.'/youtube-store.php';$run=ny_latest($db);$videos=$run?ny_videos($db,$run):[];$video=$videos[$key]??null;if(!$video)throw new DomainException('not_found');
   $sid=$video['match']['songId']??null;$keyForIdentity=$sid?'catalog:'.$sid:'youtube:'.$key;
  }else $keyForIdentity=$key;
  $id=nie_identity($db,$keyForIdentity);
  $q=$db->prepare('SELECT doc_key,payload,kind,revision FROM noa_documents WHERE doc_key=?');$q->execute([$keyForIdentity]);$r=$q->fetch(PDO::FETCH_ASSOC);
  if(!$r&&preg_match('/^[a-f0-9]{64}$/D',$id)){
   $q=$db->prepare("SELECT d.doc_key,d.payload,d.kind,d.revision FROM noa_catalog_aliases a JOIN noa_documents d ON d.doc_key=a.alias_key WHERE a.entity_id=? AND a.batch_id=(SELECT batch_id FROM noa_catalog_batches WHERE status='applied' ORDER BY applied_at DESC,batch_id DESC LIMIT 1) AND d.kind IN ('single','story') ORDER BY d.doc_key");$q->execute([$id]);$candidates=$q->fetchAll(PDO::FETCH_ASSOC);if(count($candidates)===1)$r=$candidates[0];elseif(count($candidates)>1)throw new DomainException('ambiguous_song');
  }
  if($r){if(!in_array($r['kind'],['single','story','playlist'],true))throw new DomainException('not_found');$document=json_decode($r['payload'],true);$documentKey=$r['doc_key'];$documentKind=$r['kind'];$documentRevision=(int)$r['revision'];}
  if(!$document&&preg_match('/^[a-f0-9]{64}$/D',$id)){
   $q=$db->prepare("SELECT s.song_id,s.genre_id,s.ep,v.fields_json,v.public_verified FROM noa_catalog_songs s JOIN noa_catalog_versions v ON v.entity_id=s.song_id AND v.entity_type='song' WHERE s.song_id=? AND v.batch_id=(SELECT batch_id FROM noa_catalog_batches WHERE status='applied' ORDER BY applied_at DESC,batch_id DESC LIMIT 1)");$q->execute([$id]);$r=$q->fetch(PDO::FETCH_ASSOC);if($r){$document=noa_sound_catalog_document($r);$documentKey='catalog:'.$id;$documentKind='story';}
  }
  if(!$document)throw new DomainException('song_registration_required');
  $b=$document['body']??[];$fields=['title'=>(string)($video['snippet']['title']??$b['confirmedTitle']??$document['title']??''),'description'=>(string)($video['snippet']['description']??$b['songDescription']??$b['descriptionBlock']??''),'lyrics'=>(string)($b['lyricsBlock']??''),'cast'=>(string)($b['thumbCast']??'')];
  $genre=(string)($document['genreId']??'unclassified');$ep=(string)($document['ep']??'');$act=(string)($document['act']??'');
  $context=['genre'=>$genre,'ep'=>$ep,'act'=>$act,'youtube'=>(string)($b['youtubeUrl']??($video?'https://www.youtube.com/watch?v='.$video['id']:'')),'suno'=>noa_sound_suno($b)];
 }elseif($type==='playlist'){
  $playlistId=(string)($input['id']??'');if(!preg_match('/^[a-f0-9]{24}$/D',$playlistId))throw new InvalidArgumentException('invalid_playlist');$documentKey='playlist:custom:'.$playlistId;$q=$db->prepare("SELECT payload,revision FROM noa_documents WHERE doc_key=? AND kind='playlist'");$q->execute([$documentKey]);$r=$q->fetch(PDO::FETCH_ASSOC);if(!$r)throw new DomainException('not_found');$document=json_decode($r['payload'],true);$documentRevision=(int)$r['revision'];$documentKind='playlist';$id=$playlistId;
 }else throw new InvalidArgumentException('invalid_type');
 $id=$type==='song'?nie_song_id($id):$id;$writeKey=nie_meta_key($type,$id);$edits=nie_overrides($db);$saved=$edits[$writeKey]??null;$fields=array_replace($fields,$saved['fields']??[]);
 $resolved=['ok'=>true,'writeKey'=>$writeKey,'revision'=>$saved['revision']??0,'payload'=>$saved['payload']??['inlineEdit'=>1,'target'=>['type'=>$type,'id'=>$id],'fields'=>[]],'fields'=>$fields,'context'=>$context,'document'=>$document,'documentKey'=>$documentKey,'documentKind'=>$documentKind,'documentRevision'=>$documentRevision];
 return nup_complete($db,$resolved);
}
