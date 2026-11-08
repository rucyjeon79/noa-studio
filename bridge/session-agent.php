<?php
declare(strict_types=1);
if(!defined('_GNUBOARD_')){http_response_code(403);exit;}
require_once __DIR__.'/lab-core.php';
require_once __DIR__.'/session-subtitles.php';

/** ChatGPT's session executor uses the existing N80 AI LAB store, never a second queue. */
function sa_source(string $key):array {
 require_once __DIR__.'/storage.php';require_once __DIR__.'/inline-edit.php';
 require_once __DIR__.'/sound-core.php';require_once dirname(__DIR__).'/noa-app/jukebox/core.php';
 $db=noa_bridge_pdo();$r=nie_resolve($db,['type'=>'song','source'=>'music','key'=>$key]);
 if(!noa_sound_visible($r['document'],true))throw new DomainException('song_unavailable');
 $key=(string)($r['documentKey']?:$r['writeKey']);$a=nj_find($db,$key);
 $timing=mu_asset_timing($db,$key,(string)($r['context']['suno']??noa_sound_suno($r['payload']['body']??[])));
 if(!$timing||!$a)throw new DomainException('verified_audio_required');
 $fields=$r['fields'];$source=['key'=>$key,'revision'=>(int)$r['documentRevision'],'title'=>$fields['title'],
  'lyrics'=>$fields['lyrics']??'','description'=>$fields['description']??'',
  'cast'=>$fields['cast']??'female','genre'=>$r['context']['genre']??'',
  'imageGuidance'=>$fields['geminiPrompt']??'','duration'=>$timing['durationSeconds'],
  'audioSha256'=>$timing['audioSha256'],'audioPath'=>nj_file($a['audio_path'])];
 if(!$source['audioPath'])throw new DomainException('verified_audio_required');
 return $source;
}
function sa_fingerprint(array $source):string {
 unset($source['revision'],$source['audioPath']);return hash('sha256',json_encode($source,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR));
}
/** A short keeps the verified full source and records an explicit original-audio window. */
function sa_selection(mixed $v,string $format,float $duration):?array {
 if($v===null)return null;
 if($format!=='shorts'||!is_array($v)||array_diff(array_keys($v),['start','end']))throw new InvalidArgumentException('invalid_short_selection');
 foreach(['start','end'] as $k)if(!isset($v[$k])||!(is_int($v[$k])||is_float($v[$k]))||!is_finite((float)$v[$k]))throw new InvalidArgumentException('invalid_short_selection');
 $start=round((float)$v['start'],3);$end=round((float)$v['end'],3);$length=round($end-$start,3);
 if($start<0||$end>$duration||$length<49||$length>59)throw new InvalidArgumentException('invalid_short_selection');
 return ['start'=>$start,'end'=>$end];
}
function sa_duration(array $j):float {
 $v=$j['agent']['selection']??null;return $v?round($v['end']-$v['start'],3):(float)$j['source']['duration'];
}
function sa_summary(array $j):array {
 $a=$j['agent'];$scenes=$a['scenes'];
 return ['subtitles'=>sa_subtitle_summary($j),'execution'=>'chatgpt_session','phase'=>$j['state'],'sceneCount'=>$a['target'],
  'planned'=>count($scenes),'images'=>count(array_filter($scenes,fn($s)=>($s['image']['accepted']??false))),
  'videos'=>count(array_filter($scenes,fn($s)=>($s['video']['accepted']??false))),
  'active'=>$a['active']?array_intersect_key($a['active'],array_flip(['kind','scene','phase'])):null,
  'reason'=>$a['reason']??'','format'=>$a['format'],'duration'=>sa_duration($j),'selection'=>$a['selection']??null,'connected'=>($a['leaseUntil']??0)>time()];
}
function sa_layout(array $j):array {
 $a=$j['agent'];$fps=24;$overlap=(int)round($a['timing']['overlapSeconds']*$fps);
 $target=(int)ceil(sa_duration($j)*$fps);$cursor=0;$rows=[];
 foreach($a['scenes'] as $s){
  if(empty($s['video']['accepted']))return ['ready'=>false,'missingScene'=>$s['n']];
  $frames=(int)floor($s['video']['duration']*$fps+1e-5);
  if($frames<=2*$overlap)throw new DomainException('clip_too_short');
  $start=$rows?$cursor-$overlap:0;$used=min($frames,$target-$start);
  $rows[]=['n'=>$s['n'],'startFrame'=>$start,'frames'=>$used,'sha256'=>$s['video']['sha256']];
  $cursor=$start+$used;if($cursor>=$target)break;
 }
 return ['ready'=>$cursor>=$target,'fps'=>$fps,'overlapFrames'=>$overlap,'targetFrames'=>$target,
  'missingSeconds'=>max(0,($target-$cursor)/$fps),'scenes'=>$rows];
}
function sa_next(array $j):array {
 $a=$j['agent'];
 if(in_array($j['state'],['saved','cancelled','agent_paused'],true))return ['action'=>$j['state']];
 if($a['active'])return ['action'=>$a['active']['phase']==='received'?'review':'reconcile','operation'=>$a['active']];
 if(count($a['scenes'])<$a['target'])return ['action'=>'plan','start'=>count($a['scenes'])+1,'count'=>min(10,$a['target']-count($a['scenes']))];
 if(!empty($a['subtitles']['enabled'])&&($a['subtitles']['status']??'pending')!=='ready')return ['action'=>($a['subtitles']['status']??'pending')==='needs_review'?'review_subtitles':'align_subtitles','subtitles'=>sa_subtitle_summary($j)];
 foreach($a['scenes'] as $s)foreach(['image','video'] as $kind)if(empty($s[$kind]['accepted']))return ['action'=>'generate','kind'=>$kind,'scene'=>$s['n']];
 $layout=sa_layout($j);
 if(!$layout['ready'])return ['action'=>'extend_plan','count'=>max(1,(int)ceil($layout['missingSeconds']/max(1,8-$a['timing']['overlapSeconds'])))];
 return ['action'=>'assemble','layout'=>$layout];
}
function sa_view(array $j,bool $detail=false,int $from=1):array {
 $v=lab_public_job($j);$v['agent']=sa_summary($j);
 if($detail){$source=$j['source'];unset($source['audioPath']);$v['source']=$source;$v['next']=sa_next($j);
  $v['scenes']=array_slice($j['agent']['scenes'],max(0,$from-1),10);$v['timing']=$j['agent']['timing'];
  $v['assemblyTool']=['repository'=>'rucyjeon79/noa-studio','path'=>'lab/session-assemble.mjs','manifest'=>['format'=>$j['agent']['format'],'duration'=>sa_duration($j),'selection'=>$j['agent']['selection']??null,'sourceDuration'=>$j['source']['duration'],'subtitles'=>$j['agent']['subtitles']??['enabled'=>false],'audio'=>['path'=>'LOCAL_AUDIO_PATH','sha256'=>$j['audioSha256']],'layout'=>sa_layout($j),'scenes'=>'Download each accepted video to a local path; include n, path and sha256. Run node session-assemble.mjs manifest.json final.mp4. Inspect actual frames and listen to the final audio before review.']];
  $v['subtitles']=$j['agent']['subtitles']??['enabled'=>false];
  $v['subtitleTool']=['path'=>'lab/session-subtitles.py','manifest'=>['audio'=>['path'=>'LOCAL_AUDIO_PATH','sha256'=>$j['audioSha256']],'duration'=>$j['source']['duration'],'lyrics'=>$j['source']['lyrics']],'instructions'=>'Run the local Korean word recognizer with the original audio, save payload using noa_agent_subtitles, and listen to flagged lines before reviewing. Never invent evenly spaced timings. Read SRT/VTT using agentFile after ready. No paid API or background process.'];
  $v['instructions']='ChatGPT plans and reviews. Use Gemini and Flow through available signed-in browser tools. Persist begin BEFORE generation. A requested operation on resume must be reconciled, never blindly generated again. Upload actual files with agentFile. Review actual images/frames; do not mark unobserved assets accepted. Use source key, current title and lyrics. Preserve watermarks. Use original audio for assembly. Public posting requires an explicit user request specifying the destination; otherwise save only. If a required browser tool or login is missing, pause with a precise reason. Resume in a later conversation; this is not an unattended browser service.';
 }
 return $v;
}
function sa_require_current(array $j,array $source):void {
 if(!hash_equals($j['agent']['sourceFingerprint'],sa_fingerprint($source)))throw new DomainException('source_changed_replan_required');
}
function sa_lease(array $j,array $b):void {
 if(!is_string($b['lease']??null)||!hash_equals($j['agent']['lease']??'',(string)$b['lease'])||($j['agent']['leaseUntil']??0)<=time())throw new DomainException('agent_lease_expired');
 if(in_array($j['state'],['saved','cancelled','agent_paused'],true))throw new DomainException('agent_not_active');
}
function sa_string(mixed $v,int $max):string {
 if(!is_string($v)||trim($v)===''||mb_strlen($v)>$max)throw new InvalidArgumentException('invalid_agent_text');return trim($v);
}
function sa_canonical(mixed $value):mixed {
 if(!is_array($value))return $value;if(!array_is_list($value))ksort($value);
 return array_map('sa_canonical',$value);
}
function sa_dispatch(string $op,array $b,string $owner,?callable $sourceReader=null):array {
 $sourceReader??='sa_source';
 if($op==='agentTasks'){
  $jobs=array_filter(lab_read()['jobs'],fn($j)=>($j['type']??'')==='agent_movie'&&($j['agent']['owner']??'')===$owner);
  $campaigns=lab_read()['campaigns']??[];
  if(isset($campaigns['daily_shorts']['preparation']))unset($campaigns['daily_shorts']['preparation']['lease'],$campaigns['daily_shorts']['preparation']['sources']);
  return ['jobs'=>array_map(fn($j)=>sa_view($j),array_values(array_slice($jobs,-50,null,true))),'campaigns'=>$campaigns,'execution'=>'chatgpt_session'];
 }
 if($op==='agentRead'&&isset($b['trackKey'])){
  $source=$sourceReader(sa_string($b['trackKey'],191));unset($source['audioPath']);
  return ['source'=>$source,'execution'=>'chatgpt_session'];
 }
 if($op==='agentSourceFile'){
  $source=$sourceReader(sa_string($b['trackKey']??null,191));
  if(($b['sourceRevision']??null)!==$source['revision'])throw new DomainException('source_revision_conflict');
  require_once __DIR__.'/session-agent-media.php';
  return sa_read_chunk($source['audioPath'],$source['audioSha256'],$b['offset']??null);
 }
 if($op==='agentStart'){
  $source=$sourceReader(sa_string($b['trackKey']??null,191));
  if(($b['sourceRevision']??null)!==$source['revision'])throw new DomainException('source_revision_conflict');
  $subtitleEnabled=($b['subtitles']??false)===true;if($subtitleEnabled&&!preg_match('/[가-힣]/u',implode('',sa_lyric_lines($source['lyrics']))))throw new DomainException('korean_lyrics_required');
  $format=$b['format']??'landscape';if(!in_array($format,['landscape','shorts'],true))throw new InvalidArgumentException('invalid_format');
  $request=lab_id((string)($b['requestId']??''));$brief=sa_string($b['goal']??'현재 곡에 어울리는 영화적 뮤직비디오를 만들어 주세요.',4000);
  $selection=sa_selection($b['selection']??null,$format,(float)$source['duration']);
  $timing=mu_timeline(['durationSeconds'=>$selection?round($selection['end']-$selection['start'],3):$source['duration'],'overlapSeconds'=>$b['overlapSeconds']??1]);
  $identity=[$owner,sa_fingerprint($source),$format,$brief,$timing];if($subtitleEnabled)$identity[]='korean_subtitles_v1';if($selection)$identity[]=$selection;
  $fingerprint=hash('sha256',json_encode($identity,JSON_THROW_ON_ERROR));
  return lab_lock(function(&$s)use($source,$request,$brief,$format,$timing,$fingerprint,$owner,$subtitleEnabled,$selection){
   foreach($s['jobs'] as $j){if(($j['requestId']??'')===$request&&($j['fingerprint']??'')!==$fingerprint)throw new DomainException('request_id_reused');
    if(($j['fingerprint']??'')===$fingerprint&&$j['state']!=='cancelled')return ['job'=>sa_view($j,true),'replayed'=>true];}
   if(count($s['jobs'])>=200)throw new DomainException('job_limit');$id=bin2hex(random_bytes(16));
   if(!mkdir(lab_job_dir($id),0700))throw new RuntimeException('job_directory');
   $now=gmdate('c');$j=['id'=>$id,'requestId'=>$request,'type'=>'agent_movie','fingerprint'=>$fingerprint,
    'trackKey'=>$source['key'],'sourceRevision'=>$source['revision'],'title'=>$source['title'],'genre'=>$source['genre'],'cast'=>$source['cast'],
    'source'=>$source,'goal'=>$brief,'state'=>'agent_planning','revision'=>1,'createdAt'=>$now,'updatedAt'=>$now,
    'audioSha256'=>$source['audioSha256'],'inputReady'=>true,'settings'=>['posting'=>'save','formats'=>[$format]],'outputs'=>[],
    'agent'=>['owner'=>$owner,'sourceFingerprint'=>sa_fingerprint($source),'format'=>$format,'selection'=>$selection,'timing'=>array_diff_key($timing,['scenes'=>true]),
      'subtitles'=>['enabled'=>$subtitleEnabled,'status'=>$subtitleEnabled?'pending':'off'],'target'=>$timing['cutCount'],'scenes'=>[],'active'=>null,'session'=>'','lease'=>'','leaseUntil'=>0,'attempts'=>[],'receipts'=>[]]];
   $s['jobs'][$id]=$j;lab_event($s,'agent_created',$id,$owner);return ['job'=>sa_view($j,true),'replayed'=>false];
  });
 }
 $id=lab_id((string)($b['id']??''));$snapshot=lab_read();$j=$snapshot['jobs'][$id]??null;
 if(!$j||($j['type']??'')!=='agent_movie'||$j['agent']['owner']!==$owner)throw new DomainException('agent_job_unavailable');
 $source=null;$sourceError=null;
 try{$source=$sourceReader($j['trackKey']);}catch(DomainException $e){$sourceError=$e->getMessage();}
 if($op==='agentRead')return ['job'=>sa_view($j,true,(int)($b['fromScene']??1)),
  'sourceCurrent'=>$source!==null&&hash_equals($j['agent']['sourceFingerprint'],sa_fingerprint($source)),'sourceError'=>$sourceError,'goal'=>$j['goal']];
 if($source===null&&!($op==='agentFile'&&($b['mode']??'')==='read')&&!in_array($b['action']??'',['pause','cancel'],true))throw new DomainException($sourceError??'song_unavailable');
 $result=lab_lock(function(&$s)use($id,$op,$b,$owner,$source){
  $j=&$s['jobs'][$id];if($j['agent']['owner']!==$owner)throw new DomainException('agent_job_unavailable');
  $a=&$j['agent'];$action=$b['action']??'';
  if($op==='agentFile'){if(($b['mode']??'')!=='read'){sa_require_current($j,$source);sa_lease($j,$b);$a['leaseUntil']=time()+900;}require_once __DIR__.'/session-agent-media.php';return sa_file($j,$b);}
  if($op!=='agentStep')throw new InvalidArgumentException('unknown_agent_operation');
  if($action==='claim'){
   sa_require_current($j,$source);$session=lab_id((string)($b['sessionId']??''));
   if(in_array($j['state'],['saved','cancelled','agent_paused'],true))throw new DomainException('agent_not_active');
   if($a['leaseUntil']>time()&&$a['session']!==$session)throw new DomainException('agent_already_claimed');
   if($a['session']!==$session||$a['leaseUntil']<=time())$a['lease']=bin2hex(random_bytes(24));
   $a['session']=$session;$a['leaseUntil']=time()+900;lab_touch($j);
   return ['job'=>sa_view($j,true),'lease'=>$a['lease'],'leaseSeconds'=>900];
  }
  // Administrative controls use revision fencing and revoke the current session lease.
  if(in_array($action,['pause','resume','cancel'],true)){
   lab_revision($j,$b);if(in_array($j['state'],['saved','cancelled'],true))throw new DomainException('agent_finished');
   if($action==='resume'){sa_require_current($j,$source);$j['state']='agent_ready';$a['reason']='';}
   else{$j['state']=$action==='cancel'?'cancelled':'agent_paused';$a['reason']=sa_string($b['reason']??'사용자 요청',500);}
   $a['lease']='';$a['leaseUntil']=0;lab_touch($j);lab_event($s,'agent_'.$action,$id,$owner);return ['job'=>sa_view($j,true)];
  }
  sa_require_current($j,$source);
  $request=lab_id((string)($b['requestId']??''));$canonical=$b;unset($canonical['lease'],$canonical['expectedRevision']);
  $hash=hash('sha256',json_encode(sa_canonical($canonical),JSON_THROW_ON_ERROR));
  if(isset($a['receipts'][$request])){if(!hash_equals($a['receipts'][$request],$hash))throw new DomainException('request_id_reused');return ['job'=>sa_view($j,true),'replayed'=>true];}
  sa_lease($j,$b);$a['leaseUntil']=time()+900;
  lab_revision($j,$b);
  if($action==='subtitles'){sa_subtitle_save($j,$b);
  }elseif($action==='subtitle_review'){sa_subtitle_review($j,$b);
  }elseif($action==='plan'){
   $next=sa_next($j);if($next['action']==='extend_plan'){$a['target']+=$next['count'];$next=sa_next($j);}
   if($next['action']!=='plan'||$a['target']>3600)throw new DomainException('plan_not_requested');
   $rows=$b['scenes']??null;if(!is_array($rows)||!array_is_list($rows)||!count($rows)||count($rows)>$next['count'])throw new InvalidArgumentException('invalid_scene_plan');
   foreach($rows as $i=>$row){$n=$next['start']+$i;if(($row['n']??null)!==$n)throw new InvalidArgumentException('invalid_scene_number');
    $a['scenes'][]=['n'=>$n,'summary'=>sa_string($row['summary']??null,600),'imagePrompt'=>sa_string($row['imagePrompt']??null,5000),'videoPrompt'=>sa_string($row['videoPrompt']??null,5000)];}
   $j['state']='agent_ready';
  }elseif($action==='revise'){
   $n=$b['scene']??0;$patch=$b['changes']??null;
   if($a['active']||!is_int($n)||!isset($a['scenes'][$n-1])||!is_array($patch)||!$patch||array_diff(array_keys($patch),['summary','imagePrompt','videoPrompt']))throw new DomainException('scene_revision_unavailable');
   $row=&$a['scenes'][$n-1];
   if(!empty($row['video']['accepted'])||(isset($patch['imagePrompt'])&&!empty($row['image']['accepted'])))throw new DomainException('accepted_scene_locked');
   foreach($patch as $key=>$value)$row[$key]=sa_string($value,$key==='summary'?600:5000);unset($row);
   $j['state']='agent_ready';
  }elseif($action==='begin'){
   $next=sa_next($j);$kind=$b['kind']??'';$n=$b['scene']??0;
   if(!(($next['action']==='generate'&&$kind===$next['kind']&&$n===$next['scene'])||($next['action']==='assemble'&&$kind==='final'&&$n===0)))throw new DomainException('unexpected_agent_step');
   $key=$kind.':'.$n;$a['attempts'][$key]=($a['attempts'][$key]??0)+1;if($a['attempts'][$key]>3)throw new DomainException('generation_attempt_limit');
   $a['active']=['kind'=>$kind,'scene'=>$n,'requestId'=>$request,'phase'=>'requested','startedAt'=>gmdate('c')];$j['state']='agent_working';
  }elseif($action==='review'){
   $active=$a['active'];if(!$active||$active['phase']!=='received'||($b['operationId']??'')!==$active['requestId'])throw new DomainException('received_asset_required');
   $note=sa_string($b['note']??null,1500);$accepted=$b['accepted']??null;if(!is_bool($accepted))throw new InvalidArgumentException('review_required');
   $asset=$active['asset'];$path=lab_job_dir($id).'/'.$asset['file'];if(!is_file($path)||is_link($path)||!hash_equals($asset['sha256'],hash_file('sha256',$path)))throw new DomainException('asset_checksum_mismatch');
   if($accepted&&($b['visualChecked']??false)!==true)throw new DomainException('visual_review_required');
   $asset['accepted']=$accepted;$asset['review']=$note;
   if($active['kind']==='final'){
    if($accepted){if(($b['audioChecked']??false)!==true)throw new DomainException('original_audio_review_required');$j['outputs']=[array_merge($asset,['format'=>$a['format']])];$j['state']='saved';}
    else $j['state']='agent_ready';
   }else{$a['scenes'][$active['scene']-1][$active['kind']]=$asset;$j['state']='agent_ready';}
   $a['history'][]=array_intersect_key($active,array_flip(['kind','scene','requestId','startedAt']))+['accepted'=>$accepted,'sha256'=>$asset['sha256'],'note'=>$note];$a['active']=null;
  }elseif($action==='not_created'){
   if(!$a['active']||$a['active']['phase']!=='requested'||($b['operationId']??'')!==$a['active']['requestId'])throw new DomainException('operation_not_requested');
   $note=sa_string($b['note']??null,1500);if(($b['providerHistoryChecked']??false)!==true)throw new DomainException('provider_reconciliation_required');
   $a['history'][]=$a['active']+['notCreated'=>true,'note'=>$note];$a['active']=null;$j['state']='agent_ready';
  }else throw new InvalidArgumentException('unknown_agent_action');
  $a['receipts'][$request]=$hash;$a['history']=array_slice($a['history']??[],-200);lab_touch($j);lab_event($s,'agent_'.$action,$id,$owner);
  return ['job'=>sa_view($j,true),'replayed'=>false];
 });
 if($op==='agentStep'&&($b['action']??'')==='review'&&isset($result['job'])){
  $partial=lab_job_dir($id).'/transfer-'.lab_id((string)$b['operationId']).'.part';
  if(is_file($partial)&&!is_link($partial))unlink($partial);
 }
 return $result;
}

