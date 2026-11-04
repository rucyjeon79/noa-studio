<?php
declare(strict_types=1);
require_once __DIR__.'/personal-listening.php';
require_once __DIR__.'/personal-genre-model.php';

/** Workers retain term vectors. Listener requests read only the small ranking columns. */
function n80_song_features(PDO $db):array{
 $out=[];
 foreach($db->query('SELECT record_key,scores,affinity FROM noa_listening_song_index') as $r){
  $out[$r['record_key']]=['moodScores'=>json_decode($r['scores'],true,512,JSON_THROW_ON_ERROR),'moodAffinity'=>json_decode($r['affinity'],true,512,JSON_THROW_ON_ERROR)];
 }
 return $out;
}

function n80_refresh_song_index(PDO $db,callable $scan):array{
 $db->exec('CREATE TABLE IF NOT EXISTS noa_listening_song_index (record_key VARBINARY(512) PRIMARY KEY, source_hash CHAR(64) NOT NULL, keywords JSON NOT NULL, scores JSON NOT NULL, affinity JSON NOT NULL) ENGINE=InnoDB');
 if(!(int)$db->query("SELECT GET_LOCK('noa_listening_song_index',10)")->fetchColumn())throw new RuntimeException('listening_index_busy');
 try{
  $db->beginTransaction();
  $prior=$db->query('SELECT * FROM noa_listening_song_index')->fetchAll(PDO::FETCH_UNIQUE|PDO::FETCH_ASSOC);
  $version=hash_file('sha256',__FILE__).hash_file('sha256',__DIR__.'/personal-listening.php').hash_file('sha256',__DIR__.'/personal-genre-model.php');
  $records=[];$changed=0;
  $scan(function(array $row,array $body,array $fields)use(&$records,&$changed,$prior,$version){
   $key=$row['key'];
   $lyrics=(string)($fields['lyrics']??$body['lyricsBlock']??'');
   $description=(string)($fields['description']??$body['songDescription']??$body['descriptionBlock']??$body['description']??'');
   $style=array_intersect_key($body,array_flip(['sunoStyle','sunoStylePrompt','stylePrompt','sunoPrompt','style','mood']));
   $identity=$row['canonicalRecordKey']??$row['orderKey'];
   $hash=hash('sha256',serialize([$version,$identity,$row['title'],$lyrics,$description,$style]));
   $old=$prior[$key]??null;
   $item=['key'=>$key,'orderKey'=>$identity,'signature'=>$hash];
   if($old&&hash_equals($old['source_hash'],$hash)){
    $item['keywords']=json_decode($old['keywords'],true,512,JSON_THROW_ON_ERROR);
    $item['moodScores']=json_decode($old['scores'],true,512,JSON_THROW_ON_ERROR);
   }else{
    $song=['title'=>$row['title'],'lyrics'=>noa_sound_lyrics($lyrics),'description'=>$description];
    $item['keywords']=array_values(n80_genre_terms($song));
    $item['moodScores']=n80_listening_mood_scores($song,$style);
    $changed++;
   }
   $item['moodTags']=array_keys($item['moodScores']);
   $records[$key]=$item;
  });
  $removed=array_diff_key($prior,$records);
  $writes=0;
  if($changed||$removed){
   n80_genre_model($records);
   $put=$db->prepare('INSERT INTO noa_listening_song_index(record_key,source_hash,keywords,scores,affinity) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE source_hash=VALUES(source_hash),keywords=VALUES(keywords),scores=VALUES(scores),affinity=VALUES(affinity)');
   foreach($records as $key=>$r){
    $affinity=$r['moodAffinity']??[];$old=$prior[$key]??null;
    if($old&&$old['source_hash']===$r['signature']&&json_decode($old['affinity'],true)==$affinity)continue;
    $put->execute([$key,$r['signature'],json_encode($r['keywords'],JSON_THROW_ON_ERROR),json_encode($r['moodScores'],JSON_THROW_ON_ERROR),json_encode($affinity,JSON_THROW_ON_ERROR)]);
    $writes++;
   }
   $drop=$db->prepare('DELETE FROM noa_listening_song_index WHERE record_key=?');
   foreach(array_keys($removed) as $key)$drop->execute([$key]);
  }
  $db->commit();
  return ['indexed'=>count($records),'analyzed'=>$changed,'reused'=>count($records)-$changed,'written'=>$writes,'removed'=>count($removed)];
 }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
 finally{$db->query("SELECT RELEASE_LOCK('noa_listening_song_index')")->closeCursor();}
}
