<?php
declare(strict_types=1);
/** Shared read-only status. Importing this file never reads state or starts work. */
require_once __DIR__.'/identity.php';
require_once __DIR__.'/versioning.php';
require_once __DIR__.'/health.php';
require_once __DIR__.'/hub-connections.php';
require_once __DIR__.'/guard.php';
require_once __DIR__.'/runtime-prerequisites.php';

/** Project trusted server observations. Do not accept this evidence from an HTTP body. */
function n80_system_project(array $modules,array $hub,array $connections,array $runtime,array $releases,bool $recovery,?int $now=null):array {
    $now??=time();$routes=n80_hub_operations();$services=n80_service_operations();$operations=[];$verified=0;$owned=0;
    $pending=[];foreach($runtime['pending']??[] as $row)$pending[$row['operation']]=$row;
    foreach($hub['operations']??[] as $op){
        $id=$op['id'];if(!isset($routes[$id]))continue;$route=$routes[$id];$last=$op['last']??[];
        $host=($op['owner']??'')==='n80_hub';if($host)$owned++;
        $at=(int)($last['finishedAt']??$last['startedAt']??0);$age=$at>0&&$at<=$now?$now-$at:null;
        $fresh=$age!==null&&$age<=max(180,$route['interval']*2+$route['timeout']);
        $state='not_verified';
        if(!$host)$state='migration_pending';
        elseif(!empty($pending[$id]['unconfirmed']))$state='needs_review';
        elseif(($last['state']??'')==='failed')$state='failed';
        elseif(($last['state']??'')==='running')$state=$age!==null&&$age<=$route['timeout']+60?'running':'needs_review';
        elseif(($last['state']??'')==='succeeded')$state=$fresh?'verified':'stale';
        if($state==='verified')$verified++;
        $operations[]=['id'=>$id,'label'=>$route['label'],'module'=>$route['module'],'owner'=>$host?'n80_hub':'legacy',
            'state'=>$state,'lastAt'=>$at?:null,'ageSeconds'=>$age,'intervalSeconds'=>$route['interval'],
            'evidenceScope'=>'host_operation_receipt','pending'=>isset($pending[$id]),
            'outcome'=>$id==='ai.daily_shorts_clock'?($last['outcome']??null):null];
    }
    $missing=[];$moduleRows=[];
    foreach($modules as $module){
        $id=$module['id'];$ownOps=array_values(array_filter($operations,static fn($op)=>$op['module']===$id));
        $active=array_values(array_filter($ownOps,static fn($op)=>$op['owner']==='n80_hub'));
        $present=($module['sourcePresence']??'missing')==='present';if(!$present)$missing[]=$id;
        $state=$present?'registered':'source_missing';
        if($present&&$active){
            $allVerified=count(array_filter($active,static fn($op)=>$op['state']==='verified'))===count($active);
            $allHealthy=count(array_filter($active,static fn($op)=>in_array($op['state'],['verified','running'],true)))===count($active);
            $state=$allVerified?'automation_verified':($allHealthy?'automation_running':'execution_attention');
        }
        // Provider evidence verifies only this MCP connection; never production media execution.
        if($present&&$id==='mcp'){
            $mcp=$connections['integrations']['notebooklm']['mcp']??[];
            if(($mcp['transport']??'')==='mcp')$state=in_array($mcp['state']??'',['connected','check_required','verification_required','authorization_required'],true)?$mcp['state']:'not_verified';
        }
        $moduleRows[]=['id'=>$id,'label'=>$module['label'],'owner'=>$module['owner'],'entry'=>$module['entry']??null,
            'dependencies'=>$module['dependencies']??[],'sourcePresence'=>$present?'present':'missing','missingSources'=>$module['missingSources']??[],
            'state'=>$state,'services'=>array_keys(array_filter($services,static fn($s)=>$s['module']===$id)),
            'hostOperations'=>array_column($ownOps,'id'),'interactiveExecutionVerified'=>false];
    }
    $heartbeat=(int)($hub['heartbeatAt']??0);$heartbeatAge=$heartbeat>0&&$heartbeat<=$now?$now-$heartbeat:null;
    $retirement=$runtime['residentRetirement']??$hub['residentRetirement']??['verified'=>false];
    $retired=($retirement['verified']??false)===true;
    $running=!$retired&&$heartbeatAge!==null&&$heartbeatAge<180;$paused=($hub['paused']??true)===true;
    $runnerState=$retired?'retired':(($retirement['state']??'')==='needs_review'?'needs_review':($running?'running':'not_verified'));
    $issues=$connections['issues']??[];$available=($hub['ok']??false)===true;
    $executing=count(array_filter($operations,static fn($op)=>$op['owner']==='n80_hub'&&$op['state']==='running'));
    $unconfirmed=array_filter($pending,static fn($row)=>!empty($row['unconfirmed']));
    // A bounded in-flight job or a normal retry is not an execution failure. Stale
    // receipts and unconfirmed execution still require review and never go green.
    $runtimeError=$runtime['errorState']??(!empty($runtime['lastError'])?'needs_review':'none');
    $healthy=$available&&$running&&!$paused&&!$recovery&&!$missing&&!$issues&&!$unconfirmed&&$runtimeError!=='needs_review'&&$owned>0&&$verified+$executing===$owned;
    $state=!$available?'unavailable':($recovery?'needs_review':($paused?'paused':(!$running?'not_verified':($healthy?'running':'needs_review'))));
    $google=[];
    foreach($connections['integrations']['google']['services']??[] as $id=>$row){
        $google[$id]=['state'=>(string)($row['state']??'not_verified'),'executionVerified'=>($row['executionVerified']??false)===true,'verifiedAt'=>$row['verifiedAt']??null];
        if(isset($row['executionScope']))$google[$id]['executionScope']=$row['executionScope'];
        if(isset($row['sessionEvidence']))$google[$id]['sessionEvidence']=$row['sessionEvidence'];
    }
    $recent=[];
    foreach(array_reverse(array_slice($releases,-5))as $release)$recent[]=['id'=>$release['id']??null,'revision'=>(int)($release['revision']??0),
        'state'=>$release['state']??(($release['ok']??false)?'verified':'not_verified'),'appliedAt'=>$release['verifiedAt']??$release['appliedAt']??$release['at']??null,
        'fileCount'=>count($release['files']??[])];
    $versionReadiness=n80_version_quality_gate([
        'runnerState'=>$runnerState,
        'hostAutomationHealthy'=>$healthy,
        'counts'=>['hostOwned'=>$owned,'hostVerified'=>$verified],
        'pendingOperationCount'=>count($pending),
        'unconfirmedOperationCount'=>count($unconfirmed),
        'recoveryRequired'=>$recovery,
        'missingModules'=>$missing,
        'connectionIssues'=>$issues,
        'fullSystemVerified'=>false,
    ]);
    return ['ok'=>$available,'contract'=>'n80_system_v1','identity'=>n80_engine_identity(),'checkedAt'=>$now,'mode'=>'read_only',
        'sourceRevision'=>(int)($hub['source']['revision']??0),'version'=>n80_display_version($hub['source']??[]),'state'=>$state,'versionReadiness'=>$versionReadiness,'versionTransitionPreview'=>n80_version_transition_preview($hub['source']??[]),'hostAutomationHealthy'=>$healthy,
        'runnerState'=>$runnerState,'residentRetirement'=>$retirement,'heartbeatAgeSeconds'=>$heartbeatAge,'paused'=>$paused,'recoveryRequired'=>$recovery,
        'runtime'=>['errorState'=>$runtimeError,'lastError'=>$runtime['lastError']??null,'recoveredAt'=>$runtime['recoveredAt']??null],
        'runtimePrerequisites'=>n80_runtime_prerequisites(),
        'counts'=>['modules'=>count($moduleRows),'services'=>count($services),'hostOperations'=>count($routes),'hostOwned'=>$owned,'hostVerified'=>$verified],
        'modules'=>$moduleRows,'operations'=>$operations,'missingModules'=>$missing,'connectionIssues'=>$issues,
        'pendingOperationCount'=>count($pending),'unconfirmedOperationCount'=>count($unconfirmed),
        'guardTriage'=>n80_guard_unconfirmed_diagnostics($hub['operations']??[],$runtime['pending']??[],$now),
        'wakePreflight'=>$hub['wakePreflight']??['ok'=>false,'mode'=>'not_verified','productionReady'=>false],
        'wakeTicketAudit'=>$hub['wakeTicketAudit']??['ok'=>false,'state'=>'not_verified','signalCount'=>0,'businessExecutionVerified'=>false],
        'wakeHostCanary'=>$hub['wakeHostCanary']??['ok'=>false,'mode'=>'not_verified','businessOperationsExecuted'=>0],
        'mediaRecoveryAssessment'=>n80_guard_media_recovery_assessment($hub['operations']??[],$hub['covers']??[]),
        'mediaCoverEvidence'=>[
            'checkedAt'=>isset($hub['covers']['checkedAt'])?(int)$hub['covers']['checkedAt']:null,
            'ok'=>($hub['covers']['ok']??null)===true,
            'attempted'=>(int)($hub['covers']['attempted']??0),
            'recovered'=>(int)($hub['covers']['recovered']??0),
            'remaining'=>isset($hub['covers']['remaining'])?(int)$hub['covers']['remaining']:null,
            'audioFilesChanged'=>isset($hub['covers']['audioFilesChanged'])?(int)$hub['covers']['audioFilesChanged']:null,
            'evidencePresent'=>isset($hub['covers']['checkedAt']),
            'executionReceiptVerified'=>(n80_guard_media_recovery_assessment($hub['operations']??[],$hub['covers']??[])['executionIdCorrelated']??false)===true,
        ],
        'unmigratedOperations'=>$connections['unmigratedOperations']??[],
        'externalDispatchSourceReferences'=>$connections['externalDispatchSourceReferences']??[],
        'google'=>['manager'=>'notebooklm','services'=>$google,'automaticScopeExpansion'=>false],
        'eventConsumerDispatch'=>['enabled'=>false,'scope'=>'event_consumers','evidenceRequired'=>true],
        'fullSystemVerified'=>false,'verificationScope'=>'local_source_and_host_receipts','recentReleases'=>$recent,
        'generationRequests'=>0,'databaseWrites'=>0,'providerRequests'=>0,'workerStarts'=>0];
}

/** Private root stays server-controlled. Errors produce a bounded, credential-free report. */
function n80_system_snapshot(string $web,?string $root=null,?array $evidence=null):array {
    $root??=n80_hub_root();$modules=noa_engine_health_snapshot($web)['modules'];
    try{
        $hub=$evidence['hub']??n80_hub_status($root);
        $connections=$evidence['connections']??n80_hub_connections($root,$web);
        $runtime=$evidence['runtime']??n80_hub_runtime_diagnostics($root,(int)($hub['heartbeatAt']??0));
        $releases=$evidence['releases']??n80_hub_read($root,'releases.json');
        $recovery=$evidence['recovery']??(bool)n80_hub_read($root,'journal.json');
        return n80_system_project($modules,$hub,$connections,$runtime,$releases,$recovery);
    }catch(Throwable $e){
        return n80_system_project($modules,[],['issues'=>[['code'=>'status_unavailable']]],[],[],false);
    }
}
