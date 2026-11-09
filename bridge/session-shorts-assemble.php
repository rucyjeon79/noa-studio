<?php
declare(strict_types=1);
if(!defined('_GNUBOARD_')){http_response_code(403);exit;}
require_once __DIR__.'/session-agent.php';
require_once __DIR__.'/session-shorts.php';
require_once __DIR__.'/session-agent-media.php';

/** Automatic editing belongs to the existing N80 campaign and agent_movie job. */
function nd_assembly_job(array $s,string $owner):array {
 $c=$s['campaigns']['daily_shorts']??[];$id=$c['current']['jobId']??'';$j=$s['jobs'][$id]??null;
 if(!$j||($j['type']??'')!=='agent_movie'||($j['agent']['owner']??'')!==$owner||($j['agent']['format']??'')!=='shorts')throw new DomainException('campaign_job_required');
 return $j;
}
function nd_assembly_enabled(array $s):bool {
 return !empty($s['config']['workerEnabled'])&&!empty($s['campaigns']['daily_shorts']['enabled']);
}
function nd_assembly_attach(array &$s,array $b,string $owner,callable $readSource):array {
 if(!nd_assembly_enabled($s))throw new DomainException('daily_shorts_paused');
 $id=lab_id((string)($b['id']??''));$j=$s['jobs'][$id]??null;$c=&$s['campaigns']['daily_shorts'];
 if(!$j||($j['type']??'')!=='agent_movie'||($j['agent']['owner']??'')!==$owner||($j['agent']['format']??'')!=='shorts'||in_array($j['state'],['saved','cancelled'],true))throw new DomainException('campaign_job_required');
 if(!$c['current']||!empty($c['current']['videoId'])||(!empty($c['current']['jobId'])&&$c['current']['jobId']!==$id))throw new DomainException('campaign_slot_busy');
 if(($c['current']['jobId']??'')===$id)return ['ok'=>true,'attached'=>true,'replayed'=>true];
 lab_revision($j,$b);sa_require_current($j,$readSource($j['trackKey']));
 $matches=array_filter($c['preparation']['report']['candidates']??[],fn($r)=>$r['trackKey']===$j['trackKey']&&$r['sourceRevision']===$j['sourceRevision']&&$r['audioSha256']===$j['audioSha256']&&$r['videoId']===($b['originalVideoId']??''));
 if(count($matches)!==1)throw new DomainException('campaign_source_mismatch');
 $c['current']['jobId']=$id;$c['current']['originalVideoId']=$b['originalVideoId'];$c['current']['state']=$j['state'];
 return ['ok'=>true,'attached'=>true,'replayed'=>false];
}
function nd_assembly_claim(array &$s,string $owner,int $now,callable $readSource):array {
 if(!nd_assembly_enabled($s))return ['ok'=>true,'claimed'=>false,'state'=>'paused'];
 if(empty($s['campaigns']['daily_shorts']['current']['jobId']))return ['ok'=>true,'claimed'=>false,'state'=>'campaign_job_required'];
 $snapshot=nd_assembly_job($s,$owner);$id=$snapshot['id'];$j=&$s['jobs'][$id];$a=&$j['agent'];$c=&$s['campaigns']['daily_shorts'];
 $next=sa_next($j);
 if(in_array($j['state'],['saved','cancelled','agent_paused'],true))return ['ok'=>true,'claimed'=>false,'state'=>$j['state']];
 if(($a['active']['kind']??'')==='final'&&($a['active']['phase']??'')==='received')return ['ok'=>true,'claimed'=>false,'state'=>'final_review_required'];
 $prior=$c['assembly']??[];
 $resume=($prior['jobId']??'')===$id&&($prior['operationId']??'')===($a['active']['requestId']??null)&&($a['active']['kind']??'')==='final';
 if($next['action']!=='assemble'&&!$resume)return ['ok'=>true,'claimed'=>false,'state'=>$next['action']];
 if(($a['leaseUntil']??0)>$now)return ['ok'=>true,'claimed'=>false,'state'=>'executor_busy'];
 sa_require_current($j,$readSource($j['trackKey']));
 if($resume&&($prior['attempts']??0)>=3)return ['ok'=>true,'claimed'=>false,'state'=>'assembly_retry_limit'];
 if(!$resume){
  if(($a['attempts']['final:0']??0)>=3)return ['ok'=>true,'claimed'=>false,'state'=>'assembly_retry_limit'];
  $a['attempts']['final:0']=($a['attempts']['final:0']??0)+1;
  $a['active']=['kind'=>'final','scene'=>0,'requestId'=>bin2hex(random_bytes(16)),'phase'=>'requested','startedAt'=>gmdate('c',$now)];
 }
 $a['lease']=bin2hex(random_bytes(24));$a['leaseUntil']=$now+1200;$a['session']=md5('n80_auto:assembly:'.$id);
 $j['state']='agent_working';lab_touch($j);
 $c['assembly']=['jobId'=>$id,'operationId'=>$a['active']['requestId'],'state'=>'assembling','attempts'=>$resume?($prior['attempts']??0)+1:1,'startedAt'=>gmdate('c',$now),'leaseUntil'=>$a['leaseUntil']];
 $m=sa_view($j,true)['assemblyTool']['manifest'];$m['scenes']=array_map(fn($r)=>['n'=>$r['n'],'sha256'=>$r['sha256']],$m['layout']['scenes']);
 return ['ok'=>true,'claimed'=>true,'id'=>$id,'operationId'=>$a['active']['requestId'],'lease'=>$a['lease'],'manifest'=>$m];
}
function nd_assembly_authorize(array $s,array $b,string $owner,int $now):array {
 if(!nd_assembly_enabled($s))throw new DomainException('daily_shorts_paused');
 $j=nd_assembly_job($s,$owner);$a=$j['agent'];$run=$s['campaigns']['daily_shorts']['assembly']??[];
 if(($b['id']??'')!==$j['id']||($b['operationId']??'')!==($run['operationId']??null)||($a['active']['requestId']??'')!==($run['operationId']??null)
  ||($a['active']['kind']??'')!=='final'||($a['leaseUntil']??0)<=$now||!is_string($b['lease']??null)||!hash_equals($a['lease']??'',$b['lease'])
  ||in_array($j['state'],['saved','cancelled','agent_paused'],true))throw new DomainException('assembly_lease_expired');
 return $j;
}
function nd_assembly_operation(array &$s,array $b,string $owner,int $now,callable $readSource):array {
 $snapshot=nd_assembly_authorize($s,$b,$owner,$now);$j=&$s['jobs'][$snapshot['id']];$a=&$j['agent'];$run=&$s['campaigns']['daily_shorts']['assembly'];
 sa_require_current($j,$readSource($j['trackKey']));$command=$b['command'];
 if($command==='assembly_fail'){
  if(($a['active']['phase']??'')==='received')return ['ok'=>true,'state'=>'final_review_required'];
  $run['state']='assembly_failed';$run['reason']=preg_match('/^[a-z_]{1,80}$/D',(string)($b['reason']??''))?$b['reason']:'assembly_failed';
  $a['leaseUntil']=0;$run['leaseUntil']=0;return ['ok'=>true,'state'=>$run['state']];
 }
 $a['leaseUntil']=$now+1200;$run['leaseUntil']=$a['leaseUntil'];
 if($command==='assembly_read'){
  $kind=$b['kind']??'';$n=$b['scene']??0;
  if($kind!=='audio'&&($kind!=='video'||!is_int($n)||empty($a['scenes'][$n-1]['video']['accepted'])))throw new DomainException('assembly_input_unavailable');
  return ['ok'=>true]+sa_file($j,['mode'=>'read','kind'=>$kind,'scene'=>$n,'offset'=>$b['offset']??null]);
 }
 if($command==='assembly_write'){
  $out=sa_file($j,array_merge($b,['mode'=>'write','kind'=>'final','scene'=>0,'sourceUrl'=>'']));
  if(!empty($out['done'])){$run['state']='final_review_required';$run['sha256']=$out['asset']['sha256'];$run['finishedAt']=gmdate('c',$now);}
  // Receipt proves automatic editing, not visual/listening approval or publication.
  return ['ok'=>true,'reviewRequired'=>true,'publicationReady'=>false]+$out;
 }
 throw new InvalidArgumentException('unknown_assembly_command');
}
function nd_assembly_dispatch(array $b,string $owner):array {
 if($owner==='')throw new DomainException('campaign_owner_required');
 if(($b['command']??'')==='assembly_attach')return lab_lock(fn(&$s)=>nd_assembly_attach($s,$b,$owner,'sa_source'));
 if(($b['command']??'')==='assembly_claim')return lab_lock(fn(&$s)=>nd_assembly_claim($s,$owner,time(),'sa_source'));
 return lab_lock(fn(&$s)=>nd_assembly_operation($s,$b,$owner,time(),'sa_source'));
}
