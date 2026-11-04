<?php
declare(strict_types=1);
const NWC_TTL=900;
function nwc_reply(int $code,array $body):never{
 http_response_code($code);echo json_encode($body,JSON_UNESCAPED_UNICODE|JSON_INVALID_UTF8_SUBSTITUTE);exit;
}
function nwc_store(string $dir,callable $change):mixed{
 if(!is_dir($dir)&&!@mkdir($dir,0700,true)&&!is_dir($dir))throw new RuntimeException('storage');
 $lock=fopen($dir.'/listening-care.lock','c');if(!$lock||!flock($lock,LOCK_EX))throw new RuntimeException('lock');
 try{
  $file=$dir.'/listening-care.json';
  $state=is_file($file)?json_decode(file_get_contents($file),true,32,JSON_THROW_ON_ERROR):[];
  $before=$state;$now=time();
  $state['jobs']=array_filter($state['jobs']??[],static fn($j)=>$j['expires']>$now);
  $result=$change($state);
  if($before!==$state){
   $tmp=tempnam($dir,'care-');
   try{if(!$tmp||file_put_contents($tmp,json_encode($state,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR))===false||!rename($tmp,$file))throw new RuntimeException('storage');}
   finally{if($tmp&&is_file($tmp))unlink($tmp);}
  }
  return $result;
 }finally{fclose($lock);}
}
function nwc_public(array $job):array{
 $status=$job['state'];$out=['id'=>$job['id'],'state'=>$status,'expires'=>$job['expires']];
 if($status==='ready')$out+=['message'=>$job['message'],'keys'=>$job['keys']];
 return $out;
}
function nwc_enqueue(array &$s,string $id,string $owner,array $payload):array{
 $jobs=$s['jobs'];$now=time();
 if(isset($jobs[$id])){
  if($jobs[$id]['owner']!==$owner)throw new DomainException('missing');
  return [false,nwc_public($jobs[$id])];
 }
 if(($s['pausedUntil']??0)>$now)throw new DomainException('quota');
 $recent=0;$active=0;
 foreach($jobs as $j){
  $busy=in_array($j['state'],['queued','working'],true);
  if($busy)++$active;
  if($j['owner']===$owner){
   if($busy)throw new DomainException('pending');
   if($j['created']>$now-45)throw new DomainException('slow_down');
   ++$recent;
  }
 }
 if($active>=8||$recent>=5)throw new DomainException('slow_down');
 $job=['id'=>$id,'owner'=>$owner,'state'=>'queued','created'=>$now,'expires'=>$now+NWC_TTL,'payload'=>$payload];
 $s['jobs'][$id]=$job;return [true,nwc_public($job)];
}
function nwc_worker(array &$s,string $id,string $action,array $body,callable $eligible):array{
 if(!isset($s['jobs'][$id]))return ['ok'=>true];
 $job=&$s['jobs'][$id];
 if($action==='claim'){
  if($job['state']!=='queued')return ['ok'=>true];
  if(!$eligible($job['owner'])){unset($s['jobs'][$id]);return ['ok'=>true];}
  $job['state']='working';$payload=$job['payload'];
  // The runner sees anonymous music choices, never the account name or local record keys.
  $job['candidates']=array_column($payload['tracks'],'key');unset($job['payload']);
  foreach($payload['tracks'] as &$row)unset($row['key']);unset($row);
  return ['ok'=>true,'job'=>$payload];
 }
 if($job['state']!=='working')return ['ok'=>true];
 if($action==='save'){
  $text=$body['message']??null;$order=$body['order']??null;
  if(!is_string($text)||trim($text)===''||mb_strlen($text)>500||!is_array($order)||!array_is_list($order)||count($order)<1||count($order)>3)throw new DomainException('invalid');
  $keys=[];
  foreach($order as $i){
   if(!is_int($i)||!isset($job['candidates'][$i])||in_array($job['candidates'][$i],$keys,true))throw new DomainException('invalid');
   $keys[]=$job['candidates'][$i];
  }
  $job['state']='ready';$job['message']=trim($text);$job['keys']=$keys;
 }else{
  $why=$body['reason']??'failed';$job['state']=in_array($why,['quota','unverified_credits','unavailable'],true)?$why:'failed';
  if($why==='quota')$s['pausedUntil']=time()+300;
 }
 unset($job['candidates']);return ['ok'=>true];
}
