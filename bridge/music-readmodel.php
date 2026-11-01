<?php
declare(strict_types=1);
/** Cheap catalog availability; stream/download still verify full SHA-256 before delivery. */
function noa_music_asset_url(array $assets,string $key,string $source,string $type):string{
 if(!in_array($type,['audio','cover'],true))return '';
 $r=$assets[$key]??null;
 if(!$r||!hash_equals(nj_asset_source($r,$type),$source)||($type==='audio'&&$r['status']!=='ready'))return '';
 $path=nj_file((string)($r[$type.'_path']??''));
 if(!$path||!preg_match('/^[a-f0-9]{64}$/D',(string)($r[$type.'_sha256']??''))||filesize($path)!==(int)($r[$type.'_bytes']??0))return '';
 $mime=(new finfo(FILEINFO_MIME_TYPE))->file($path);
 return $mime===($type==='cover'?'image/webp':'audio/mpeg')?nj_url($key,$type):'';
}
/** Preserve document overrides while replacing the recovered-catalog N+1 lookup. */
function noa_music_recovered_catalog(PDO $db):array{
 $overrides=[];$out=[];
 foreach($db->query("SELECT doc_key,kind,payload FROM noa_documents WHERE doc_key LIKE 'catalog:%' ORDER BY doc_key") as $r){
  $d=json_decode($r['payload'],true);if(!is_array($d))continue;$d['_kind']=$r['kind'];$overrides[$r['doc_key']]=$d;
  if(in_array($r['kind'],['single','story'],true))$out[$r['doc_key']]=$d;
 }
 try{foreach($db->query("SELECT s.song_id,s.identity_json,s.genre_id,s.ep,v.fields_json,v.public_verified FROM noa_catalog_songs s JOIN noa_catalog_versions v ON v.entity_id=s.song_id AND v.entity_type='song' WHERE NOT EXISTS (SELECT 1 FROM noa_catalog_aliases a JOIN noa_documents d ON d.doc_key=a.alias_key WHERE a.entity_id=s.song_id AND a.batch_id=v.batch_id AND d.kind IN ('single','story')) AND v.batch_id=(SELECT batch_id FROM noa_catalog_batches WHERE status='applied' ORDER BY applied_at DESC,batch_id DESC LIMIT 1)") as $r){
  $document=noa_sound_catalog_document($r);if(!$document)continue;$key='catalog:'.$r['song_id'];
  $out[$key]=$overrides[$key]??$document;
 }}catch(PDOException $e){error_log('[music-catalog] recovery unavailable');}
 return $out;
}
function noa_music_detail_fields(array $document):array{
 $b=$document['body']??[];if(!is_array($b))$b=[];
 return ['rawLyrics'=>(string)($b['lyricsBlock']??''),'description'=>(string)($b['songDescription']??$b['descriptionBlock']??((($b['source']['platform']??'')==='youtube')?'':($b['description']??'')))];
}
/** Shared browse identity is presentation metadata, never permission to merge stored records. */
function noa_music_video_id(string $url):?string{
 $p=parse_url(trim($url));if(!$p||strtolower($p['scheme']??'')!=='https')return null;$host=strtolower($p['host']??'');$id=null;
 if(in_array($host,['youtu.be','www.youtu.be'],true))$id=trim($p['path']??'','/');
 elseif(in_array($host,['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com'],true)){parse_str($p['query']??'',$q);$id=$q['v']??null;if(!$id&&preg_match('~^/(?:shorts|embed|live)/([A-Za-z0-9_-]{11})(?:/|$)~',$p['path']??'',$m))$id=$m[1];}
 return is_string($id)&&preg_match('/^[A-Za-z0-9_-]{11}$/D',$id)?$id:null;
}
function noa_music_browse_catalog(array $catalog,array $videos=[]):array{
 $groups=[];foreach($catalog as $id=>$r){if(($r['kind']??'')==='playlist'||empty($r['canonicalVideo'])||in_array($videos[$r['canonicalVideo']]['match']['status']??'',['rejected','conflict'],true))continue;$scope=json_encode([$r['genre']??'',(int)($r['ep']??0),(int)($r['act']??0),$r['canonicalVideo']]);$groups[$scope][]=$id;}
 foreach($groups as $ids){if(count($ids)<2)continue;
  // Different verified recordings remain separate even if an editor reused a video URL.
  $audio=[];$suno=[];foreach($ids as $id){$r=$catalog[$id];if(!empty($r['audioSha']))$audio[$r['audioSha']]=true;$source=$r['_browseSuno']??$r['suno']??'';if($source!=='')$suno[rtrim($source,'/')]=true;}if(count($audio)>1||count($suno)>1)continue;
  $keys=[];foreach($ids as $id)foreach(['key','musicKey','orderKey','canonicalRecordKey'] as $field)if(!empty($catalog[$id][$field]))$keys[]=$catalog[$id][$field];$keys=array_values(array_unique($keys));$stable=$keys;sort($stable);$identity='record:'.hash('sha256',json_encode($stable));foreach($ids as $id){$catalog[$id]['browseIdentity']=$identity;$catalog[$id]['browseKeys']=$keys;}
 }
 return $catalog;
}
/** MUSIC and library use the same explicit-link evidence as YouTube, after current edits. */
function noa_music_original_artist(array $body,string $preferred=''):string{
 foreach([$preferred,$body['originalArtist']??null,$body['originalSinger']??null,$body['coverArtist']??null] as $value){
  if(is_string($value)&&trim($value)!=='')return trim($value);
 }
 return '';
}
function noa_music_display_title(array $row):string{
 $title=(string)($row['title']??$row['key']??'');
 $artist=trim((string)($row['originalArtist']??''));
 if(($row['genre']??'')!=='cover-reborn'||($row['kind']??'')==='playlist'||$artist===''||str_ends_with($title,' - '.$artist))return $title;
 return $title.' - '.$artist;
}
function noa_music_browse_project(array $rows,array $sources=[],array $edits=[]):array{
 foreach($rows as &$row){$key=(string)($row['musicKey']??$row['key']??'');$d=$sources[$key]??[];$b=$d['body']??$row['fields']??[];$f=function_exists('nie_fields')?nie_fields($edits,$row):[];$row['originalArtist']=noa_music_original_artist($b,(string)($f['originalArtist']??$row['originalArtist']??''));$row['canonicalVideo']=noa_music_video_id((string)($f['youtubeUrl']??$b['youtubeUrl']??''));$row['_browseSuno']=(string)($f['sunoUrl']??($row['suno']??(($b['sunoUrl']??'')?:($b['sunoShareUrl']??''))));$row['browsePriority']??=(str_starts_with($key,'catalog:')?0:2)+(!empty($d['packageSchema'])?1:0);}unset($row);
 $rows=noa_music_browse_catalog($rows);foreach($rows as &$row)unset($row['canonicalVideo'],$row['_browseSuno']);unset($row);return $rows;
}

function noa_music_cover(array $assets,string $key,string $source,array $body,string $owner=''):string{
 return noa_music_asset_url($assets,$key,$source,'cover')?:noa_sound_cover($body)?:('/noa-creator-symbol.php'.($owner!==''?'?channel='.hash('sha256',$owner):''));
}
