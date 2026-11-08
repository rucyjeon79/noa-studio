<?php
declare(strict_types=1);
require_once __DIR__.'/creative-core.php';
require_once __DIR__.'/suno-cover.php';
require_once dirname(__DIR__).'/noa-app/jukebox/upload-core.php';
function ncd_assets(PDO $db,array $r):array {$a=nj_find($db,$r['doc_key']);$source=noa_sound_suno($r['document']['body']);$audio=$a&&hash_equals((string)$a['source_url'],$source)&&nj_verified($a,'audio');$cover=$a&&hash_equals(nj_asset_source($a,'cover'),$source)&&nj_verified($a,'cover');return ['audioReady'=>$audio,'coverReady'=>$cover,'audio'=>$audio?nj_url($r['doc_key'],'audio'):'','cover'=>$cover?nj_url($r['doc_key'],'cover'):'','upload'=>nu_public($db,$r['doc_key'])['upload'],'status'=>nu_public($db,$r['doc_key'])['status'],'sha'=>['audio'=>$audio?$a['audio_sha256']:null,'cover'=>$cover?$a['cover_sha256']:null]];}
function ncd_cover(PDO $db,string $owner,array $b,string $bytes,?array $source=null):array {
 $webp=nsc_webp($bytes);
 return ncd_atomic($db,function()use($db,$owner,$b,$webp,$source){$r=ncd_row($db,$b['id'],$owner,true);ncd_editable($r,(int)($b['revision']??-1));$d=$r['document'];$suno=noa_sound_suno($d['body']);if($source&&$source['source']!==$suno)throw new DomainException('source_changed');$a=nj_find($db,$r['doc_key']);[$path,$sha]=nsc_file($a,$r['doc_key'],$webp);$ev=json_decode($a['source_evidence']??'{}',true)?:[];$ev['coverSourceUrl']=$suno;$ev['creativeDraft']=$b['id'];$ev['coverVerifiedAt']=gmdate('c');
  if($a)$db->prepare('UPDATE noa_jukebox_assets SET cover_path=?,cover_bytes=?,cover_sha256=?,source_evidence=? WHERE song_key=?')->execute([$path,strlen($webp),$sha,ncd_json($ev),$r['doc_key']]);
  else $db->prepare('INSERT INTO noa_jukebox_assets(song_key,source_url,cover_path,cover_bytes,cover_sha256,source_evidence) VALUES(?,?,?,?,?,?)')->execute([$r['doc_key'],$suno,$path,strlen($webp),$sha,ncd_json($ev)]);
  $d['body']['uploadedAsset']=nj_find($db,$r['doc_key']);$d['body']['cardImageLocation']=$path;if($source)$d['_creative']['verifiedUrls']['sunoUrl']=['url'=>$suno,'at'=>gmdate('c')];unset($d['_creative']['preview']);return ncd_put($db,$r,$d,$owner);
 });
}
function ncd_validation(PDO $db,array $r,bool $admin):array {
 $d=$r['document'];$c=$d['_creative'];$f=nup_fields($d);$issues=ncd_completion($d)['missing'];if(empty($c['intentConfirmed']))$issues[]='confirm_intent_first';if(!empty($c['needsReview']))$issues[]='review_related_fields';if(ncd_current_proposals($d))$issues[]='resolve_proposals';if(!empty($c['deletedAt']))$issues[]='draft_deleted';
 if(!in_array($d['genreId'],['kpop-original','your-story'],true))$issues[]='new_original_category_required';if($d['genreId']==='kpop-original'){if(!$admin)$issues[]='original_publish_admin_required';if(!preg_match('/^[1-9][0-9]{0,3}$/D',(string)$d['ep']))$issues[]='ep_required';
 $q=$db->prepare("SELECT 1 FROM noa_documents WHERE kind IN ('single','story') AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.genreId'))='kpop-original' AND CAST(JSON_UNQUOTE(JSON_EXTRACT(payload,'$.ep')) AS UNSIGNED)=? AND JSON_EXTRACT(payload,'$._noaTrash') IS NULL LIMIT 1");$q->execute([(int)$d['ep']]);if($q->fetchColumn())$issues[]='ep_already_exists';}
 $assets=ncd_assets($db,$r);if(!$assets['audioReady'])$issues[]='verified_audio_required';if(!$assets['coverReady'])$issues[]='verified_cover_required';
 foreach(['sunoUrl','youtubeUrl','mvUrl'] as $key)if($f[$key]!==''&&($c['verifiedUrls'][$key]['url']??'')!==$f[$key])$issues[]='verify_'.$key;
 $lists=nup_collections($db);$chosen=[];foreach($c['collections'] as $key){$list=$lists[$key]??null;if(!$list||!$list['available']||$list['genre']!==$d['genreId']||(!$admin&&($list['payload']['ownerId']??'')!==$d['ownerId']))$issues[]='collection_unavailable';else $chosen[$key]=['title'=>$list['title'],'revision'=>$list['revision']];}
 $key=$d['genreId']==='kpop-original'?'single:kpop-original:'.str_pad((string)(int)$d['ep'],2,'0',STR_PAD_LEFT):'creator:'.hash('sha256',$d['ownerId']).':'.$c['id'];
 return ['ready'=>!$issues,'issues'=>array_values(array_unique($issues)),'assets'=>$assets,'collections'=>$chosen,'key'=>$key,'category'=>$d['genreId']==='kpop-original'?'오리지널송':'당신의 이야기, 우리의 음악','act'=>$d['act'],'title'=>$f['title'],'lyrics'=>$f['lyrics'],'description'=>$f['description'],'sunoTitle'=>ncd_view($r)['sunoTitle']];
}
function ncd_preview(PDO $db,string $owner,array $b,bool $admin):array {return ncd_atomic($db,function()use($db,$owner,$b,$admin){$r=ncd_row($db,$b['id'],$owner,true);ncd_editable($r,(int)($b['revision']??-1));$v=ncd_validation($db,$r,$admin);$d=$r['document'];$d['_creative']['preview']=['token'=>bin2hex(random_bytes(16)),'validation'=>$v];$r=ncd_put($db,$r,$d,$owner);return ['draft'=>ncd_view($r),'preview'=>$d['_creative']['preview']];});}
function ncd_publish(PDO $db,string $owner,array $b,bool $admin):array {
 // Serialize original EP allocation and collection publication across drafts. No file copying in the transaction.
 if(!$db->query("SELECT GET_LOCK('n80_creative_publication',5)")->fetchColumn())throw new DomainException('publication_busy');
 try{return ncd_atomic($db,function()use($db,$owner,$b,$admin){$r=ncd_row($db,$b['id'],$owner,true);$d=$r['document'];$c=$d['_creative'];if(!empty($c['publication']))return ['draft'=>ncd_view($r),'publication'=>$c['publication']];ncd_editable($r,(int)($b['revision']??-1));$p=$c['preview']??null;if(!$p||!hash_equals($p['token'],(string)($b['token']??'')))throw new DomainException('preview_required');if(($b['rightsConfirmed']??false)!==true)throw new DomainException('rights_confirmation_required');$v=ncd_validation($db,$r,$admin);if(!$v['ready'])throw new DomainException('publication_not_ready');if(ncd_hash($v)!==ncd_hash($p['validation']))throw new DomainException('preview_changed');
  $q=$db->prepare('SELECT 1 FROM noa_documents WHERE doc_key=? FOR UPDATE');$q->execute([$v['key']]);if($q->fetchColumn())throw new DomainException('song_already_exists');
  $q=$db->prepare("SELECT 1 FROM noa_jukebox_uploads WHERE song_key=? AND status NOT IN ('ready','failed','canceled','cancelled') LIMIT 1 FOR UPDATE");$q->execute([$r['doc_key']]);if($q->fetchColumn())throw new DomainException('upload_busy');
  $song=$d;unset($song['_creative']);$song['creativeDraftId']=$b['id'];$song['visibility']='public';$song['confirmed']=true;$song['publishedAt']=gmdate('c');$asset=nj_find($db,$r['doc_key']);$asset['song_key']=$v['key'];$song['body']['uploadedAsset']=$asset;
  nup_store($db,$v['key'],$d['genreId']==='kpop-original'?'single':'story',$song,0,$owner);
  $columns=array_keys($asset);$db->prepare('INSERT INTO noa_jukebox_assets (`'.implode('`,`',$columns).'`) VALUES ('.implode(',',array_fill(0,count($columns),'?')).')')->execute(array_values($asset));
  $expected=array_map(fn($x)=>$x['revision'],$v['collections']);nup_apply_collections($db,$v['key'],$song,$c['collections'],$expected,$owner);
  $publication=['key'=>$v['key'],'category'=>$v['category'],'genre'=>$d['genreId'],'act'=>$d['act'],'collections'=>array_keys($v['collections']),'at'=>gmdate('c'),'href'=>'/noa-music.php?genre='.rawurlencode($d['genreId']).'&track='.rawurlencode($v['key'])];$d['_creative']['publication']=$publication;$d['_creative']['rightsConfirmedAt']=gmdate('c');$r=ncd_put($db,$r,$d,$owner);return ['draft'=>ncd_view($r),'publication'=>$publication];
 });}finally{$db->query("SELECT RELEASE_LOCK('n80_creative_publication')");}
}

