<?php
(function()use($db,$owner){
 $id=str_repeat('9',32);$draft=ncd_create($db,$owner,$id,'저녁 산책을 노래로 만들고 싶어요.');
 $queued=ncd_enqueue($db,$owner,['id'=>$id,'revision'=>$draft['revision'],'operation'=>'analyze','requestId'=>bin2hex(random_bytes(16))],fn()=>204);
 $job=$queued['job']['id'];$claim=ncd_worker($db,'workerPoll',$job,['agentVersion'=>1]);$lease=$claim['agentLease'];
 denied(fn()=>ncd_worker($db,'read',$job),'agent_lease_conflict');
 check(ncd_worker($db,'read',$job,['_agentLease'=>$lease])['id']===$job,'agent has scoped source');
 $history=function()use($db,$job){$q=$db->prepare('SELECT COUNT(*) FROM noa_document_history WHERE doc_key=?');$q->execute(['n80:creative-job:'.$job]);return (int)$q->fetchColumn();};$before=$history();
 $state=['_agentLease'=>$lease,'sequence'=>0,'checkpoint'=>['plan'=>['확인된 의도를 읽고 필요한 조건을 질문한다'],'candidate'=>'invalid JSON','decisions'=>1,'observation'=>null]];
 ncd_worker($db,'agentCheckpoint',$job,$state);$bad=ncd_worker($db,'agentValidate',$job,['_agentLease'=>$lease,'text'=>'invalid JSON']);
 check(!$bad['validation']['valid']&&ncd_job($db,$job)['document']['state']==='running','invalid draft stays repairable');
 $questions=[];foreach(NCD_CONDITIONS as $key)$questions[$key]=['prompt'=>$key.' 선택','options'=>['첫 번째','두 번째','세 번째','네 번째']];
 $text=ncd_json(['intent'=>[],'questions'=>$questions]);$state['sequence']=1;$state['checkpoint']['candidate']=$text;$state['checkpoint']['decisions']=2;
 ncd_worker($db,'agentCheckpoint',$job,$state);check(ncd_worker($db,'agentValidate',$job,['_agentLease'=>$lease,'text'=>$text])['validation']['valid'],'real four-choice validator passed');
 check($history()===$before,'agent checkpoints do not grow history');
 $result=ncd_worker($db,'save',$job,['_agentLease'=>$lease,'text'=>$text]);check($result['saved'],'validated candidate saved');
 check(ncd_worker($db,'save',$job,['_agentLease'=>$lease,'text'=>$text])['saved'],'lost save replays same output');
 $draft=ncd_row($db,$id,$owner);check(count($draft['document']['_creative']['questions'])===8,'real SQL questions stored');
 $queued=ncd_enqueue($db,$owner,['id'=>$id,'revision'=>$draft['revision'],'operation'=>'analyze','requestId'=>bin2hex(random_bytes(16))],fn()=>204);
 $job=$queued['job']['id'];$lease=ncd_worker($db,'workerPoll',$job,['agentVersion'=>1])['agentLease'];
 $draft=ncd_row($db,$id,$owner);ncd_save($db,$owner,['id'=>$id,'revision'=>$draft['revision'],'story'=>'이제 새벽 바다 이야기로 바꿔요.']);
 denied(fn()=>ncd_worker($db,'read',$job,['_agentLease'=>$lease]),'draft_changed');
 denied(fn()=>ncd_worker($db,'agentState',$job,['_agentLease'=>$lease]),'draft_changed');
 ncd_worker($db,'workerFail',$job,['_agentLease'=>$lease]);
 echo "N80_AGENT_CREATIVE_REPAIR_CURRENT_SOURCE_SQL_RECEIPT_OK\n";
})();
