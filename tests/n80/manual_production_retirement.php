<?php
declare(strict_types=1);
require __DIR__.'/../../deploy/noa-app/engine/scheduled-wake.php';
require __DIR__.'/../../deploy/noa-app/engine/shorts-execution-audit.php';
function check(bool $ok,string $label):void {if(!$ok)throw new RuntimeException($label);}
foreach([[],['githubWakeActivated'=>true,'requiresHostingApproval'=>false,'n80BoundedExecutorVerified'=>true]] as $policy){
 $r=n80_scheduled_wake_contract([],[],$policy,[],time(),['enabled'=>true]);check(!$r['ok']&&!$r['executionAllowed'],'old flags cannot reactivate');
 check(n80_scheduled_wake_snapshot($policy,[])['state']==='retired','retirement status');
}
try{n80_scheduled_wake_admit('/unreachable',[],'',time());throw new RuntimeException('admitted');}catch(DomainException $e){check($e->getMessage()==='scheduled_wake_retired','no disk access');}
check(n80_shorts_execution_audit([],[],[],[],time())['schedule']===null,'no next automatic slot');
foreach(['','claim','storage_claim','assembly_claim','claim_subtitles'] as $command){
 $context=['hostOperation'=>'ai.daily_shorts_clock'];$action='n80_daily_shorts_tick';$b=['command'=>$command];
 $r=require __DIR__.'/../../bridge/worker-shorts.php';check($r['state']==='retired'&&$r['processed']===0&&$r['uploads']===0,'legacy worker cannot execute');
}
echo "Retired wake and automatic Shorts cannot execute even with old activation flags.\n";