function ncd_verify_video(PDO $db,string $owner,array $b):array {
 $r=ncd_row($db,$b['id'],$owner);ncd_editable($r,(int)($b['revision']??-1));$key=$b['field']??'';if(!in_array($key,['youtubeUrl','mvUrl'],true))throw new InvalidArgumentException('invalid_url_field');$url=nup_fields($r['document'])[$key];$u=parse_url($url);if(($u['scheme']??'')!=='https'||!in_array($u['host']??'',['youtube.com','www.youtube.com','m.youtube.com','youtu.be'],true)||isset($u['user'])||isset($u['port']))throw new InvalidArgumentException('invalid_media_host');
 $curl=curl_init('https://www.youtube.com/oembed?format=json&url='.rawurlencode($url));curl_setopt_array($curl,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_CONNECTTIMEOUT=>3,CURLOPT_TIMEOUT=>10,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS]);$raw=curl_exec($curl);$code=curl_getinfo($curl,CURLINFO_HTTP_CODE);curl_close($curl);$meta=$raw?json_decode($raw,true):null;if($code!==200||!is_array($meta)||($meta['type']??'')!=='video')throw new DomainException('video_verification_failed');
 return ncd_atomic($db,function()use($db,$owner,$b,$key,$url){$r=ncd_row($db,$b['id'],$owner,true);ncd_editable($r,(int)$b['revision']);$d=$r['document'];$d['_creative']['verifiedUrls'][$key]=['url'=>$url,'at'=>gmdate('c')];unset($d['_creative']['preview']);return ncd_put($db,$r,$d,$owner);});
}
