<?php
declare(strict_types=1);ini_set('display_errors','0');header('Content-Type: application/json');header('Cache-Control: no-store');
if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||time()>__EXPIRY__||!hash_equals('__TOKEN_SHA__',hash('sha256',$_SERVER['HTTP_X_NOA_CONTROL']??''))){http_response_code(404);exit;}
$level=ob_get_level();ob_start();require_once dirname(__DIR__).'/common.php';if(session_status()===PHP_SESSION_ACTIVE)session_write_close();
try{
 require_once __DIR__.'/storage.php';require_once __DIR__.'/sound-core.php';require_once dirname(__DIR__).'/noa-app/engine/creative.php';
 $db=noa_bridge_pdo();$owner=(string)$config['cf_admin'];$id='__DRAFT_ID__';$nonce='__REQUEST_ID__';$b=json_decode(file_get_contents('php://input'),true,16,JSON_THROW_ON_ERROR);$op=$b['op']??'';$result=[];
 if(in_array($op,['audit_save','recover_save'],true)){
  require_once __DIR__.'/creative-publication.php';
  $q=$db->prepare('SELECT c.draft_id FROM noa_creative_drafts c WHERE c.owner_id=?');$q->execute([$owner]);$matches=[];
  foreach($q->fetchAll(PDO::FETCH_COLUMN) as $draftId){$candidate=ncd_row($db,$draftId,$owner);if(preg_replace('/\s+/u','',nup_fields($candidate['document'])['title'])==='행간의연서(行間戀書)'&&empty($candidate['document']['_creative']['deletedAt']))$matches[]=$candidate;}
  if(count($matches)!==1)throw new RuntimeException('reported_song_not_unique');
  $r=$matches[0];$d=$r['document'];$c=$d['_creative'];$a=nj_find($db,$r['doc_key']);
  $snapshot=['id'=>$c['id'],'revision'=>$r['revision'],'documentHash'=>ncd_hash($d),'assetHash'=>ncd_hash($a),'title'=>nup_fields($d)['title'],'genre'=>$d['genreId'],'collections'=>$c['collections'],'publication'=>$c['publication']??null,'completion'=>ncd_completion($d),'needsReview'=>array_keys($c['needsReview']),'proposals'=>array_keys(ncd_current_proposals($d)),'audioReady'=>nj_verified($a,'audio'),'coverReady'=>nj_verified($a,'cover'),'audioPath'=>$a['audio_path']??null,'coverPath'=>$a['cover_path']??null];
  if($op==='audit_save')$result=$snapshot+['userDraftWrites'=>0];
  else{
   $expected=$b['expected']??[];
   foreach(['id','revision','documentHash','assetHash'] as $field)if(($expected[$field]??null)!==$snapshot[$field])throw new RuntimeException('reported_song_changed');
   if(!empty($c['jobId'])){$job=ncd_job($db,$c['jobId']);if(in_array($job['document']['state']??'',['queued','running'],true))throw new RuntimeException('reported_song_busy');}
   $accepted=nup_fields($d);unset($accepted['audioFileLocation'],$accepted['cardImageLocation'],$accepted['confirmed']);
   if(empty($c['publication'])){
    $preview=ncd_preview($db,$owner,['id'=>$c['id'],'revision'=>$r['revision'],'reviewConfirmed'=>true],true);
    if(!$preview['preview']['validation']['ready'])throw new RuntimeException('reported_song_not_ready:'.implode(',',$preview['preview']['validation']['issues']));
    $request=['id'=>$c['id'],'revision'=>$preview['draft']['revision'],'token'=>$preview['preview']['token'],'rightsConfirmed'=>true];
    $published=ncd_publish($db,$owner,$request,true);if(ncd_publish($db,$owner,$request,true)['publication']!==$published['publication'])throw new RuntimeException('publication_replay_changed');
   }else{
    $published=['publication'=>$c['publication']];$key=$c['publication']['key'];
    ncd_atomic($db,function()use($db,$key,$r,$d,$owner){$q=$db->prepare('SELECT kind,payload,revision FROM noa_documents WHERE doc_key=? FOR UPDATE');$q->execute([$key]);$song=$q->fetch(PDO::FETCH_ASSOC);if(!$song)throw new RuntimeException('published_song_missing');$payload=json_decode($song['payload'],true);if(($payload['creativeDraftId']??'')!==$d['_creative']['id'])throw new RuntimeException('published_song_identity');nup_store($db,$key,$song['kind'],$payload,(int)$song['revision'],$owner);ncd_put($db,$r,$d,$owner);});
   }
   nml_cleanup($db);$key=$published['publication']['key'];$saved=nj_document($db,$key);$asset=nj_find($db,$key);$current=nup_fields($saved);unset($current['audioFileLocation'],$current['cardImageLocation'],$current['confirmed']);
   if($accepted!==$current||$saved['genreId']!==$d['genreId'])throw new RuntimeException('saved_content_mismatch');
   if($a)foreach(['audio','cover'] as $type)if(!empty($a[$type.'_path'])){if(!nj_verified($asset,$type)||$a[$type.'_sha256']!==$asset[$type.'_sha256'])throw new RuntimeException('saved_media_mismatch');}
   if(!empty($asset['audio_path'])&&!empty($asset['cover_path'])&&dirname($asset['audio_path'])!==dirname($asset['cover_path']))throw new RuntimeException('media_not_together');
   if(!empty($asset['audio_path'])&&!str_contains($asset['audio_path'],'사연곡/'.nml_component($accepted['title']).' ['))throw new RuntimeException('media_folder_title_mismatch');
   $result=['publication'=>$published['publication'],'acceptedFieldsPreserved'=>true,'audioReady'=>nj_verified($asset,'audio'),'coverReady'=>nj_verified($asset,'cover'),'audioPath'=>$asset['audio_path']??null,'coverPath'=>$asset['cover_path']??null,'oldPathsRemoved'=>array_map(static fn($type)=>empty($a[$type.'_path'])||$a[$type.'_path']===($asset[$type.'_path']??null)||nj_file($a[$type.'_path'])===null,['audio','cover']),'replaySafe'=>true];
  }
 }elseif($op==='audit_titles'){
  $q=$db->prepare("SELECT payload FROM noa_documents WHERE kind='n80_creative_job' AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.owner'))=? AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.operation'))='revise' AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.input.fields.title'))=? AND CAST(JSON_UNQUOTE(JSON_EXTRACT(payload,'$.createdAt')) AS UNSIGNED)>=? ORDER BY updated_at DESC LIMIT 5");$q->execute([$owner,'Between Lines',time()-86400]);$result=['matchingJobs'=>[],'userDraftWrites'=>0];$keys=['youtubeTitle','description','communityPost'];
  foreach($q->fetchAll(PDO::FETCH_ASSOC) as $row){$j=json_decode($row['payload'],true);if(!array_intersect($keys,$j['targets']))continue;$result['matchingJobs'][]=['id'=>$j['id'],'state'=>$j['state'],'createdAt'=>$j['createdAt'],'currentTitle'=>$j['input']['fields']['title'],'targets'=>$j['targets'],'previous'=>array_intersect_key($j['input']['fields'],array_flip($keys)),'result'=>array_intersect_key($j['result']['fields']??[],array_flip($keys))];}
 }elseif($op==='audit'){
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
  if(__TITLE_MODE__===1){$old='메모 사이로 흐르는 노래';$r=ncd_save($db,$owner,['id'=>$id,'revision'=>$r['revision'],'fields'=>['title'=>'Between Lines','youtubeTitle'=>$old.' | 그때 못 한 말을 오늘 꺼내 볼까','description'=>'노래 「'.$old.'」는 오래된 메모와 추억을 담았습니다.','communityPost'=>'오늘의 신곡 「'.$old.'」를 들어 주세요.'],'requests'=>['title'=>'']]);$selection=['targets'=>['youtubeTitle','description','communityPost']];}
  $result=ncd_enqueue($db,$owner,['id'=>$id,'revision'=>$r['revision'],'operation'=>'revise','requestId'=>$nonce]+$selection);$result=['draftId'=>$id,'job'=>$result['job']];
 }else{
  $r=ncd_row($db,$id,$owner);if($r['document']['_creative']['story']!=='[N80 수정 검증 전용 __DRAFT_ID__] 오래된 메모를 떠올리는 한국어 노래.')throw new RuntimeException('probe_scope_changed');
  if($op==='status'){$j=ncd_job($db,substr(hash('sha256',$owner.':'.$nonce),0,32))['document'];$v=ncd_view($r);$result=['jobId'=>$j['id'],'state'=>$j['state'],'error'=>$j['error']??null,'currentTitle'=>nup_fields($r['document'])['title'],'submittedTitle'=>$j['input']['fields']['title'],'request'=>$j['input']['request'],'result'=>$j['result']['fields']['title']??null,'proposal'=>$v['creative']['proposals']['title']['value']??null,'startedAt'=>$j['startedAt']??null,'finishedAt'=>$j['finishedAt']??null];}
  if($op==='status'){$result['targets']=$j['targets'];$result['requests']=$j['input']['requests']??[];$result['fields']=$j['result']['fields']??[];$result['proposals']=array_map(static fn($p)=>$p['value'],$v['creative']['proposals']);}
  elseif($op==='apply'){
   $j=ncd_job($db,substr(hash('sha256',$owner.':'.$nonce),0,32))['document'];
   $expected=__TITLE_MODE__===1?['youtubeTitle','description','communityPost']:['title','sunoPrompt'];if((__BATCH_MODE__!==1&&__TITLE_MODE__!==1)||$j['state']!=='succeeded'||$j['targets']!==$expected)throw new RuntimeException('probe_apply_scope');
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
