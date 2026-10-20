<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/common.php';require_once __DIR__.'/lab-core.php';lab_admin();
try{
 $id=lab_id((string)($_GET['id']??''));$format=(string)($_GET['format']??'');if(!in_array($format,['input','optimized','landscape','shorts'],true))throw new InvalidArgumentException();$s=lab_read();$job=$s['jobs'][$id]??null;
 $exists=$job&&($format==='input'?!empty($job['inputReady']):($format==='optimized'?!empty($job['mastering']):!!array_filter($job['outputs']??[],fn($o)=>$o['format']===$format)));if(!$exists)lab_json(404,['error'=>'output_missing']);
 $audio=in_array($format,['input','optimized'],true);$path=lab_job_dir($id).'/'.($audio?$format.'.audio':$format.'.mp4');if(!is_file($path))lab_json(404,['error'=>'output_missing']);$size=filesize($path);$start=0;$end=$size-1;header('Accept-Ranges: bytes');
 if(isset($_SERVER['HTTP_RANGE'])){if(!preg_match('/^bytes=([0-9]+)-([0-9]*)$/D',$_SERVER['HTTP_RANGE'],$m))lab_json(416,['error'=>'invalid_range']);$start=(int)$m[1];$end=$m[2]!==''?min($end,(int)$m[2]):$end;if($start>$end){http_response_code(416);exit;}http_response_code(206);header("Content-Range: bytes $start-$end/$size");}
 header('Content-Type: '.($audio?(new finfo(FILEINFO_MIME_TYPE))->file($path):'video/mp4'));header('Content-Length: '.($end-$start+1));header('Cache-Control: private, no-store');$extension=$format==='optimized'?($job['mastering']['extension']??'wav'):($format==='input'?'audio':'mp4');header('Content-Disposition: '.(isset($_GET['download'])?'attachment':'inline').'; filename="NOA-'.$id.'-'.$format.'.'.$extension.'"');session_write_close();$f=fopen($path,'rb');fseek($f,$start);$remaining=$end-$start+1;while($remaining>0&&!feof($f)){$part=fread($f,min(1048576,$remaining));echo $part;$remaining-=strlen($part);}fclose($f);exit;
}catch(Throwable $e){lab_json(400,['error'=>'invalid_file']);}
