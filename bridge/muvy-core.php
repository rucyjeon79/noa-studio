<?php
declare(strict_types=1);
if(!defined('_GNUBOARD_')){http_response_code(403);exit;}
require_once __DIR__.'/muvy-prompts.php';
const MU_SOURCE='c4303f80288a7f696eb9164f0900c50b61829554';
function mu_defaults():array{return ['revision'=>0,'projects'=>[],'usage'=>[]];}
function mu_lock(callable $fn):mixed{
 $root=lab_root();$lock=fopen($root.'/muvy.lock','c+');if(!$lock||!flock($lock,LOCK_EX))throw new RuntimeException('storage_lock');
 try{$path=$root.'/muvy.json';$s=is_file($path)?json_decode(file_get_contents($path),true,512,JSON_THROW_ON_ERROR):mu_defaults();$r=$fn($s);$s['revision']++;$temp=tempnam($root,'.muvy-');if($temp===false)throw new RuntimeException('storage_write');chmod($temp,0600);$raw=json_encode($s,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);if(file_put_contents($temp,$raw)!==strlen($raw)||!rename($temp,$path))throw new RuntimeException('storage_write');return $r;}finally{flock($lock,LOCK_UN);fclose($lock);}
}
function mu_read():array{$path=lab_root().'/muvy.json';if(!is_file($path))return mu_defaults();$lock=fopen(lab_root().'/muvy.lock','c+');if(!$lock||!flock($lock,LOCK_SH))throw new RuntimeException('storage_lock');try{return json_decode(file_get_contents($path),true,512,JSON_THROW_ON_ERROR);}finally{flock($lock,LOCK_UN);fclose($lock);}}
function mu_config():array{$s=lab_read();$secrets=lab_unseal($s['secrets']??null);$c=$s['muvyConfig']??[];return ['revision'=>$s['muvyConfigRevision']??0,'configured'=>!empty($secrets['xaiKey']),'enabled'=>($c['enabled']??false)===true,'model'=>$c['model']??'grok-4.5','dailyCalls'=>$c['dailyCalls']??20];}
function mu_status(string $id=''):array{$s=mu_read();$rows=[];foreach(array_reverse($s['projects'],true)as $p)$rows[]=['id'=>$p['id'],'title'=>$p['pack']['title'],'ep'=>$p['pack']['ep'],'updatedAt'=>$p['updatedAt'],'revision'=>$p['revision']];$p=$id!==''?($s['projects'][lab_id($id)]??null):null;if($id!==''&&!$p)throw new InvalidArgumentException('unknown_project');return ['config'=>mu_config(),'projects'=>$rows,'project'=>$p?mu_public_project($p):null,'callsToday'=>(int)($s['usage'][gmdate('Y-m-d')]??0),'source'=>MU_SOURCE];}
function mu_settings(array $b):array{return lab_lock(function(&$s)use($b){if(($b['expectedRevision']??null)!==($s['muvyConfigRevision']??0))throw new DomainException('revision_conflict');$secrets=lab_unseal($s['secrets']??null);if(isset($b['key'])&&$b['key']!==''){$key=mu_text($b['key'],4096);if(preg_match('/[\s\r\n]/',$key))throw new InvalidArgumentException('invalid_key');$secrets['xaiKey']=$key;}$model=mu_text($b['model']??'grok-4.5',80);if(!preg_match('/^[A-Za-z0-9._-]+$/D',$model))throw new InvalidArgumentException('invalid_model');$limit=$b['dailyCalls']??20;if(!is_int($limit)||$limit<1||$limit>100)throw new InvalidArgumentException('invalid_limit');$enabled=($b['enabled']??false)===true;if($enabled&&empty($secrets['xaiKey']))throw new DomainException('xai_key_required');$s['secrets']=lab_seal($secrets);$s['muvyConfig']=['model'=>$model,'enabled'=>$enabled,'dailyCalls'=>$limit];$s['muvyConfigRevision']=($s['muvyConfigRevision']??0)+1;lab_event($s,'muvy_settings_updated','',(string)$GLOBALS['member']['mb_id']);return ['ok'=>true];});}
function mu_save(array $b,bool $openExisting=false):array{
 $pack=mu_pack($b['pack']??[]);$id=lab_id((string)($b['id']??''));$expected=$b['expectedRevision']??null;if(!is_int($expected))throw new InvalidArgumentException('revision_required');
 return mu_lock(function(&$s)use($id,$pack,$expected,$openExisting){$old=$s['projects'][$id]??null;if($openExisting&&$old)return ['project'=>$old];if($old&&$old['pack']===$pack&&$expected===$old['revision']-1)return ['project'=>$old,'replayed'=>true];if(($old['revision']??0)!==$expected)throw new DomainException('revision_conflict');if($old&&!empty($old['active']))throw new DomainException('generation_in_progress');if(!$old&&count($s['projects'])>=30)throw new DomainException('project_limit');$p=$old??['id'=>$id,'revision'=>0,'createdAt'=>gmdate('c'),'source'=>MU_SOURCE,'operations'=>[],'active'=>null];$p['pack']=$pack;$p['revision']++;$p['updatedAt']=gmdate('c');$s['projects'][$id]=$p;return ['project'=>$p];});
}
/** Resolve once per selection. The project's source is a snapshot of the selected edition. */
function mu_select_song(array $record):array{
 if(!in_array($record['kind']??'',['single','story'],true)||!empty($record['payload']['_noaTrash']))throw new DomainException('song_unavailable');
 $fields=$record['fields'];
 $lyrics=trim((string)($fields['lyrics']??''));
 if(mb_strlen($lyrics)<10)throw new DomainException('song_lyrics_required');
 $ep=trim((string)($record['context']['ep']??''));
 $song=['key'=>$record['writeKey'],'genre'=>$record['context']['genre']??''];
 foreach(['vocal'=>1200,'cast'=>1200,'description'=>3000] as $name=>$limit){
  $song[$name]=mb_substr(trim((string)($fields[$name==='description'?'songDescription':$name]??'')),0,$limit);
 }
 $pack=mu_pack(['ep'=>ctype_digit($ep)?((int)$ep>0?'EP.'.$ep:''):$ep,'title'=>$fields['title'],'lyrics'=>$lyrics,'song'=>$song]);
 // An unrelated catalog edit must not duplicate a paid job. A changed lyric or edition must fork it.
 $id=substr(hash('sha256',"muvy-song-v1\0".json_encode($pack,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)),0,32);
 return mu_save(['id'=>$id,'expectedRevision'=>0,'pack'=>$pack],true);
}
/** Native project operations are the queue. No second queue or web provider execution. */
function mu_next_stage(array $pack):?array {
 if(count($pack['cuts'])!==30)return ['script',0];
 foreach([1,2,3] as $chapter)foreach([0,1] as $batch){foreach(array_slice($pack['cuts'],($chapter-1)*10+$batch*5,5) as $cut)if(empty($cut['gemini'])||empty($cut['grok']))return ['c'.$chapter,$batch];}
 return empty($pack['publish'])?['publish',0]:null;
}
function mu_enqueue(array &$s,array &$p,string $request,string $stage,int $batch,string $note,array $config,string $fingerprint,?string $pipeline=null):void {
 mu_prompt($p['pack'],$stage,$batch,$note); // Validate before reserving the request.
 $today=gmdate('Y-m-d');if(($s['usage'][$today]??0)>=$config['dailyCalls'])throw new DomainException('daily_limit');
 $s['usage']=array_filter($s['usage'],fn($date)=>$date>=gmdate('Y-m-d',time()-31*86400),ARRAY_FILTER_USE_KEY);
 $s['usage'][$today]=($s['usage'][$today]??0)+1;
 $p['active']=$request;$p['operations'][$request]=['fingerprint'=>$fingerprint,'state'=>'queued','stage'=>$stage,'batch'=>$batch,'note'=>$note,'model'=>$config['model'],'queuedAt'=>time(),'pipeline'=>$pipeline];
 $p['operations']=array_slice($p['operations'],-60,null,true);$p['updatedAt']=gmdate('c');
}
function mu_begin(array $b):array {
 $id=lab_id((string)($b['id']??''));$request=lab_id((string)($b['requestId']??''));$stage=mu_text($b['stage']??null,12);$batch=(int)($b['batch']??0);$note=mu_text($b['note']??'',400,true);$expected=$b['expectedRevision']??null;$c=mu_config();$pipeline=($b['pipeline']??false)===true;$modern=($b['runtimeContract']??0)===2;
 return mu_lock(function(&$s)use($id,$request,$stage,$batch,$note,$expected,$c,$pipeline,$modern){
  if(!isset($s['projects'][$id]))throw new InvalidArgumentException('unknown_project');$p=&$s['projects'][$id];$fingerprint=hash('sha256',json_encode([$stage,$batch,$note,$expected,$pipeline]));
  if(isset($p['operations'][$request])){if($p['operations'][$request]['fingerprint']!==$fingerprint)throw new DomainException('request_conflict');return ['replayed'=>true,'project'=>$p];}
  if(!$c['configured']||!$c['enabled'])throw new DomainException('xai_enable_required');
  if($p['revision']!==$expected)throw new DomainException('revision_conflict');if(!empty($p['active']))throw new DomainException('generation_in_progress');
  if($pipeline){$next=mu_next_stage($p['pack']);if(!$next)return ['replayed'=>true,'project'=>$p];[$stage,$batch]=$next;}
  unset($p['pipelineError']);mu_enqueue($s,$p,$request,$stage,$batch,$note,$c,$fingerprint,$pipeline?$request:null);
  // The previous endpoint treats replay as an already accepted operation and must not invoke its old provider.
  return ['replayed'=>!$modern,'queued'=>true,'project'=>$p];
 });
}
function mu_worker_claim():array {
 $c=mu_config();if(!$c['configured']||!$c['enabled'])return ['ok'=>true,'task'=>null,'state'=>'disabled'];
 if(empty(lab_read()['config']['workerEnabled']))return ['ok'=>true,'task'=>null,'state'=>'disabled'];
 $result=mu_lock(function(&$s){
  foreach($s['projects'] as &$p){$request=$p['active']??null;if(!$request)continue;$op=&$p['operations'][$request];
   // A provider may have charged after a lost reply. Never call it again automatically.
   if($op['state']==='running'&&($op['leaseUntil']??($op['startedAt']??time())+300)<time()){$op['state']='unconfirmed';$op['error']='provider_unconfirmed';unset($op['lease']);$p['active']=null;$p['revision']++;continue;}
   if($op['state']!=='queued')continue;
   [$system,$user,$tokens]=mu_prompt($p['pack'],$op['stage'],$op['batch'],$op['note']??'');
   $op['state']='running';$op['lease']=bin2hex(random_bytes(16));$op['startedAt']=time();$op['leaseUntil']=time()+300;
   return ['ok'=>true,'state'=>'running','task'=>['id'=>$p['id'],'request'=>$request,'lease'=>$op['lease'],'pack'=>$p['pack'],'system'=>$system,'user'=>$user,'tokens'=>$tokens,'stage'=>$op['stage'],'batch'=>$op['batch'],'model'=>$op['model']]];
  }unset($p);return ['ok'=>true,'task'=>null,'state'=>'idle'];
 });
 if($result['task'])$result['credential']=lab_unseal(lab_read()['secrets']??null)['xaiKey'];return $result;
}
function mu_finish(array $task,?array $result,?string $error=null):array {
 $id=lab_id((string)($task['id']??''));$request=lab_id((string)($task['request']??''));$lease=(string)($task['lease']??'');$config=mu_config();
 return mu_lock(function(&$s)use($id,$request,$lease,$result,$error,$config){
  if(!isset($s['projects'][$id]['operations'][$request]))throw new DomainException('operation_changed');$p=&$s['projects'][$id];$op=&$p['operations'][$request];
  $hash=hash('sha256',json_encode([$result,$error],JSON_THROW_ON_ERROR));
  if(isset($op['completionHash'])){if(!hash_equals($op['completionLease']??'',hash('sha256',$lease))||!hash_equals($op['completionHash'],$hash))throw new DomainException('completion_conflict');return ['project'=>$p,'replayed'=>true];}
  if(($p['active']??null)!==$request||$op['state']!=='running'||!preg_match('/^[a-f0-9]{32}$/D',$lease)||!hash_equals($op['lease']??'',$lease)||($op['leaseUntil']??0)<time())throw new DomainException('lease_expired');
  if($result){$p['pack']=mu_apply($p['pack'],$op['stage'],$op['batch'],$result['output']);$op['state']='complete';$op['usage']=array_intersect_key($result['usage']??[],array_flip(['prompt_tokens','completion_tokens','total_tokens']));}
  else{$op['state']=$error==='provider_unconfirmed'?'unconfirmed':'failed';$op['error']=$error??'provider_failed';}
  $op['completionHash']=$hash;$op['completionLease']=hash('sha256',$lease);unset($op['lease'],$op['leaseUntil']);
  $p['active']=null;$p['revision']++;$p['updatedAt']=gmdate('c');
  if($result&&!empty($op['pipeline'])&&$config['enabled']&&$config['configured']&&($next=mu_next_stage($p['pack']))){
   [$stage,$batch]=$next;$nextId=substr(hash('sha256',$op['pipeline'].':'.$stage.':'.$batch),0,32);
   try{mu_enqueue($s,$p,$nextId,$stage,$batch,'',$config,hash('sha256',$nextId),$op['pipeline']);}
   catch(DomainException $e){$p['pipelineError']=$e->getMessage();}
  }
  return ['project'=>$p];
 });
}
function mu_recover(array $b):array{return mu_lock(function(&$s)use($b){$id=lab_id((string)($b['id']??''));if(!isset($s['projects'][$id]))throw new InvalidArgumentException('unknown_project');$p=&$s['projects'][$id];if($p['revision']!==($b['expectedRevision']??null))throw new DomainException('revision_conflict');$active=$p['active']??null;if(!$active)return ['project'=>$p];$op=&$p['operations'][$active];if($op['state']==='queued'||($op['leaseUntil']??($op['startedAt']??time())+300)>time())throw new DomainException('generation_in_progress');$op['state']='unconfirmed';$op['error']='provider_unconfirmed';unset($op['lease']);$p['active']=null;$p['revision']++;return ['project'=>$p];});}
function mu_public_project(array $p):array {foreach($p['operations'] as &$op)unset($op['lease'],$op['completionLease']);unset($op);return $p;}
