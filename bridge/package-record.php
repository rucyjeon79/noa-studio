<?php
declare(strict_types=1);
/** One complete, versioned JSON record per song/playlist. No metadata sidecar writes.
 * noa_documents.payload is authoritative; history and JSON downloads are snapshots.
 */
const NUP_GENRES=['kpop-original','jpop-original','pop-original','thai-original','joseon-ballad','echoes-of-joseon','groovy-airy-pop','narrative-piano-indie','dreamy-deep-house','fantasy-ambient-edm','edm-kpop-club','latin-afrobeats-edm','panpop','your-story','cover-reborn'];
const NUP_EXTRA_FIELDS=['storyPlan','chorusHook','englishHook','hashtags','localizations','genreRecommendation'];
const NUP_FIELDS=['tracklist','creativeFields','confirmed','originalArtist','title','description','lyrics','cast','vocal','sunoPrompt','geminiPrompt','youtubeTitle','communityPost','sunoUrl','cardImageLocation','audioFileLocation','youtubeUrl','mvUrl','members','songDescription','lyricsTranslation','productionPrompt','characterPrompt'];
function nup_type(array $d,string $kind):string{
 $g=$d['genreId']??'';
 if($kind==='playlist')return in_array($g,['your-story','cover-reborn'],true)||(int)($d['act']??0)<1?'playlist':'act';
 if(!in_array($g,['kpop-original','your-story','cover-reborn'],true)&&(int)($d['ep']??0)<1)return 'song';
 return $g==='kpop-original'?'original':($g==='your-story'?'story':($g==='cover-reborn'?'cover':'ep'));
}
function nup_text(array $body,array $keys):string{foreach($keys as $key)if(is_string($body[$key]??null)&&trim($body[$key])!=='')return $body[$key];return '';}
function nup_fields(array $d):array{
 $b=$d['body']??[];$p=$d['packageType']??nup_type($d,(int)($d['act']??0)>0?'playlist':'single');
 return ['genre'=>(string)($d['genreId']??'unclassified'),'tracklist'=>(string)($b['tracklist']??''),'creativeFields'=>array_intersect_key($b,array_flip(NUP_EXTRA_FIELDS)),'confirmed'=>!empty($d['confirmed']),'originalArtist'=>(string)($b['originalArtist']??$b['originalSinger']??$b['coverArtist']??''),'title'=>(string)($b['displayTitle']??$b['confirmedTitle']??$d['title']??''),'description'=>(string)($b['youtubeDescription']??$b['songDescription']??$b['descriptionBlock']??$b['description']??''),'lyrics'=>(string)($b['lyricsBlock']??''),'cast'=>(string)($b['thumbCast']??''),'vocal'=>(string)($b['vocalInfo']??$b['vocal']??$b['sourceVocal']??''),'sunoPrompt'=>nup_text($b,['sunoPrompt','sunoStyle']),'geminiPrompt'=>(string)($b['geminiPrompt']??''),'youtubeTitle'=>(string)($b['youtubeTitle']??''),'communityPost'=>(string)($b['communityPost']??$b['fanLetter']??''),'sunoUrl'=>(string)($b['sunoShareUrl']??$b['sunoUrl']??''),'cardImageLocation'=>(string)($b['cardImageLocation']??$b['coverImageUrl']??$b['thumbUrl']??''),'audioFileLocation'=>(string)($b['audioFileLocation']??$b['audioUrl']??''),'youtubeUrl'=>(string)($b['youtubeUrl']??''),'mvUrl'=>(string)($b['mvUrl']??$b['musicVideoUrl']??''),'members'=>$b['members']??[],'songDescription'=>(string)($b['songDescription']??$b['descriptionBlock']??$b['summary']??$b['description']??''),'lyricsTranslation'=>(string)($b['lyricsTranslation']??$b['translatedLyrics']??$b['translationBlock']??''),'productionPrompt'=>(string)($b['productionPrompt']??$b['creationPrompt']??''),'characterPrompt'=>(string)($b['characterPrompt']??$b['characterFixedPrompt']??$b['characterPromptBlock']??'')];
}
function nup_normalize(array $d,string $kind):array{
 $d['packageSchema']=1;$d['packageType']=nup_type($d,$kind);$d['body']??=[];$b=&$d['body'];$f=nup_fields($d);
 // Keep unrecognised production fields and acquisition evidence byte-for-byte as values.
 foreach(['originalArtist'=>'originalArtist','vocalInfo'=>'vocal','sunoPrompt'=>'sunoPrompt','geminiPrompt'=>'geminiPrompt','youtubeTitle'=>'youtubeTitle','youtubeDescription'=>'description','communityPost'=>'communityPost','sunoUrl'=>'sunoUrl','cardImageLocation'=>'cardImageLocation','audioFileLocation'=>'audioFileLocation','youtubeUrl'=>'youtubeUrl','mvUrl'=>'mvUrl'] as $dst=>$src)if(!array_key_exists($dst,$b))$b[$dst]=$f[$src];
 if($d['packageType']==='original')$b['originalInfo']??=['ep'=>(string)($d['ep']??''),'title'=>$f['title'],'lyrics'=>$f['lyrics'],'vocal'=>$f['vocal']];
 if(in_array($d['packageType'],['act','playlist'],true))$b['members']??=[];
 if($d['packageType']==='act'){$a=(int)($d['act']??0);if($a<1)throw new DomainException('act_number_required');$d['epRange']=['from'=>($a-1)*10+1,'to'=>$a*10];}
 return $d;
}
function nup_patch(array $d,string $kind,array $patch):array{
 if(array_key_exists('genre',$patch)){
  if(!is_string($patch['genre'])||!in_array($patch['genre'],NUP_GENRES,true))throw new InvalidArgumentException('invalid_genre');
  if($kind==='playlist'&&$patch['genre']!==($d['genreId']??''))throw new InvalidArgumentException('playlist_genre_locked');
  $d['genreId']=$patch['genre'];unset($patch['genre']);
  if($d['genreId']==='kpop-original'&&(int)($patch['ep']??$d['ep']??0)<1)throw new InvalidArgumentException('classification_ep_required');
 }
 $d=nup_normalize($d,$kind);$type=$d['packageType'];$playlist=in_array($type,['act','playlist'],true);
 $allowed=$playlist?['tracklist','creativeFields','confirmed','title','description','cast','vocal','geminiPrompt','youtubeTitle','communityPost','youtubeUrl','mvUrl','members','songDescription','characterPrompt']:array_diff(NUP_FIELDS,['members']);
 if($type!=='cover')$allowed=array_diff($allowed,['originalArtist']);
 if($type==='original')$allowed=array_merge($allowed,['ep']);
 foreach($patch as $key=>$value){
  if(!in_array($key,$allowed,true))throw new InvalidArgumentException('field_read_only:'.$key);
  if($key==='confirmed'){if(!is_bool($value))throw new InvalidArgumentException('invalid_confirmed');$d['confirmed']=$value;continue;}
  if($key==='creativeFields'){if(!is_array($value)||($value&&array_is_list($value))||array_diff(array_keys($value),NUP_EXTRA_FIELDS)||strlen(json_encode($value,JSON_THROW_ON_ERROR))>200000)throw new InvalidArgumentException('invalid_creative_fields');foreach(NUP_EXTRA_FIELDS as $extra){if(array_key_exists($extra,$value))$d['body'][$extra]=$value[$extra];else unset($d['body'][$extra]);}continue;}
  if($key==='members'){
   if(!is_array($value)||!array_is_list($value)||count($value)>2000||($type==='act'&&count($value)!==10))throw new InvalidArgumentException('invalid_members');
   $seen=[];$eps=[];foreach($value as $m){if(!is_array($m)||!is_string($m['key']??null)||!preg_match('/^[a-zA-Z0-9:_-]{1,190}$/D',$m['key'])||isset($seen[$m['key']]))throw new InvalidArgumentException('invalid_member');$seen[$m['key']]=true;if($type==='act')$eps[]=(int)($m['ep']??0);}
   if($type==='act'&&$eps!==range($d['epRange']['from'],$d['epRange']['to']))throw new InvalidArgumentException('act_requires_ep_range');
   $d['body']['members']=$value;continue;
  }
  if(!is_string($value)||strlen($value)>200000||str_contains($value,"\0"))throw new InvalidArgumentException('invalid_field:'.$key);
  if($key==='originalArtist'&&mb_strlen($value)>200)throw new InvalidArgumentException('original_artist_too_long');
  if($key==='title'&&(trim($value)===''||mb_strlen($value)>500))throw new InvalidArgumentException('title_required');
  if(in_array($key,['sunoUrl','youtubeUrl','mvUrl'],true)&&$value!==''){
   $u=parse_url($value);if(($u['scheme']??'')!=='https'||empty($u['host'])||isset($u['user'])||isset($u['pass'])||isset($u['port']))throw new InvalidArgumentException('invalid_url');
   $host=strtolower($u['host']);$hosts=$key==='sunoUrl'?['suno.com','www.suno.com','suno.ai','www.suno.ai']:['youtube.com','www.youtube.com','m.youtube.com','youtu.be'];if(!in_array($host,$hosts,true))throw new InvalidArgumentException('invalid_media_host');
  }
  if(in_array($key,['audioFileLocation','cardImageLocation'],true)&&$value!==''&&(!preg_match('~^(?:https://[^\s]+|/[A-Za-z0-9/_?.=&:%+-]+)$~D',$value)||str_contains($value,'..')))throw new InvalidArgumentException('invalid_file_location');
  if($key==='ep'){if(!preg_match('/^[1-9][0-9]{0,3}$/D',ltrim($value,'0')))throw new InvalidArgumentException('invalid_ep');$d['ep']=str_pad((string)(int)$value,2,'0',STR_PAD_LEFT);$d['body']['originalInfo']['ep']=$d['ep'];continue;}
  $map=['tracklist'=>'tracklist','songDescription'=>'songDescription','lyricsTranslation'=>'lyricsTranslation','productionPrompt'=>'productionPrompt','characterPrompt'=>'characterPrompt','originalArtist'=>'originalArtist','title'=>'confirmedTitle','description'=>'youtubeDescription','lyrics'=>'lyricsBlock','cast'=>'thumbCast','vocal'=>'vocalInfo','sunoPrompt'=>'sunoPrompt','geminiPrompt'=>'geminiPrompt','youtubeTitle'=>'youtubeTitle','communityPost'=>'communityPost','sunoUrl'=>'sunoUrl','cardImageLocation'=>'cardImageLocation','audioFileLocation'=>'audioFileLocation','youtubeUrl'=>'youtubeUrl','mvUrl'=>'mvUrl'];
  $d['body'][$map[$key]]=$value;
  if($key==='vocal'&&isset(['여자솔로'=>'female','남자솔로'=>'male','남녀듀엣'=>'duet'][$value]))$d['body']['thumbCast']=['여자솔로'=>'female','남자솔로'=>'male','남녀듀엣'=>'duet'][$value];
  if($type==='original'&&in_array($key,['title','lyrics','vocal'],true))$d['body']['originalInfo'][$key]=$value;
  if($key==='title'){$d['title']=$value;if($playlist)$d['body']['displayTitle']=$value;}
  // Compatibility aliases are in this same record, not independently editable stores.
  // YouTube description and song introduction are distinct; never overwrite one with the other.
  if($key==='sunoPrompt'&&array_key_exists('sunoStyle',$d['body']))$d['body']['sunoStyle']=$value;
  if($key==='sunoUrl'&&isset($d['body']['sunoShareUrl']))$d['body']['sunoShareUrl']=$value;
  foreach(['cardImageLocation'=>['coverImageUrl','thumbUrl'],'audioFileLocation'=>['audioUrl'],'mvUrl'=>['musicVideoUrl'],'vocal'=>['vocal'],'communityPost'=>['fanLetter'],'lyricsTranslation'=>['translatedLyrics','translationBlock']] as $canonical=>$aliases)if($key===$canonical)foreach($aliases as $alias)if(array_key_exists($alias,$d['body']))$d['body'][$alias]=$value;
 }
 return $d;
}
/** Keep identities and immutable imports stable; reject a move that breaks existing links. */
function nup_validate_classification(PDO $db,string $key,array $before,array $after):void{
 if(($before['genreId']??'')===($after['genreId']??''))return;
 $identity=nie_identity($db,$key);$ep=(int)($after['ep']??0);
 if(!empty($before['sourceRef']))throw new DomainException('classification_source_linked');
 $q=$db->query("SELECT doc_key,kind,payload FROM noa_documents WHERE kind IN ('single','story','playlist') OR doc_key='meta:category-order' ORDER BY doc_key FOR UPDATE");
 foreach($q as $r){if($r['doc_key']===$key)continue;$d=json_decode($r['payload'],true);if(!empty($d['_noaTrash']))continue;
  if(($d['sourceRef']??'')===$key||(($before['genreId']??'')==='kpop-original'&&$ep>0&&$r['kind']!=='playlist'&&nup_type($d,$r['kind'])==='ep'&&(int)($d['ep']??0)===$ep))throw new DomainException('classification_source_linked');
  if($ep>0&&in_array($r['kind'],['single','story'],true)&&($d['genreId']??'')===$after['genreId']&&(int)($d['ep']??0)===$ep)throw new DomainException('classification_ep_conflict');
  if($r['kind']==='playlist'){
   foreach($d['body']['members']??[] as $m)if(in_array($m['key']??'',[$key,$identity],true))throw new DomainException('classification_playlist_linked');
   if($ep>0&&($d['genreId']??'')===($before['genreId']??'')&&(int)($d['act']??0)===(int)ceil($ep/10))throw new DomainException('classification_playlist_linked');
  }
  if($r['doc_key']==='meta:category-order')foreach($d['playlists']??[] as $list)if(array_intersect($list['keys']??[],[$key,$identity]))throw new DomainException('classification_playlist_linked');
 }
}
function nup_original(PDO $db,array $d):array{
 $ep=(int)($d['ep']??0);if(!$ep)return ['status'=>'not_applicable'];
 $q=$db->query("SELECT doc_key,payload,revision FROM noa_documents WHERE kind IN ('single','story') AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.genreId'))='kpop-original' ORDER BY doc_key");$matches=[];
 foreach($q as $r){$p=json_decode($r['payload'],true);if(($p['genreId']??'')==='kpop-original'&&(!empty($d['sourceRef'])?$r['doc_key']===$d['sourceRef']:(int)($p['ep']??0)===$ep))$matches[]=$r;}
 if(count($matches)!==1)return ['status'=>count($matches)>1?'ambiguous':'missing','ep'=>str_pad((string)$ep,2,'0',STR_PAD_LEFT)];
 $r=$matches[0];$p=json_decode($r['payload'],true);$f=array_replace(nup_fields($p),$p['body']['originalInfo']??[]);return ['status'=>'linked','key'=>$r['doc_key'],'revision'=>(int)$r['revision'],'ep'=>(string)$p['ep'],'title'=>$f['title'],'lyrics'=>$f['lyrics'],'vocal'=>$f['vocal']];
}
function nup_complete(PDO $db,array $resolved):array{
 $d=$resolved['document'];$kind=$resolved['documentKind'];$d=nup_normalize($d,$kind);
 if($d['packageType']==='act'&&empty($d['body']['members'])){
  $q=$db->query("SELECT doc_key,kind,payload FROM noa_documents WHERE kind IN ('single','story') ORDER BY doc_key");$members=[];
  foreach($q as $r){$m=json_decode($r['payload'],true);if(!empty($m['_noaTrash']))continue;$ep=(int)($m['ep']??0);if(($m['genreId']??'')===$d['genreId']&&$ep>=$d['epRange']['from']&&$ep<=$d['epRange']['to'])$members[]=['key'=>nie_identity($db,$r['doc_key']),'ep'=>$ep,'title'=>nup_fields($m)['title']];}usort($members,fn($a,$b)=>$a['ep']<=>$b['ep']);$d['body']['members']=$members;
 }
 $fields=nup_fields($d);
 // The legacy editor's committed values are promoted when this complete record is saved.
 if(empty($resolved['document']['packageSchema']))foreach($resolved['fields'] as $name=>$value)if(in_array($name,NUP_FIELDS,true))$fields[$name]=$value;
 $original=nup_original($db,$d);$resolved['fields']=$fields;$resolved['writeKey']=$resolved['documentKey'];$resolved['revision']=$resolved['documentRevision'];$resolved['kind']=$kind;$resolved['payload']=$d;$resolved['packageType']=$d['packageType'];$resolved['original']=$original;
 if(in_array($d['packageType'],['act','playlist'],true)){
  $candidates=[];$q=$db->query("SELECT doc_key,payload FROM noa_documents WHERE kind IN ('single','story') ORDER BY doc_key");foreach($q as $r){$p=json_decode($r['payload'],true);if(!empty($p['_noaTrash'])||($p['genreId']??'')!==($d['genreId']??''))continue;$ep=(int)($p['ep']??0);if($d['packageType']==='act'&&($ep<$d['epRange']['from']||$ep>$d['epRange']['to']))continue;$candidates[]=['key'=>nie_identity($db,$r['doc_key']),'ep'=>$ep,'title'=>nup_fields($p)['title']];}usort($candidates,fn($a,$b)=>$a['ep']<=>$b['ep']);$resolved['candidates']=$candidates;
 }
 $resolved['context']['act']=(string)($d['act']??'');if($d['packageType']==='act')$resolved['context']['range']='EP.'.$d['epRange']['from'].'–'.$d['epRange']['to'];
 $resolved['context']['ep']=(string)($d['ep']??'');$resolved['context']['genre']=$d['genreId']??'';
 if($d['packageType']==='original')$resolved['fields']=array_replace($resolved['fields'],$d['body']['originalInfo']??[],['ep'=>(string)($d['ep']??'')]);
 return $resolved;
}
/** Shared full-editor write boundary. Canonical and legacy aliases cannot diverge silently. */
function nup_merge_body(array $old,array $incoming):array{
 $merged=array_replace($old,$incoming);
 foreach([['sunoPrompt','sunoStyle'],['sunoUrl','sunoShareUrl'],['communityPost','fanLetter']]as $aliases){
  $changes=[];foreach($aliases as $alias)if(array_key_exists($alias,$incoming)&&(!array_key_exists($alias,$old)||$incoming[$alias]!==$old[$alias]))$changes[$alias]=$incoming[$alias];
  if(!$changes)continue;$values=array_values($changes);foreach($values as $v)if(!is_string($v)||$v!==$values[0])throw new DomainException('metadata_alias_conflict');
  foreach($aliases as $alias)$merged[$alias]=$values[0];
 }
 return $merged;
}
function nup_store(PDO $db,string $key,string $kind,array $payload,int $expected,string $actor):int{
 $encoded=json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
 if($expected===0){$q=$db->prepare("INSERT IGNORE INTO noa_documents(doc_key,kind,payload,revision,updated_by) VALUES(?,?,'{}',0,?)");$q->execute([$key,$kind,$actor]);}
 $q=$db->prepare('UPDATE noa_documents SET payload=?,revision=revision+1,updated_by=? WHERE doc_key=? AND kind=? AND revision=?');$q->execute([$encoded,$actor,$key,$kind,$expected]);if($q->rowCount()!==1)throw new DomainException('revision_conflict');
 $q=$db->prepare('INSERT INTO noa_document_history(doc_key,revision,payload,changed_by) VALUES(?,?,?,?)');$q->execute([$key,$expected+1,$encoded,$actor]);return $expected+1;
}
function nup_policy():array{return ['version'=>1,'priority'=>0,'storage'=>'mysql:noa_documents.payload; catalog versions are immutable source snapshots; JSON files are exports only','original'=>'K-POP 원곡의 EP 번호·제목·가사가 모든 EP 장르의 원본이다.','ep'=>'원곡 정보는 읽기 전용이며 장르 규칙에 따라 확정 제목과 장르 가사를 작성한다.','act'=>'ACT n은 EP (n−1)×10+1부터 n×10까지 10곡, EP 번호 오름차순이다.','playlist'=>'사연곡·커버곡 플레이리스트는 수록곡 수 제한 없이 지정 순서를 따른다.','rules'=>'0원칙 → 공통 제작 규칙 → 장르별 제작 규칙. 장르별 규칙도 저장·원곡 잠금·ACT 범위 규칙을 바꿀 수 없다.'];}
function nup_snapshot(PDO $db,string $key,string $root):array{
 $q=$db->prepare('SELECT kind,payload,revision FROM noa_documents WHERE doc_key=?');$q->execute([$key]);$r=$q->fetch(PDO::FETCH_ASSOC);if(!$r)throw new DomainException('not_found');$d=json_decode($r['payload'],true,512,JSON_THROW_ON_ERROR);
 $snapshot=['key'=>$key,'kind'=>$r['kind'],'revision'=>(int)$r['revision'],'record'=>$d];if(($d['packageType']??'')==='ep')$snapshot['original']=nup_original($db,$d);
 if(!is_dir($root)&&!mkdir($root,0700,true))throw new RuntimeException('package_directory');if(is_link($root))throw new RuntimeException('package_directory');
 $bytes=json_encode($snapshot,JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);$path=$root.'/'.hash('sha256',$key).'.json';$temp=tempnam($root,'.record-');if(!$temp)throw new RuntimeException('package_temp');try{chmod($temp,0600);if(file_put_contents($temp,$bytes,LOCK_EX)!==strlen($bytes)||hash_file('sha256',$temp)!==hash('sha256',$bytes)||!rename($temp,$path))throw new RuntimeException('package_snapshot');}finally{if(is_file($temp))unlink($temp);}
 return ['key'=>$key,'revision'=>(int)$r['revision'],'sha256'=>hash('sha256',$bytes),'bytes'=>strlen($bytes)];
}
/** Called inside the existing verified-media publication transaction. */
function nup_attach_asset(PDO $db,string $key,array $asset):void{
 $q=$db->prepare('SELECT kind,payload,revision FROM noa_documents WHERE doc_key=? FOR UPDATE');$q->execute([$key]);$r=$q->fetch(PDO::FETCH_ASSOC);if(!$r)return;$d=json_decode($r['payload'],true,512,JSON_THROW_ON_ERROR);if(empty($d['packageSchema']))return;
 $before=$d;$d['body']['uploadedAsset']=$asset;foreach(['audio'=>'audioFileLocation','cover'=>'cardImageLocation'] as $prefix=>$field)if(!empty($asset[$prefix.'_path']))$d['body'][$field]=$asset[$prefix.'_path'];if($before!==$d)nup_store($db,$key,$r['kind'],$d,(int)$r['revision'],'media-publisher');
}
function nup_validate_members(PDO $db,array $d):void{
 $pool=[];$aliases=[];foreach($db->query("SELECT alias_key,entity_id FROM noa_catalog_aliases WHERE batch_id=(SELECT batch_id FROM noa_catalog_batches WHERE status='applied' ORDER BY applied_at DESC,batch_id DESC LIMIT 1)") as $a)$aliases[$a['alias_key']]=$a['entity_id'];
 foreach($db->query("SELECT doc_key,payload FROM noa_documents WHERE kind IN ('single','story') ORDER BY doc_key") as $r){$p=json_decode($r['payload'],true);if(!empty($p['_noaTrash']))continue;$id=$aliases[$r['doc_key']]??preg_replace('/^catalog:/','',$r['doc_key']);$pool[$id][]=$p;if($id!==$r['doc_key'])$pool[$r['doc_key']][]=$p;}
 foreach($d['body']['members']??[] as $m){$candidates=$pool[$m['key']]??[];if(count($candidates)!==1)throw new InvalidArgumentException('member_missing_or_ambiguous');$p=$candidates[0];if(($p['genreId']??'')!==($d['genreId']??'')||(($d['packageType']??'')==='act'&&(int)($p['ep']??0)!==(int)($m['ep']??0)))throw new InvalidArgumentException('member_genre_or_ep_mismatch');}
}
/** Publication may add new songs; never replace an existing edited record. */
function nup_register_catalog(PDO $db,string $batch):int{
 $installed=$db->query("SELECT payload FROM noa_documents WHERE doc_key='meta:package-record-policy' AND kind='meta'")->fetchColumn();$policy=$installed?json_decode($installed,true):null;if(($policy['schema']??null)!==1||($policy['installed']??false)!==true)return 0;
 require_once __DIR__.'/sound-core.php';$q=$db->prepare("SELECT s.song_id,s.genre_id,s.ep,v.fields_json,v.public_verified FROM noa_catalog_songs s JOIN noa_catalog_versions v ON v.entity_id=s.song_id AND v.entity_type='song' WHERE v.batch_id=? AND NOT EXISTS (SELECT 1 FROM noa_documents d WHERE d.doc_key=CONCAT('catalog:',s.song_id)) AND NOT EXISTS (SELECT 1 FROM noa_catalog_aliases a JOIN noa_documents d ON d.doc_key=a.alias_key AND d.kind IN ('single','story') WHERE a.batch_id=v.batch_id AND a.entity_id=s.song_id) ORDER BY s.song_id");$q->execute([$batch]);$rows=$q->fetchAll(PDO::FETCH_ASSOC);$n=0;
 foreach($rows as $r){$d=noa_sound_catalog_document($r);if(!$d)throw new DomainException('invalid_catalog_song');unset($d['_kind'],$d['_catalog_id']);$d=nup_normalize($d,'story');if($d['packageType']==='ep'){$original=nup_original($db,$d);if(($original['status']??'')==='linked')$d['sourceRef']=$original['key'];}nup_store($db,'catalog:'.$r['song_id'],'story',$d,0,'catalog-register');$n++;}return $n;
}
