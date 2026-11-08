<?php
/** Exercise stale edits through the real SQL owner, including persisted legacy jobs. */
(function()use($db,$owner){
 $schema=require __DIR__.'/../../bridge/taxonomy-schema.php';$db->exec('CREATE TABLE IF NOT EXISTS noa_production_rules '.$schema['noa_production_rules'].' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
 $rule='Preserve the selected field and user request.';$digest=hash('sha256',$rule);
 $db->prepare('INSERT IGNORE INTO noa_production_rules(rule_id,scope,genre_id,format,body,sha256,source_path,source_sha256,updated_by) VALUES(?,?,?,?,?,?,?,?,?)')->execute(['test:creative:common','common',null,'text',$rule,$digest,'test',$digest,'fixture']);
 $id=str_repeat('1',32);$r=ncd_create($db,$owner,$id,'오래된 메모와 추억을 한국어 노래로 만든다.');$d=$r['document'];
 foreach(NCD_CONDITIONS as $key)$d['_creative']['intent'][$key]=['value'=>'한국어 노래','evidence'=>'한국어 노래','source'=>'story'];
 $d['_creative']['intentConfirmed']=true;$d['_creative']['intentHash']=ncd_hash($d['_creative']['intent']);$r=ncd_atomic($db,fn()=>ncd_put($db,$r,$d,$owner));
 $save=function(array $body)use($db,$owner,$id,&$r){$r=ncd_save($db,$owner,['id'=>$id,'revision'=>$r['revision']]+$body);};
 $load=function()use($db,$owner,$id,&$r){$r=ncd_row($db,$id,$owner);};
 $start=function()use($db,$owner,&$r){[$job,$r]=enqueue_test($db,$owner,$r,'revise','title');return $job;};
 $finish=function(string $job,string $title)use($db,$load){ncd_worker($db,'save',$job,['text'=>ncd_json(['fields'=>['title'=>$title],'vocal'=>'남녀듀엣'])]);$load();};
 $save(['fields'=>['title'=>'메모 사이로 흐르는 노래','vocal'=>'남녀듀엣']]);
 $save(['fields'=>['title'=>'A Song Between the Lines'],'requests'=>['title'=>'더 짧게 줄여죠']]);
 $job=$start();$task=ncd_worker($db,'read',$job);
 check($task['revisionInput']===['field'=>'title','currentValue'=>'A Song Between the Lines','request'=>'더 짧게 줄여죠'],'worker receives latest accepted title and current request');
 check($task['creativeInput']['fields']['title']===$task['revisionInput']['currentValue'],'no old alias in worker context');
 $finish($job,'Between Lines');check(ncd_view($r)['creative']['proposals']['title']['value']==='Between Lines','fresh proposal is visible');
 $save(['requests'=>['title'=>'한 단어로 줄여줘']]);check(empty(ncd_view($r)['creative']['proposals']['title']),'changed request invalidates old proposal');
 $job=$start();$save(['requests'=>['title'=>'영어 세 단어로 다듬어줘']]);$finish($job,'Lines');
 check(ncd_job($db,$job)['document']['state']==='review'&&empty(ncd_view($r)['creative']['proposals']['title']),'late response to previous request cannot be shown/applied');
 $job=$start();$finish($job,'Song Between Lines');$old=$r['document']['_creative']['proposals']['title'];
 $job=$start();check(empty(ncd_view($r)['creative']['proposals']['title']),'same request retry clears previous proposal at enqueue');ncd_worker($db,'workerFail',$job);$load();check(empty(ncd_view($r)['creative']['proposals']['title']),'failed new request cannot reshow old result');
 $job=$start();$save(['fields'=>['title'=>'The Last Letter']]);$finish($job,'Song Between Lines');check(ncd_job($db,$job)['document']['state']==='review','manual edit while AI runs is protected');
 $job=$start();$task=ncd_worker($db,'read',$job);check($task['revisionInput']['currentValue']==='The Last Letter','next request uses most recent manual edit');$finish($job,'Last Letter');
 $save(['fields'=>['lyrics'=>'새로운 가사']]);check(empty(ncd_view($r)['creative']['proposals']['title']),'changed context hides stale proposal');
 denied(fn()=>ncd_action($db,$owner,'proposal',['id'=>$id,'revision'=>$r['revision'],'field'=>'title','decision'=>'apply']),'field_changed');
 $job=$start();$finish($job,'Last Letter');$r=ncd_action($db,$owner,'proposal',['id'=>$id,'revision'=>$r['revision'],'field'=>'title','decision'=>'apply']);
 check(nup_fields($r['document'])['title']==='Last Letter'&&nup_fields($r['document'])['lyrics']==='새로운 가사','only accepted selected field changes');
 $job=$start();check(ncd_worker($db,'read',$job)['revisionInput']['currentValue']==='Last Letter','applied proposal becomes next edit baseline');ncd_worker($db,'workerFail',$job);
 // Legacy proposals without a verifiable submitted context stay in history, not the active UI.
 $d=$r['document'];$d['_creative']['proposals']['title']=array_diff_key($old,['contextHash'=>true]);check(empty(ncd_view(array_replace($r,['document'=>$d]))['creative']['proposals']['title']),'unbound legacy result is not current');
 echo "CREATIVE_REVISION_LATEST_INPUT_REQUEST_RACE_FAILED_RETRY_APPLY_GUARDS_OK\n";
})();
