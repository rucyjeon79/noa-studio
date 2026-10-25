<?php
declare(strict_types=1);
require_once __DIR__.'/youtube-store.php';require_once __DIR__.'/sound-core.php';require_once __DIR__.'/inline-edit.php';
function nup_json(mixed $v):string{return json_encode($v,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);}
function nup_inventory(PDO $db,string $orderPath):array{
 $docs=$db->query("SELECT doc_key,kind,payload,revision FROM noa_documents WHERE kind IN ('single','story','playlist') OR doc_key LIKE 'meta:inline-%' ORDER BY doc_key")->fetchAll(PDO::FETCH_ASSOC);
 $batch=$db->query("SELECT batch_id FROM noa_catalog_batches WHERE status='applied' ORDER BY applied_at DESC,batch_id DESC LIMIT 1")->fetchColumn();
 $q=$db->prepare('SELECT alias_key,entity_id FROM noa_catalog_aliases WHERE batch_id=? ORDER BY alias_key');$q->execute([$batch]);$aliases=$q->fetchAll(PDO::FETCH_ASSOC);
 $q=$db->prepare("SELECT s.song_id,s.genre_id,s.ep,v.fields_json,v.public_verified FROM noa_catalog_songs s JOIN noa_catalog_versions v ON v.entity_id=s.song_id AND v.entity_type='song' WHERE v.batch_id=? ORDER BY s.song_id");$q->execute([$batch]);$catalog=$q->fetchAll(PDO::FETCH_ASSOC);
 $assets=$db->query('SELECT * FROM noa_jukebox_assets ORDER BY song_key')->fetchAll(PDO::FETCH_ASSOC);
 $order=is_file($orderPath)?(string)file_get_contents($orderPath):'{}';$parsed=json_decode($order,true,512,JSON_THROW_ON_ERROR);if(!is_array($parsed))throw new DomainException('invalid_order_storage');
 $run=ny_latest($db);$videos=$run?array_filter(ny_videos($db,$run),static fn($v)=>($v['status']['privacyStatus']??'')==='public'&&($v['status']['embeddable']??false)===true):[];
 $originals=$db->query("SELECT source_path,sha256,source_bytes FROM noa_source_files WHERE source_path LIKE '원곡정보/kpop-original/%.json' ORDER BY source_path")->fetchAll(PDO::FETCH_ASSOC);
 return ['videos'=>$videos,'youtubeRun'=>$run['run_id']??null,'originals'=>$originals,'documents'=>$docs,'batch'=>$batch,'aliases'=>$aliases,'catalog'=>$catalog,'assets'=>$assets,'order'=>$parsed,'orderSha256'=>hash('sha256',$order)];
}
function nup_plan(array $inventory):array{
 $docs=[];$oldEdits=[];$aliases=array_column($inventory['aliases'],'entity_id','alias_key');$covered=[];$review=[];
 foreach($inventory['documents'] as $r){$d=json_decode($r['payload'],true,512,JSON_THROW_ON_ERROR);if($r['kind']==='meta'){$oldEdits[$r['doc_key']]=$d['fields']??[];continue;}$docs[$r['doc_key']]=['kind'=>$r['kind'],'revision'=>(int)$r['revision'],'before'=>$d,'record'=>$d];if(isset($aliases[$r['doc_key']]))$covered[$aliases[$r['doc_key']]]=true;}
 foreach($inventory['catalog'] as $r){$key='catalog:'.$r['song_id'];if(isset($covered[$r['song_id']])||isset($docs[$key]))continue;$d=noa_sound_catalog_document($r);if(!$d)throw new DomainException('invalid_catalog_song');unset($d['_kind'],$d['_catalog_id']);$docs[$key]=['kind'=>'story','revision'=>0,'before'=>null,'record'=>$d];}
 foreach($inventory['order']['playlists']??[] as $p){$key='playlist:custom:'.$p['id'];if(isset($docs[$key]))continue;$d=['title'=>$p['title'],'genreId'=>$p['group']==='story'?'your-story':'cover-reborn','visibility'=>'public','customPlaylistId'=>$p['id'],'body'=>['confirmedTitle'=>$p['title'],'members'=>array_map(fn($key)=>['key'=>$key],$p['keys']),'creationRequestId'=>$p['requestId']??'']];$docs[$key]=['kind'=>'playlist','revision'=>0,'before'=>null,'record'=>$d];}
 $masters=[];$identities=[];foreach($docs as $key=>$r){$d=$r['record'];if($r['kind']==='playlist')continue;$identity=$aliases[$key]??preg_replace('/^catalog:/','',$key);if(isset($identities[$identity]))throw new DomainException('ambiguous_canonical_song');$identities[$identity]=$key;if(($d['genreId']??'')==='kpop-original'&&(int)($d['ep']??0)>0)$masters[(int)$d['ep']][]=$key;}
 $bySong=[];foreach($inventory['videos']??[] as $v){$sid=$v['match']['songId']??null;if($sid&&!in_array($v['match']['status']??'',['rejected','ambiguous'],true))$bySong[$sid][]=$v;}
 $originals=[];foreach($inventory['originals']??[] as $o){if(hash('sha256',$o['source_bytes'])!==$o['sha256'])throw new DomainException('original_source_checksum');$data=json_decode($o['source_bytes'],true,512,JSON_THROW_ON_ERROR);$n=(int)($data['n']??pathinfo($o['source_path'],PATHINFO_FILENAME));if($n>0)$originals[$n]=['ep'=>str_pad((string)$n,2,'0',STR_PAD_LEFT),'title'=>(string)($data['title']??''),'lyrics'=>(string)($data['lyrics']??''),'vocal'=>(string)($data['vocal']??'')];}
 $assetMap=array_column($inventory['assets'],null,'song_key');$counts=[];$changes=[];
 foreach($docs as $key=>$r){$d=nup_normalize($r['record'],$r['kind']);$type=$d['packageType'];if($type==='original'&&empty($r['record']['body']['originalInfo'])&&isset($originals[(int)($d['ep']??0)]))$d['body']['originalInfo']=$originals[(int)$d['ep']];$identity=$aliases[$key]??preg_replace('/^catalog:/','',$key);$legacyKey=$r['kind']==='playlist'?nie_meta_key('act',($d['genreId']??'').':'.(int)($d['act']??0)):nie_meta_key('song',nie_song_id($identity));
  if(empty($r['record']['packageSchema'])){
   $candidates=$bySong[$identity]??[];$video=null;foreach($candidates as $v)if(str_contains((string)($d['body']['youtubeUrl']??''),(string)$v['id']))$video=$v;if(!$video&&count($candidates)===1)$video=$candidates[0];
   if($video){$d['body']['youtubeSourceSnapshot']=['run'=>$inventory['youtubeRun'],'id'=>$video['id'],'title'=>(string)($video['snippet']['title']??''),'description'=>(string)($video['snippet']['description']??'')];if(!isset($r['record']['body']['youtubeDescription']))$d['body']['youtubeDescription']=(string)($video['snippet']['description']??'');if(empty($d['body']['youtubeTitle']))$d['body']['youtubeTitle']=(string)($video['snippet']['title']??'');}
  }
  if(empty($r['record']['packageSchema'])&&!empty($oldEdits[$legacyKey]))$d=nup_patch($d,$r['kind'],$oldEdits[$legacyKey]);
  if($type==='ep'){if(count($masters[(int)($d['ep']??0)]??[])===1)$d['sourceRef']=$masters[(int)$d['ep']][0];else $review[]=['key'=>$key,'reason'=>'original_missing_or_ambiguous'];}
  if(isset($assetMap[$key])&&empty($r['record']['packageSchema'])){$a=$assetMap[$key];$d['body']['uploadedAsset']=$a;foreach(['audio'=>'audioFileLocation','cover'=>'cardImageLocation'] as $prefix=>$field)if(!empty($a[$prefix.'_path']))$d['body'][$field]=$a[$prefix.'_path'];}
  if($type==='act'&&empty($d['body']['members'])){
   $members=[];foreach($docs as $memberKey=>$m){$p=$m['record'];$ep=(int)($p['ep']??0);if($m['kind']!=='playlist'&&($p['genreId']??'')===$d['genreId']&&$ep>=$d['epRange']['from']&&$ep<=$d['epRange']['to'])$members[]=['key'=>$aliases[$memberKey]??preg_replace('/^catalog:/','',$memberKey),'ep'=>$ep,'title'=>(string)($p['body']['confirmedTitle']??$p['title']??'')];}
   usort($members,fn($a,$b)=>$a['ep']<=>$b['ep']);$d['body']['members']=$members;$eps=array_column($members,'ep');if($eps!==range($d['epRange']['from'],$d['epRange']['to']))$review[]=['key'=>$key,'reason'=>'act_incomplete_or_duplicate_ep','present'=>$eps,'expected'=>[$d['epRange']['from'],$d['epRange']['to']]];
  }
  $counts[$type]=($counts[$type]??0)+1;
  if($r['before']!==$d)$changes[$key]=['kind'=>$r['kind'],'revision'=>$r['revision'],'record'=>$d];
 }
 ksort($changes);return ['sourceHash'=>hash('sha256',nup_json($inventory)),'changes'=>$changes,'counts'=>$counts,'review'=>$review];
}
function nup_apply(PDO $db,array $plan,string $orderPath,string $root):array{
 $db->query("SELECT GET_LOCK('noa_catalog_publication',10)")->fetchColumn()==1||throw new DomainException('publication_busy');
 try{
  $db->beginTransaction();$db->query("SELECT doc_key FROM noa_documents WHERE kind IN ('single','story','playlist') OR doc_key LIKE 'meta:inline-%' ORDER BY doc_key FOR UPDATE")->fetchAll();$db->query('SELECT song_key FROM noa_jukebox_assets ORDER BY song_key FOR UPDATE')->fetchAll();
  $inventory=nup_inventory($db,$orderPath);if(hash('sha256',nup_json($inventory))!==$plan['sourceHash'])throw new DomainException('source_changed_replan_required');
  $backup=nup_json($inventory);$backupPath=$root.'/before-'.$plan['sourceHash'].'.json';if(!is_dir($root)&&!mkdir($root,0700,true))throw new RuntimeException('backup_directory');if(is_link($root))throw new RuntimeException('backup_directory');
  if(!is_file($backupPath)){$handle=fopen($backupPath,'x');if(!$handle)throw new RuntimeException('backup_create');chmod($backupPath,0600);fwrite($handle,$backup);fclose($handle);}if(hash_file('sha256',$backupPath)!==hash('sha256',$backup))throw new RuntimeException('backup_readback_failed');
  $q=$db->query("SELECT payload,revision FROM noa_documents WHERE doc_key='meta:package-record-policy' FOR UPDATE");$installed=$q->fetch(PDO::FETCH_ASSOC);if($installed){$policy=json_decode($installed['payload'],true);if(($policy['schema']??null)!==1||($policy['installed']??null)!==true)throw new DomainException('installation_policy_conflict');}
  else nup_store($db,'meta:package-record-policy','meta',['schema'=>1,'installed'=>true,'principleZero'=>nup_policy()],0,'unified-migration');
  foreach($plan['changes'] as $key=>$r)nup_store($db,$key,$r['kind'],$r['record'],$r['revision'],'unified-migration');
  $db->commit();$files=[];foreach($db->query("SELECT doc_key FROM noa_documents WHERE kind IN ('single','story','playlist') ORDER BY doc_key") as $r)$files[]=nup_snapshot($db,$r['doc_key'],$root.'/records');
  // Verify every activated file on the host, then transfer one checked manifest
  // instead of hundreds of sequential SFTP round trips across regions.
  if(count(glob($root.'/records/*.json'))!==count($files))throw new RuntimeException('unexpected_record_file_count');
  foreach($files as $file){$path=$root.'/records/'.hash('sha256',$file['key']).'.json';if(is_link($path)||(fileperms($path)&0777)!==0600||filesize($path)!==$file['bytes']||hash_file('sha256',$path)!==$file['sha256'])throw new RuntimeException('record_file_readback_failed');$saved=json_decode((string)file_get_contents($path),true,512,JSON_THROW_ON_ERROR);if(($saved['key']??null)!==$file['key']||($saved['revision']??null)!==$file['revision']||($saved['record']['packageSchema']??null)!==1)throw new RuntimeException('record_file_content_mismatch');}
  $manifest=nup_json($files);$temporary=tempnam($root,'.manifest-');if(!$temporary)throw new RuntimeException('manifest_temp');chmod($temporary,0600);if(file_put_contents($temporary,$manifest)!==strlen($manifest)||!rename($temporary,$root.'/manifest.json')||hash_file('sha256',$root.'/manifest.json')!==hash('sha256',$manifest))throw new RuntimeException('manifest_readback_failed');
  return ['ok'=>true,'changed'=>count($plan['changes']),'counts'=>$plan['counts'],'review'=>$plan['review'],'backupSha256'=>hash('sha256',$backup),'files'=>count($files),'fileReadbackVerified'=>true,'allMode0600'=>true,'manifestSha256'=>hash_file('sha256',$root.'/manifest.json'),'oldMediaAndSourceArchivesPreserved'=>true];
 }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}finally{$db->query("SELECT RELEASE_LOCK('noa_catalog_publication')");}
}
