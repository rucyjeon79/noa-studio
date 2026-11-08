<?php
declare(strict_types=1);
if(!defined('_GNUBOARD_')){http_response_code(403);exit;}
require_once __DIR__.'/lab-browser-assets.php';

/** Read only bounded MP4 metadata; never load a full-length movie into PHP memory. */
function sa_video_probe(string $path,bool $final=false):array {
 $size=filesize($path);if($size<256||$size>($final?512:32)*1048576||is_link($path))throw new InvalidArgumentException('invalid_video_size');
 $f=fopen($path,'rb');$offset=0;$moov=null;$ftyp=false;$mdat=false;$atoms=0;
 try{while($offset<$size){
  if(++$atoms>4096||$size-$offset<8)throw new InvalidArgumentException('invalid_clip_container');
  fseek($f,$offset);$header=fread($f,8);$length=unpack('N',substr($header,0,4))[1];$type=substr($header,4,4);
  if($length<8||$length>$size-$offset||$type==='moof')throw new InvalidArgumentException('invalid_clip_container');
  if($type==='ftyp'){$ftyp=true;if($length>1024)throw new InvalidArgumentException('invalid_clip_container');}
  if($type==='mdat'&&$length>8)$mdat=true;
  if($type==='moov'){if($moov!==null||$length>8*1048576)throw new InvalidArgumentException('invalid_clip_container');$moov=$header.fread($f,$length-8);if(strlen($moov)!==$length)throw new InvalidArgumentException('invalid_clip_container');}
  $offset+=$length;
 }}finally{fclose($f);}
 if(!$ftyp||!$mdat||$moov===null)throw new InvalidArgumentException('invalid_clip_container');
 $video=[];$audio=[];$top=['p'=>8,'end'=>strlen($moov)];
 foreach(lab_browser_children($moov,$top) as $trak){
  if($trak['type']!=='trak')continue;$mdia=lab_browser_box(lab_browser_children($moov,$trak),'mdia');$children=lab_browser_children($moov,$mdia);
  $hdlr=lab_browser_box($children,'hdlr');$type=substr($moov,$hdlr['p']+8,4);if(!in_array($type,['vide','soun'],true))continue;
  $mdhd=lab_browser_box($children,'mdhd');$p=$mdhd['p'];if($mdhd['end']-$p<24||ord($moov[$p])!==0)throw new InvalidArgumentException('unsupported_clip_container');
  $scale=unpack('N',substr($moov,$p+12,4))[1];$ticks=unpack('N',substr($moov,$p+16,4))[1];if(!$scale||!$ticks)throw new InvalidArgumentException('invalid_clip_duration');
  $minf=lab_browser_box($children,'minf');$mc=lab_browser_children($moov,$minf);$dinf=lab_browser_box($mc,'dinf');$dref=lab_browser_box(lab_browser_children($moov,$dinf),'dref');
  if($dref['end']-$dref['p']<8||unpack('N',substr($moov,$dref['p']+4,4))[1]!==1)throw new InvalidArgumentException('external_clip_reference');
  $ref=lab_browser_box(lab_browser_boxes($moov,$dref['p']+8,$dref['end']),'url ');
  if($ref['end']-$ref['p']!==4||substr($moov,$ref['p'],4)!=="\0\0\0\1")throw new InvalidArgumentException('external_clip_reference');
  $stbl=lab_browser_box($mc,'stbl');$stsd=lab_browser_box(lab_browser_children($moov,$stbl),'stsd');
  if($stsd['end']-$stsd['p']<8||unpack('N',substr($moov,$stsd['p']+4,4))[1]!==1)throw new InvalidArgumentException('unsupported_clip_codec');
  $entry=lab_browser_box(lab_browser_boxes($moov,$stsd['p']+8,$stsd['end']),$type==='vide'?'avc1':'mp4a');
  if($type==='soun'){$audio[]=$ticks/$scale;continue;}
  if($entry['end']-$entry['p']<78)throw new InvalidArgumentException('invalid_clip_container');
  $video[]=['width'=>unpack('n',substr($moov,$entry['p']+24,2))[1],'height'=>unpack('n',substr($moov,$entry['p']+26,2))[1],'duration'=>$ticks/$scale];
 }
 if(count($video)!==1||($final&&count($audio)!==1))throw new InvalidArgumentException('invalid_video_streams');$v=$video[0];
 if($v['duration']<=0||$v['duration']>($final?3600.1:30.05)||min($v['width'],$v['height'])<128||max($v['width'],$v['height'])>3840)throw new InvalidArgumentException('invalid_video_dimensions');
 return $v+['bytes'=>$size,'sha256'=>hash_file('sha256',$path),'extension'=>'mp4','audioDuration'=>$audio[0]??null,
  'checks'=>['containerValid'=>true,'decodedByServer'=>false,'fullMusicVideo'=>$final]];
}
function sa_media_source(string $kind,string $url):string {
 if($kind==='final'){if($url!=='')throw new InvalidArgumentException('invalid_media_source');return '';}
 $u=parse_url($url);$host=$kind==='image'?'gemini.google.com':'flow.google.com';
 if(($u['scheme']??'')!=='https'||($u['host']??'')!==$host||isset($u['user'])||isset($u['pass'])||isset($u['port'])||strlen($url)>1000)throw new InvalidArgumentException('invalid_media_source');
 return $url;
}
function sa_file(array &$j,array $b):array {
 $mode=$b['mode']??'';$a=&$j['agent'];$offset=$b['offset']??null;
 if(!is_int($offset)||$offset<0||$offset>512*1048576)throw new InvalidArgumentException('invalid_file_offset');
 if($mode==='read'){
  $kind=$b['kind']??'';$n=(int)($b['scene']??0);
  if($kind==='audio'){$path=$j['source']['audioPath'];$sha=$j['audioSha256'];}
  else{$asset=$kind==='final'?($j['outputs'][0]??(($a['active']['kind']??'')==='final'?($a['active']['asset']??null):null)):($a['scenes'][$n-1][$kind]??null);
   if(!in_array($kind,['image','video','final'],true)||!$asset)throw new DomainException('asset_not_available');$path=lab_job_dir($j['id']).'/'.$asset['file'];$sha=$asset['sha256'];}
  if(!is_file($path)||is_link($path)||!hash_equals($sha,hash_file('sha256',$path)))throw new DomainException('asset_checksum_mismatch');
  $size=filesize($path);if($offset>$size)throw new InvalidArgumentException('invalid_file_offset');$f=fopen($path,'rb');fseek($f,$offset);$data=fread($f,min(524288,max(1,$size-$offset)));fclose($f);
  return ['data'=>base64_encode($data),'offset'=>$offset,'nextOffset'=>$offset+strlen($data),'bytes'=>$size,'sha256'=>$sha,'done'=>$offset+strlen($data)===$size];
 }
 if($mode!=='write')throw new InvalidArgumentException('invalid_file_mode');
 $active=&$a['active'];if(!$active||($b['operationId']??'')!==$active['requestId'])throw new DomainException('operation_not_requested');
 $kind=$active['kind'];$sha=$b['sha256']??'';$bytes=$b['bytes']??null;
 if(!is_string($sha)||!preg_match('/^[a-f0-9]{64}$/D',$sha)||!is_int($bytes)||$bytes<256||$bytes>($kind==='final'?512:($kind==='image'?16:32))*1048576)throw new InvalidArgumentException('invalid_asset');
 $data=isset($b['data'])&&is_string($b['data'])?base64_decode($b['data'],true):false;
 if($data===false||strlen($data)<1||strlen($data)>524288||$offset+strlen($data)>$bytes)throw new InvalidArgumentException('invalid_asset_chunk');
 $source=sa_media_source($kind,(string)($b['sourceUrl']??''));$meta=['sha256'=>$sha,'bytes'=>$bytes,'sourceUrl'=>$source];
 if(isset($active['upload'])&&$active['upload']!==$meta)throw new DomainException('asset_upload_changed');$active['upload']=$meta;
 $dir=lab_job_dir($j['id']);$partial=$dir.'/transfer-'.$active['requestId'].'.part';
 if($active['phase']==='received')$partial=$dir.'/'.$active['asset']['file'];
 clearstatcache(true,$partial);$current=is_file($partial)?filesize($partial):0;
 if(is_link($partial)||$offset>$current)throw new DomainException('asset_chunk_out_of_order');
 if($offset<$current){$f=fopen($partial,'rb');fseek($f,$offset);$existing=fread($f,strlen($data));fclose($f);if($existing!==$data)throw new DomainException('asset_chunk_conflict');}
 else{if(file_put_contents($partial,$data,FILE_APPEND)!==strlen($data))throw new RuntimeException('asset_write_failed');chmod($partial,0600);$current+=strlen($data);}
 if($current<$bytes)return ['nextOffset'=>$current,'done'=>false];
 if($current!==$bytes||!hash_equals($sha,hash_file('sha256',$partial)))throw new DomainException('asset_checksum_mismatch');
 if($active['phase']==='received')return ['nextOffset'=>$bytes,'done'=>true,'asset'=>$active['asset'],'replayed'=>true];
 if($kind==='image'){
  $info=getimagesize($partial);$ext=match($info[2]??0){IMAGETYPE_PNG=>'png',IMAGETYPE_JPEG=>'jpg',IMAGETYPE_WEBP=>'webp',default=>null};
  if(!$ext||min($info[0],$info[1])<128||max($info[0],$info[1])>8192)throw new InvalidArgumentException('invalid_image');
  $asset=['width'=>$info[0],'height'=>$info[1],'extension'=>$ext,'sha256'=>$sha,'bytes'=>$bytes];
 }else{$asset=sa_video_probe($partial,$kind==='final');
  if($kind==='video'&&$asset['duration']<=2*$a['timing']['overlapSeconds'])throw new DomainException('clip_too_short');
  if($kind==='final'){
   $layout=sa_layout($j);$v=$b['verification']??[];$dims=$a['format']==='landscape'?[1280,720]:[720,1280];
   if(!$layout['ready']||[$asset['width'],$asset['height']]!==$dims||abs($asset['duration']-$j['source']['duration'])>.125||abs(($asset['audioDuration']??0)-$j['source']['duration'])>.125
    ||($v['decoded']??false)!==true||($v['audioMapped']??false)!==true||($v['sourceAudioSha256']??'')!==$j['audioSha256']
    ||($v['sceneHashes']??[])!==array_column($layout['scenes'],'sha256'))throw new DomainException('final_validation_failed');
   $asset['checks']['decodedByAgent']=true;$asset['checks']['originalAudioVerified']=true;$asset['checks']['durationMatched']=true;
  }
 }
 $name=$kind==='final'?$a['format'].'-'.$sha.'.mp4':$kind.'-'.$active['scene'].'-'.$sha.'.'.$asset['extension'];$target=$dir.'/'.$name;
 if(is_link($target)||(is_file($target)&&!hash_equals($sha,hash_file('sha256',$target))))throw new DomainException('asset_identity_conflict');
 // Keep the resumable transfer until review: a failed state commit must not lose the upload cursor.
 if(!is_file($target)&&!copy($partial,$target))throw new RuntimeException('asset_store_failed');chmod($target,0600);
 $asset+=['file'=>$name,'sourceUrl'=>$source,'accepted'=>false];$active['asset']=$asset;$active['phase']='received';
 if($kind!=='final')$a['scenes'][$active['scene']-1][$kind]=$asset;
 $j['state']='agent_review';lab_touch($j);return ['nextOffset'=>$bytes,'done'=>true,'asset'=>$asset,'revision'=>$j['revision']];
}
