<?php
declare(strict_types=1);
require_once __DIR__.'/hub-release.php';
/** Owner-authenticated ChatGPT transport into Hub. No GitHub request or shell execution. */
function n80_hub_chatgpt_path(string $web,string $path):string {
 // Source only: private state, credentials, uploaded media and framework core stay outside this surface.
 if(preg_match('~(?:^|[/_.-])(?:secret|secrets|credential|credentials|password|token|private|env|dbconfig)(?:[/_.-]|$)~i',$path))throw new InvalidArgumentException('hub_private_path');
 return n80_hub_target($web,$path);
}
function n80_hub_chatgpt(string $root,string $web,array $body,string $owner):array {
 if($owner==='')throw new DomainException('hub_owner_required');
 $action=$body['action']??'';
 if($action==='release'){
  if(!is_int($body['revision']??null)||$body['revision']<0||!is_array($body['package']??null))throw new InvalidArgumentException('hub_package_invalid');
  foreach($body['package']['files']??[] as $row)n80_hub_chatgpt_path($web,(string)($row['path']??''));
  return n80_hub_release_apply($root,$web,$body['package'],$body['revision'])+['transport'=>'chatgpt_direct'];
 }
 if($action==='recover')return ['ok'=>n80_hub_release_recover($root,$web),'transport'=>'chatgpt_direct'];
 return n80_hub_locked($root,function()use($root,$web,$body,$action){
  $revision=(int)(n80_hub_read($root,'source.json')['revision']??0);
  if($action==='status'){
   $s=n80_hub_status($root);
   return ['ok'=>true,'module'=>'N80 Hub','transport'=>'chatgpt_direct','githubRequired'=>false,'sourceRevision'=>$revision,
    'runnerState'=>$s['runnerState'],'paused'=>$s['paused'],'heartbeatAt'=>$s['heartbeatAt'],'operations'=>$s['operations'],
    'recoveryRequired'=>(bool)n80_hub_read($root,'journal.json'),'releases'=>array_slice(n80_hub_read($root,'releases.json'),-5),
    'limits'=>['readBytes'=>131072,'fileBytes'=>4194304,'packageBytes'=>8388608,'packageFiles'=>100],
    'scope'=>'Application source and verified deployment; existing media, member data and private credentials excluded.'];
  }
  if($action==='receipt'){
   $id=$body['id']??'';if(!is_string($id)||!preg_match('/^[a-f0-9]{32}$/D',$id))throw new InvalidArgumentException('hub_release_id');
   foreach(n80_hub_read($root,'releases.json')as $r)if($r['id']===$id)return $r+['transport'=>'chatgpt_direct'];
   return ['ok'=>true,'found'=>false,'recoveryRequired'=>(bool)n80_hub_read($root,'journal.json')];
  }
  if($action==='manifest'){
   $paths=$body['paths']??null;if(!is_array($paths)||!array_is_list($paths)||count($paths)>100)throw new InvalidArgumentException('hub_invalid_paths');
   $files=[];foreach($paths as $path){if(!is_string($path))throw new InvalidArgumentException('hub_invalid_paths');$p=n80_hub_chatgpt_path($web,$path);$files[$path]=is_file($p)?['sha256'=>hash_file('sha256',$p),'bytes'=>filesize($p)]:null;}
   return ['ok'=>true,'revision'=>$revision,'files'=>$files];
  }
  if($action==='list'){
   $directory=$body['directory']??'';
   if(!is_string($directory)||($directory!==''&&!preg_match('~^noa-(?:app|bridge)(?:/[a-zA-Z0-9_-]+)*$~D',$directory)))throw new InvalidArgumentException('hub_invalid_directory');
   $folder=$web.($directory===''?'':'/'.$directory);
   if(is_link($folder)||!is_dir($folder)||realpath($folder)!==$folder)throw new InvalidArgumentException('hub_invalid_directory');
   $after=$body['after']??'';if(!is_string($after)||strlen($after)>240)throw new InvalidArgumentException('hub_invalid_cursor');
   $entries=[];
   foreach(scandir($folder)as $name){
    if($name==='.'||$name==='..'||str_starts_with($name,'.'))continue;
    $path=($directory===''?'':$directory.'/').$name;$p=$web.'/'.$path;
    if(is_link($p)||strcmp($path,$after)<=0)continue;
    if(is_dir($p)){
     if(!preg_match('~^noa-(?:app|bridge)(?:/[a-zA-Z0-9_-]+)*$~D',$path))continue;
     // Apply the same private-name rule to directories through a harmless hypothetical source path.
     try{n80_hub_chatgpt_path($web,$path.'/source.php');}catch(Throwable $e){continue;}
     $entries[]=['path'=>$path,'type'=>'directory'];
    }else{
     try{n80_hub_chatgpt_path($web,$path);}catch(Throwable $e){continue;}
     $entries[]=['path'=>$path,'type'=>'file','bytes'=>filesize($p)];
    }
   }
   usort($entries,fn($a,$b)=>strcmp($a['path'],$b['path']));$more=count($entries)>100;$entries=array_slice($entries,0,100);
   return ['ok'=>true,'revision'=>$revision,'entries'=>$entries,'nextAfter'=>$more?end($entries)['path']:null];
  }
  if($action==='read'){
   $path=$body['path']??null;$offset=$body['offset']??0;
   if(!is_string($path)||!is_int($offset)||$offset<0)throw new InvalidArgumentException('hub_invalid_read');
   $p=n80_hub_chatgpt_path($web,$path);if(!is_file($p))throw new DomainException('hub_source_missing');
   $content=(string)file_get_contents($p);$hash=hash('sha256',$content);$expected=$body['sha256']??null;
   if(($offset>0&&$expected===null)||($expected!==null&&$expected!==$hash))throw new DomainException('hub_source_changed');
   if($offset>strlen($content))throw new InvalidArgumentException('hub_invalid_offset');
   $part=substr($content,$offset,131072);$next=$offset+strlen($part);
   return ['ok'=>true,'revision'=>$revision,'path'=>$path,'sha256'=>$hash,'bytes'=>strlen($content),'offset'=>$offset,
    'data'=>base64_encode($part),'nextOffset'=>$next<strlen($content)?$next:null];
  }
  throw new InvalidArgumentException('hub_unknown_action');
 });
}
