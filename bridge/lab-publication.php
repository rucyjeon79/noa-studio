<?php
declare(strict_types=1);
if(!defined('_GNUBOARD_')){http_response_code(403);exit;}
/** Only complete, checksum-addressed files may become visible through native state. */
function lab_final_name(string $format,string $sha):string {
 if(!in_array($format,['optimized','landscape','shorts'],true)||!preg_match('/^[a-f0-9]{64}$/D',$sha))throw new InvalidArgumentException('invalid_output');
 return $format.'-'.$sha.($format==='optimized'?'.audio':'.mp4');
}
function lab_output_path(array $job,string $format):string {
 if(in_array($format,['input','female','male'],true))return lab_job_dir($job['id']).'/'.$format.'.audio';
 $meta=$format==='optimized'?($job['mastering']??$job['pendingMaster']??null):null;
 if(!$meta)foreach(array_merge($job['outputs']??[],array_values($job['pendingOutputs']??[])) as $out)if(($out['format']??'')===$format){$meta=$out;break;}
 $file=isset($meta['file'])?lab_final_name($format,(string)($meta['sha256']??'')):($format==='optimized'?'optimized.audio':$format.'.mp4');
 return lab_job_dir($job['id']).'/'.$file;
}
function lab_final_output(array &$j,array $body,bool $commit):array {
 $format=(string)($body['format']??'');$sha=(string)($body['sha256']??'');$file=lab_final_name($format,$sha);$bytes=$body['bytes']??null;$manifest=$body['manifest']??null;
 if(!is_int($bytes)||$bytes<1||$bytes>525336576||!is_array($manifest)||empty($manifest['checks']['valid']))throw new InvalidArgumentException('invalid_output');
 if(($format==='optimized'&&$j['state']!=='mastering_audio')||($format!=='optimized'&&($j['state']!=='rendering'||!in_array($format,$j['settings']['formats'],true))))throw new DomainException('invalid_stage_transition');
 if($format!=='optimized'&&(!is_numeric($manifest['duration']??null)||$manifest['duration']<=0||$manifest['duration']>60.05))throw new InvalidArgumentException('invalid_output');
 $reservation=['file'=>$file,'sha256'=>$sha,'bytes'=>$bytes,'manifest'=>$manifest];
 if(!$commit){$j['finalReservations'][$format]=$reservation;return ['file'=>$file];}
 $final=array_replace($manifest,['file'=>$file,'sha256'=>$sha,'format'=>$format]);
 $prior=$format==='optimized'?($j['pendingMaster']??null):($j['pendingOutputs'][$format]??null);
 if(($j['finalReservations'][$format]??null)!==$reservation&&$prior!==$final)throw new DomainException('publication_reservation_changed');
 $path=lab_job_dir($j['id']).'/'.$file;
 if(is_link($path)||!is_file($path)||filesize($path)!==$bytes||!hash_equals($sha,hash_file('sha256',$path)))throw new DomainException('output_checksum_mismatch');
 if($format==='optimized')$j['pendingMaster']=$final;else $j['pendingOutputs'][$format]=$final;
 unset($j['finalReservations'][$format]);return ['file'=>$file,'verified'=>true];
}
