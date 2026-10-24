<?php
declare(strict_types=1);
/** Cheap catalog availability; stream/download still verify full SHA-256 before delivery. */
function noa_music_asset_url(array $assets,string $key,string $source,string $type):string{
 if(!in_array($type,['audio','cover'],true))return '';
 $r=$assets[$key]??null;
 if(!$r||!hash_equals((string)$r['source_url'],$source)||($type==='audio'&&$r['status']!=='ready'))return '';
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
 try{foreach($db->query("SELECT s.song_id,s.identity_json,s.genre_id,s.ep,v.fields_json,v.public_verified FROM noa_catalog_songs s JOIN noa_catalog_versions v ON v.entity_id=s.song_id AND v.entity_type='song' WHERE v.batch_id=(SELECT batch_id FROM noa_catalog_batches WHERE status='applied' ORDER BY applied_at DESC,batch_id DESC LIMIT 1)") as $r){
  $item=noa_sound_recovered($r,true);if(!$item)continue;$key=$item['key'];$body=json_decode($r['fields_json'],true);
  $out[$key]=$overrides[$key]??['_kind'=>'story','_catalog_id'=>$r['song_id'],'title'=>$item['title'],'genreId'=>$item['genre'],'ep'=>$item['ep'],'act'=>'','visibility'=>$r['public_verified']?'public':'private','body'=>$body+['sunoUrl'=>$item['sunoUrl']]];
 }}catch(PDOException $e){error_log('[music-catalog] recovery unavailable');}
 return $out;
}
function noa_music_detail_fields(array $document):array{
 $b=$document['body']??[];if(!is_array($b))$b=[];
 return ['rawLyrics'=>(string)($b['lyricsBlock']??''),'description'=>(string)($b['songDescription']??$b['descriptionBlock']??((($b['source']['platform']??'')==='youtube')?'':($b['description']??'')))];
}
