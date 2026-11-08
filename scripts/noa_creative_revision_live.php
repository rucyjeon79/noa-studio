<?php
declare(strict_types=1);ini_set('display_errors','0');header('Content-Type: application/json');header('Cache-Control: no-store');
if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||time()>__EXPIRY__||!hash_equals('__TOKEN_SHA__',hash('sha256',$_SERVER['HTTP_X_NOA_CONTROL']??''))){http_response_code(404);exit;}
$level=ob_get_level();ob_start();require_once dirname(__DIR__).'/common.php';if(session_status()===PHP_SESSION_ACTIVE)session_write_close();
try{
 require_once __DIR__.'/storage.php';require_once __DIR__.'/sound-core.php';require_once dirname(__DIR__).'/noa-app/engine/creative.php';
 $db=noa_bridge_pdo();$owner=(string)$config['cf_admin'];$id='__DRAFT_ID__';$nonce='__REQUEST_ID__';$b=json_decode(file_get_contents('php://input'),true,16,JSON_THROW_ON_ERROR);$op=$b['op']??'';$result=[];
 if($op==='audit'){
  // Read only the exact title reported by the owner, within the last day. No other song content.
  $q=$db->prepare("SELECT payload FROM noa_documents WHERE kind='n80_creative_job' AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.owner'))=? AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.operation'))='revise' AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.field'))='title' AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.input.fields.title'))=? AND CAST(JSON_UNQUOTE(JSON_EXTRACT(payload,'$.createdAt')) AS UNSIGNED)>=? ORDER BY updated_at DESC LIMIT 5");
  $q->execute([$owner,'A Song Between the Lines',time()-86400]);$rows=$q->fetchAll(PDO::FETCH_ASSOC);$auditId='__AUDIT_JOB_ID__';if($auditId!==''){$jr=ncd_job($db,$auditId);if(!$jr||($jr['document']['operation']??'')!=='revise'||($jr['document']['field']??'')!=='title')throw new RuntimeException('reported_revision_not_found');$rows=[['payload'=>ncd_json($jr['document'])]];}$result=['matchingJobs'=>[],'userDraftWrites'=>0];
  foreach($rows as $row){$j=json_decode($row['payload'],true);$result['matchingJobs'][]=['id'=>$j['id'],'state'=>$j['state'],'createdAt'=>$j['createdAt'],'startedAt'=>$j['startedAt']??null,'finishedAt'=>$j['finishedAt']??null,'currentTitle'=>$j['input']['fields']['title'],'request'=>$j['input']['request'],'result'=>$j['result']['fields']['title']??null];}
 }elseif($op==='init'){
  $r=ncd_create($db,$owner,$id,'[N80 수정 검증 전용 __DRAFT_ID__] 오래된 메모를 떠올리는 한국어 노래.');$d=$r['document'];
  $values=['theme'=>'오래된 메모와 추억','emotion'=>'그리움','genre'=>'인디 팝','instruments'=>'피아노','vocal'=>'남녀듀엣','structure'=>'절과 후렴','language'=>'한국어','prohibitions'=>'결말 단정 금지'];
  foreach(NCD_CONDITIONS as $k)$d['_creative']['intent'][$k]=['value'=>$values[$k],'evidence'=>$values[$k],'source'=>'answer'];
  $d['_creative']['intentConfirmed']=true;$d['_creative']['intentHash']=ncd_hash($d['_creative']['intent']);$r=ncd_atomic($db,fn()=>ncd_put($db,$r,$d,$owner));
  $r=ncd_save($db,$owner,['id'=>$id,'revision'=>$r['revision'],'fields'=>['title'=>'메모 사이로 흐르는 노래','vocal'=>'남녀듀엣']]);
  $batch=__BATCH_MODE__===1;
  $r=ncd_save($db,$owner,['id'=>$id,'revision'=>$r['revision'],'fields'=>['title'=>'A Song Between the Lines','sunoPrompt'=>'Warm intimate indie pop, piano and cello, soft male-female duet.'],'requests'=>['title'=>$batch?'':'더 짧게 줄여죠']]);
  $selection=$batch?['targets'=>['title','sunoPrompt']]:['field'=>'title'];
  $result=ncd_enqueue($db,$owner,['id'=>$id,'revision'=>$r['revision'],'operation'=>'revise','requestId'=>$nonce]+$selection);$result=['draftId'=>$id,'job'=>$result['job']];
 }else{
  $r=ncd_row($db,$id,$owner);if($r['document']['_creative']['story']!=='[N80 수정 검증 전용 __DRAFT_ID__] 오래된 메모를 떠올리는 한국어 노래.')throw new RuntimeException('probe_scope_changed');
  if($op==='status'){$j=ncd_job($db,substr(hash('sha256',$owner.':'.$nonce),0,32))['document'];$v=ncd_view($r);$result=['jobId'=>$j['id'],'state'=>$j['state'],'error'=>$j['error']??null,'currentTitle'=>nup_fields($r['document'])['title'],'submittedTitle'=>$j['input']['fields']['title'],'request'=>$j['input']['request'],'result'=>$j['result']['fields']['title']??null,'proposal'=>$v['creative']['proposals']['title']['value']??null,'startedAt'=>$j['startedAt']??null,'finishedAt'=>$j['finishedAt']??null];}
  if($op==='status'){$result['targets']=$j['targets'];$result['requests']=$j['input']['requests']??[];$result['fields']=$j['result']['fields']??[];$result['proposals']=array_map(static fn($p)=>$p['value'],$v['creative']['proposals']);}
  elseif($op==='apply'){
   $j=ncd_job($db,substr(hash('sha256',$owner.':'.$nonce),0,32))['document'];
   if(__BATCH_MODE__!==1||$j['state']!=='succeeded'||$j['targets']!==['title','sunoPrompt'])throw new RuntimeException('probe_apply_scope');
   $before=nup_fields($r['document']);$revision=$r['revision'];$r=ncd_action($db,$owner,'proposal',['id'=>$id,'revision'=>$revision,'fields'=>$j['targets'],'decision'=>'apply']);$after=nup_fields($r['document']);
   foreach($before as $key=>$value)if(!in_array($key,$j['targets'],true)&&$after[$key]!==$value)throw new RuntimeException('probe_unselected_changed');
   foreach($j['targets'] as $key)if($after[$key]!==$j['result']['fields'][$key])throw new RuntimeException('probe_apply_mismatch');
   if($r['revision']!==$revision+1||ncd_current_proposals($r['document']))throw new RuntimeException('probe_apply_not_atomic');
   $result=['appliedTargets'=>$j['targets'],'atomic'=>true,'unselectedUnchanged'=>true];
  }elseif($op==='cleanup'){
   require_once dirname(__DIR__).'/noa-app/jukebox/core.php';
   if(!empty($r['document']['_creative']['publication'])||nj_find($db,$r['doc_key']))throw new RuntimeException('probe_cleanup_scope');
   $jobId=substr(hash('sha256',$owner.':'.$nonce),0,32);$jobKey='n80:creative-job:'.$jobId;$job=ncd_job($db,$jobId);if(!$job||$job['document']['draftId']!==$id||$job['document']['owner']!==$owner||in_array($job['document']['state'],['queued','running'],true))throw new RuntimeException('probe_job_scope');
   ncd_atomic($db,function()use($db,$r,$jobKey,$id,$owner){foreach(['noa_document_history','noa_documents'] as $table){$q=$db->prepare('DELETE FROM '.$table.' WHERE doc_key IN (?,?)');$q->execute([$r['doc_key'],$jobKey]);}$db->prepare('DELETE FROM noa_creative_drafts WHERE draft_id=? AND owner_id=?')->execute([$id,$owner]);});$check=$db->prepare('SELECT COUNT(*) FROM noa_documents WHERE doc_key IN (?,?)');$check->execute([$r['doc_key'],$jobKey]);if((int)$check->fetchColumn()!==0)throw new RuntimeException('probe_removal_failed');$result=['probeRemoved'=>true,'userDraftWrites'=>0,'publishedSongs'=>0];
  }else throw new InvalidArgumentException('invalid_probe_operation');
 }
 $out=['ok'=>true,'result'=>$result];
}catch(Throwable $e){http_response_code(500);$out=['ok'=>false,'error'=>$e->getMessage()];}
while(ob_get_level()>$level)ob_end_clean();echo json_encode($out,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
