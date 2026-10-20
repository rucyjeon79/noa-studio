<?php
/** Serve verified channel thumbnails; never audio/video streams or arbitrary URLs. */
declare(strict_types=1);require_once dirname(__DIR__).'/common.php';require_once __DIR__.'/storage.php';require_once __DIR__.'/youtube-store.php';
header('X-Content-Type-Options: nosniff');$id=(string)($_GET['id']??'');if(!preg_match('/^[A-Za-z0-9_-]{11}$/D',$id)){http_response_code(404);exit;}
try{$db=noa_bridge_pdo();$run=ny_latest($db);if(!$run){http_response_code(404);exit;}$q=$db->prepare('SELECT payload FROM noa_youtube_videos WHERE run_id=? AND video_id=?');$q->execute([$run['run_id'],$id]);$v=json_decode($q->fetchColumn()?:'null',true);$admin=!empty($is_member)&&($is_admin??'')==='super';if(!$v||($v['snippet']['channelId']??'')!==$run['channel_id']||!$admin&&($v['status']['privacyStatus']??'')!=='public'){http_response_code(404);exit;}
 $path=lab_root().'/thumbnail-'.hash('sha256',$id).'.jpg';$bytes=is_file($path)&&filemtime($path)>=time()-86400?file_get_contents($path):false;
 if($bytes===false){foreach(['high','medium','default','maxres'] as $size){$url=$v['snippet']['thumbnails'][$size]['url']??'';$u=parse_url($url);if(($u['scheme']??'')!=='https'||($u['host']??'')!=='i.ytimg.com'||!str_starts_with($u['path']??'','/vi/'.$id.'/'))continue;
  $curl=curl_init($url);$body='';curl_setopt_array($curl,[CURLOPT_RETURNTRANSFER=>false,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_CONNECTTIMEOUT=>3,CURLOPT_TIMEOUT=>8,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,CURLOPT_WRITEFUNCTION=>function($c,$chunk)use(&$body){if(strlen($body)+strlen($chunk)>3000000)return 0;$body.=$chunk;return strlen($chunk);}]);$ok=curl_exec($curl);$status=curl_getinfo($curl,CURLINFO_RESPONSE_CODE);curl_close($curl);$info=$ok&&$status===200?@getimagesizefromstring($body):false;
  if($info&&($info['mime']??'')==='image/jpeg'&&$info[0]>0){$bytes=$body;$temp=tempnam(lab_root(),'.thumb-');chmod($temp,0600);file_put_contents($temp,$bytes);rename($temp,$path);break;}
 }}
 if(!is_string($bytes)||$bytes===''){http_response_code(404);exit;}header('Content-Type: image/jpeg');header('Cache-Control: private, max-age=300');header('Content-Length: '.strlen($bytes));echo $bytes;
}catch(Throwable $e){http_response_code(503);error_log('[noa-thumbnail] '.get_class($e));}
