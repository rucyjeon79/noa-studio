<?php
/** Private Google Drive spool. Audio chunks pass through memory, never hosting disk. */
declare(strict_types=1);
if(!defined('_GNUBOARD_')){http_response_code(403);exit;}
const ND_FOLDER='1hR8n8sH7d7ekoWqiwK11bAIYY3m9C6-l';
const ND_CHUNK=4194304;
function nd_config():array{
 $p=nj_private().'/drive-token.json';
 if(is_link($p)||!is_file($p))throw new DomainException('drive_storage_not_connected');
 $c=json_decode((string)file_get_contents($p),true);
 if(!is_array($c)||($c['folder_id']??'')!==ND_FOLDER||empty($c['access_token'])||(int)($c['expires_at']??0)<time()+60)throw new DomainException('drive_storage_not_connected');
 return $c;
}
function nd_enabled():bool{return is_file(nj_private().'/drive-token.json');}
function nd_is(array $u):bool{return (json_decode($u['context']??'{}',true)['uploadStorage']??'')==='google_drive';}
function nd_state(string $id):array{$p=nu_dir($id).'/drive.json';if(is_link($p))throw new DomainException('unsafe_upload_directory');return is_file($p)?(json_decode((string)file_get_contents($p),true,32,JSON_THROW_ON_ERROR)?:[]):[];}
function nd_save(string $id,array $s):void{$p=nu_dir($id).'/drive.json';$t=$p.'.tmp';$data=json_encode($s,JSON_THROW_ON_ERROR);if(is_link($p)||is_link($t)||file_put_contents($t,$data,LOCK_EX)!==strlen($data))throw nu_storage_error();chmod($t,0600);if(!rename($t,$p))throw nu_storage_error();}
function nd_url(string $url):bool{$p=parse_url($url);return ($p['scheme']??'')==='https'&&($p['host']??'')==='www.googleapis.com'&&!isset($p['port'])&&!isset($p['user'])&&!isset($p['pass'])&&preg_match('~^/(?:upload/)?drive/v3/files(?:/|$|\?)~',($p['path']??''))===1;}
function nd_http(string $method,string $url,?string $body=null,array $headers=[]):array{
 if(!nd_url($url))throw new DomainException('invalid_drive_endpoint');
 if(defined('NOA_DRIVE_TEST')&&PHP_SAPI==='cli'&&isset($GLOBALS['nd_http']))return ($GLOBALS['nd_http'])($method,$url,$body,$headers);
 $c=nd_config();$h=curl_init($url);$responseHeaders=[];$headers[]='Authorization: Bearer '.$c['access_token'];$headers[]='Expect:';
 curl_setopt_array($h,[CURLOPT_CUSTOMREQUEST=>$method,CURLOPT_RETURNTRANSFER=>true,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_TIMEOUT=>45,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_HTTPHEADER=>$headers,CURLOPT_HEADERFUNCTION=>static function($h,$line)use(&$responseHeaders){$pair=explode(':',$line,2);if(count($pair)===2)$responseHeaders[strtolower(trim($pair[0]))]=trim($pair[1]);return strlen($line);}]);
 if($body!==null)curl_setopt($h,CURLOPT_POSTFIELDS,$body);
 $raw=curl_exec($h);$code=(int)curl_getinfo($h,CURLINFO_RESPONSE_CODE);curl_close($h);
 if($raw===false||$code===429||$code>=500)throw new RuntimeException('drive_transfer_retry');
 if($code===401)throw new DomainException('drive_storage_not_connected');
 if($code===403){$reason=json_decode($raw,true)['error']['errors'][0]['reason']??'';throw new DomainException($reason==='storageQuotaExceeded'?'drive_storage_quota_exceeded':'drive_storage_access_denied');}
 return ['code'=>$code,'headers'=>$responseHeaders,'data'=>json_decode($raw,true)?:[]];
}
function nd_meta(array $s):array{return nd_http('GET','https://www.googleapis.com/drive/v3/files/'.rawurlencode($s['file_id']).'?fields=id,size,sha256Checksum,parents,appProperties,trashed');}
function nd_validate(array $u,array $m):string{
 if(($m['id']??'')!==(nd_state($u['id'])['file_id']??'')||(int)($m['size']??-1)!==(int)$u['file_bytes']||!in_array(ND_FOLDER,$m['parents']??[],true)||($m['appProperties']['noa_upload_id']??'')!==$u['id']||!empty($m['trashed'])||!preg_match('/^[a-f0-9]{64}$/D',$m['sha256Checksum']??''))throw new DomainException('drive_source_verification_failed');
 return $m['sha256Checksum'];
}
function nd_start(array $u):array{
 $s=nd_state($u['id']);if(!empty($s['session'])||!empty($s['complete']))return $s;
 if(empty($s['file_id'])){$r=nd_http('GET','https://www.googleapis.com/drive/v3/files/generateIds?count=1&space=drive&type=files');$id=$r['data']['ids'][0]??'';if($r['code']!==200||!preg_match('/^[A-Za-z0-9_-]{10,200}$/D',$id))throw new RuntimeException('drive_id_unavailable');$s=['file_id'=>$id,'received'=>0,'hashes'=>[],'complete'=>false];nd_save($u['id'],$s);}
 $meta=['id'=>$s['file_id'],'name'=>$u['id'].'.'.$u['extension'],'parents'=>[ND_FOLDER],'appProperties'=>['noa_upload_id'=>$u['id']]];
 $r=nd_http('POST','https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,size,sha256Checksum,parents,appProperties,trashed',json_encode($meta,JSON_THROW_ON_ERROR),['Content-Type: application/json; charset=UTF-8','X-Upload-Content-Type: application/octet-stream','X-Upload-Content-Length: '.$u['file_bytes']]);
 if($r['code']===409){$m=nd_meta($s);$sha=nd_validate($u,$m['data']);$s+=['sha256'=>$sha];$s['complete']=true;$s['received']=(int)$u['file_bytes'];nd_save($u['id'],$s);return $s;}
 $url=$r['headers']['location']??'';if(!in_array($r['code'],[200,201],true)||!nd_url($url))throw new RuntimeException('drive_session_unavailable');$s['session']=$url;nd_save($u['id'],$s);return $s;
}
function nd_accept(array $u,array $s,array $r):array{
 if(in_array($r['code'],[200,201],true)){$s['sha256']=nd_validate($u,$r['data']);$s['complete']=true;$s['received']=(int)$u['file_bytes'];unset($s['pending']);}
 elseif($r['code']===308){$range=$r['headers']['range']??'';$received=preg_match('/^bytes=0-([0-9]+)$/D',$range,$m)?(int)$m[1]+1:0;if($received<(int)$s['received']||$received>(int)$u['file_bytes'])throw new DomainException('drive_source_verification_failed');$s['received']=$received;unset($s['pending']);}
 elseif(in_array($r['code'],[404,410],true))throw new DomainException('drive_session_expired');
 else throw new RuntimeException('drive_transfer_retry');
 nd_save($u['id'],$s);return $s;
}
function nd_resume(array $u,bool $refresh=true,bool $locked=false):array{
 if($refresh&&!$locked){$lock=fopen(nu_dir($u['id']).'/.lock','c');if(!$lock||!flock($lock,LOCK_EX))throw new RuntimeException('upload_lock_failed');try{return nd_resume($u,true,true);}finally{flock($lock,LOCK_UN);fclose($lock);}}
 $s=nd_state($u['id']);if($refresh&&!empty($s['pending'])&&!empty($s['session']))$s=nd_accept($u,$s,nd_http('PUT',$s['session'],'',['Content-Range: bytes */'.$u['file_bytes'],'Content-Length: 0']));
 $n=!empty($s['complete'])?(int)$u['total_chunks']:intdiv((int)($s['received']??0),ND_CHUNK);$chunks=$n>0?range(0,$n-1):[];$hashes=[];foreach($chunks as $i)if(isset($s['hashes'][$i]))$hashes[(string)$i]=$s['hashes'][$i];
 return ['id'=>$u['id'],'chunks'=>$chunks,'chunkHashes'=>(object)$hashes,'status'=>$u['status'],'chunkSize'=>ND_CHUNK,'storage'=>'google_drive'];
}
function nd_chunk(PDO $db,array $u,int $index,string $raw):array{
 $id=$u['id'];$lock=fopen(nu_dir($id).'/.lock','c');if(!$lock||!flock($lock,LOCK_EX))throw new RuntimeException('upload_lock_failed');
 try{if(nu_row($db,$id)['status']!=='uploading')throw new DomainException('upload_not_accepting_chunks');$s=nd_start($u);$start=$index*ND_CHUNK;$end=$start+strlen($raw);$hash=hash('sha256',$raw);
  if($index<0||$index>=(int)$u['total_chunks']||strlen($raw)!==min(ND_CHUNK,(int)$u['file_bytes']-$start))throw new InvalidArgumentException('chunk_size_mismatch');
  if(isset($s['hashes'][$index])&&!hash_equals($s['hashes'][$index],$hash))throw new DomainException('chunk_conflict');
  if(!empty($s['pending'])){nd_resume($u,true,true);$s=nd_state($id);}
  if((int)$s['received']>=$end)return ['index'=>$index,'sha256'=>$hash];
  if((int)$s['received']<$start||(int)$s['received']>$end)throw new DomainException('upload_incomplete');
  if($index===0){$wave=substr($raw,0,4)==='RIFF'&&substr($raw,8,4)==='WAVE';$mp3=str_starts_with($raw,'ID3')||(ord($raw[0])===255&&(ord($raw[1])&224)===224);if(($u['extension']==='wav'&&!$wave)||($u['extension']==='mp3'&&!$mp3))throw new InvalidArgumentException('actual_audio_format_mismatch');}
  $skip=(int)$s['received']-$start;if($skip>0){$raw=substr($raw,$skip);$start+=$skip;}
  $s['hashes'][$index]=$hash;$s['pending']=true;nd_save($id,$s);
  $s=nd_accept($u,$s,nd_http('PUT',$s['session'],$raw,['Content-Type: application/octet-stream','Content-Range: bytes '.$start.'-'.($end-1).'/'.$u['file_bytes']]));
  if((int)$s['received']<$end)throw new RuntimeException('drive_transfer_retry');
  $db->prepare('UPDATE noa_jukebox_uploads SET updated_at=CURRENT_TIMESTAMP WHERE id=?')->execute([$id]);return ['index'=>$index,'sha256'=>$hash];
 }finally{flock($lock,LOCK_UN);fclose($lock);}
}
function nd_finish(PDO $db,array $u):array{
 $lock=fopen(nu_dir($u['id']).'/.lock','c');if(!$lock||!flock($lock,LOCK_EX))throw new RuntimeException('upload_lock_failed');
 try{$u=nu_row($db,$u['id']);if($u['status']!=='uploading')return nu_public($db,$u['song_key']);nd_resume($u,true,true);$s=nd_state($u['id']);if(empty($s['complete']))throw new DomainException('upload_incomplete');$m=nd_meta($s);$sha=nd_validate($u,$m['data']);
  $old=nj_find($db,$u['song_key']);$before=json_decode($old['source_analysis']??'null',true);
  if(nj_verified($old,'audio')&&($before['sha256']??'')===$sha){$db->prepare("UPDATE noa_jukebox_uploads SET status='ready',sha256=? WHERE id=?")->execute([$sha,$u['id']]);return nu_public($db,$u['song_key']);}
  $db->prepare("UPDATE noa_jukebox_uploads SET sha256=?,error=NULL WHERE id=? AND status='uploading'")->execute([$sha,$u['id']]);nq_enqueue($db,$u);return nu_public($db,$u['song_key']);
 }finally{flock($lock,LOCK_UN);fclose($lock);}
}
function nu_source_exists(array $u):bool{if(nd_is($u)){$s=nd_state($u['id']);return !empty($s['complete'])&&empty($s['deleted'])&&!empty($s['sha256']);}$p=nu_dir($u['id']).'/input.audio';return is_file($p)&&!is_link($p);}
function nu_cleanup_verified(PDO $db,string $id):array{
 $lock=fopen(nu_dir($id).'/.lock','c');if(!$lock||!flock($lock,LOCK_EX))throw new RuntimeException('upload_lock_failed');
 try{$u=nu_row($db,$id);$a=nj_find($db,$u['song_key']);$before=json_decode($a['source_analysis']??'null',true);
  if($u['status']!=='ready'||!nj_verified($a,'audio')||empty($u['sha256'])||!hash_equals($u['sha256'],(string)($before['sha256']??'')))throw new DomainException('cleanup_final_not_verified');
  if(nd_is($u)){$s=nd_state($id);if(empty($s['deleted'])){$meta=nd_meta($s);if($meta['code']!==404){$sha=nd_validate($u,$meta['data']);if(!hash_equals($u['sha256'],$sha))throw new DomainException('cleanup_source_changed');$r=nd_http('DELETE','https://www.googleapis.com/drive/v3/files/'.rawurlencode($s['file_id']));if(!in_array($r['code'],[204,404],true))throw new RuntimeException('drive_cleanup_pending');}$s['deleted']=true;unset($s['session']);nd_save($id,$s);}}
  else{$p=nu_dir($id).'/input.audio';if(is_link($p))throw new DomainException('cleanup_source_changed');if(is_file($p)){if((int)filesize($p)!==(int)$u['file_bytes']||!hash_equals($u['sha256'],hash_file('sha256',$p)))throw new DomainException('cleanup_source_changed');nu_clean($u);if(!unlink($p))throw nu_storage_error();}}
  return ['input_removed'=>true,'source_retained'=>false,'retention_policy'=>'delete_after_verified_publication'];
 }finally{flock($lock,LOCK_UN);fclose($lock);}
}
