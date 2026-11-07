from pathlib import Path
import os
site=Path(os.environ.get('NCD_SITE','/tmp/noa-creative-test/html'))
(site/'common.php').write_text('''<?php
define('_GNUBOARD_',true);session_start();$is_member=true;$is_admin='super';$member=['mb_id'=>'browser-owner','mb_level'=>10];$config=['cf_admin'=>'browser-owner'];
''')
p=site/'noa-bridge/creative.php';s=p.read_text().replace('ncd_enqueue($db,$owner,$b)','ncd_enqueue($db,$owner,$b,static fn()=>204)');s=s.replace("error_log('[n80-creative] '.get_class($e))","error_log('[n80-creative] '.get_class($e).':'.$e->getMessage())");p.write_text(s)
(site/'creative-test-worker.php').write_text('''<?php
require __DIR__.'/common.php';require __DIR__.'/noa-bridge/storage.php';require __DIR__.'/noa-bridge/sound-core.php';require __DIR__.'/noa-app/engine/creative.php';
header('Content-Type: application/json');$db=noa_bridge_pdo();$id=$_GET['id'];$job=ncd_job($db,$id);ncd_worker($db,'workerPoll',$id);$j=$job['document'];
if($j['operation']==='analyze'){$questions=[];foreach(NCD_CONDITIONS as $k)$questions[$k]=['prompt'=>$k.' 선택','options'=>['따뜻하고 담담한 선택','밝고 경쾌한 선택','쓸쓸하고 느린 선택','강렬하고 빠른 선택']];$result=['intent'=>[],'questions'=>$questions];}
else{$fields=[];foreach($j['targets'] as $k)$fields[$k]=$k==='creativeFields'?['storyPlan'=>'퇴근길 가족을 떠올리는 이야기']:($k==='title'?'집으로 가는 마음':$k.' 생성된 내용');$result=['fields'=>$fields,'vocal'=>'여자솔로'];}
echo json_encode(ncd_worker($db,'save',$id,['text'=>ncd_json($result)]));
''')
print('CREATIVE_HTTP_FIXTURE_READY')
