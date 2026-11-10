<?php
declare(strict_types=1);
require_once dirname(__DIR__,2).'/deploy/noa-app/engine/service-runtime.php';
require_once dirname(__DIR__,2).'/deploy/noa-app/engine/readiness.php';
function runtime_expect(bool $condition,string $message):void {if(!$condition)throw new RuntimeException($message);}
$modules=noa_engine_modules();
foreach(['creator_lab','sign','pay','notifications','catalog','personalization','install','lab','node','setup','db'] as $id)
    runtime_expect(isset($modules[$id])&&$modules[$id]['sources']!==[],'missing_owner:'.$id);
runtime_expect(array_keys(n80_module_links())===array_keys($modules),'audit_registry_drift');
runtime_expect(n80_module_links()['creator_lab']!==[],'creator_lab_not_observed');
$context=['authenticatedByServer'=>true,'principal'=>'n80_lab_worker','permissions'=>['ai:text'],'method'=>'POST'];
runtime_expect(n80_service_check('n80_text_tick',$context)['ok'],'text_operation_unavailable');
runtime_expect(!n80_service_check('n80_listening_index',$context)['ok'],'cross_module_permission');
runtime_expect(!n80_service_check('n80_text_tick',array_replace($context,['authenticatedByServer'=>false]))['ok'],'untrusted_flag');
runtime_expect(!n80_service_check('n80_text_tick',array_replace($context,['method'=>'GET']))['ok'],'GET_mutation');
runtime_expect(!n80_service_check('../../outside',$context)['ok'],'arbitrary_handler');
foreach(n80_service_operations() as $id=>$operation){
    runtime_expect(isset($modules[$operation['module']]),'unknown_operation_owner');
    runtime_expect(is_file(dirname(__DIR__,2).'/bridge/'.$operation['handler']),'handler_missing');
}
foreach(['queued_text'=>'queued','mastering_audio'=>'running','review'=>'needs_review','unconfirmed'=>'needs_review','published'=>'succeeded','cancelled'=>'cancelled','bogus'=>'unknown'] as $native=>$expected)
    runtime_expect(n80_task_status('ai_lab','one',$native)['state']===$expected,'task_state:'.$native);
runtime_expect(n80_task_status('ai_lab','one','review')['terminal']===false,'review_claimed_complete');
$proof=['checkedAt'=>1000,'authenticated'=>true,'durableAck'=>true,'replayVerified'=>true,'effect'=>'music_catalog_availability_verified'];
$readiness=n80_operation_readiness(['music.verify_availability'=>$proof],1000);
runtime_expect($readiness['music.verify_availability']['state']==='verified','verified_evidence_not_used');
runtime_expect($readiness['playlist.verify_read_model']['state']==='runtime_evidence_required','music_evidence_enabled_playlist');
runtime_expect(n80_operation_readiness(['music.verify_availability'=>$proof],5000)['music.verify_availability']['state']==='runtime_evidence_required','stale_evidence');
$automation=json_decode(file_get_contents(dirname(__DIR__,2).'/config/n80-automation.json'),true,512,JSON_THROW_ON_ERROR);
foreach($automation['operations'] as $operation)runtime_expect(isset($modules[$operation['module']]),'automation_owner_missing');
echo "N80_RUNTIME_OWNERSHIP_OK\n";
