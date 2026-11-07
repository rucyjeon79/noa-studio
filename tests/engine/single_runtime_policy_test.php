<?php
declare(strict_types=1);
require_once dirname(__DIR__,2).'/deploy/noa-app/engine/guardian.php';
function demand_runtime(bool $ok,string $why):void {if(!$ok)throw new RuntimeException($why);}
$p=n80_policy();
foreach(['n80_only_execution','single_owner_per_operation','registry_owned_navigation','activate_selected_module_only','forbid_parallel_legacy_runtime'] as $rule){
    demand_runtime(($p['principles'][$rule]??null)===true,'user rule lost: '.$rule);
    $resolution=n80_resolve_disagreement($rule,false,true);
    demand_runtime($resolution===['status'=>'resolved_by_user_policy','decision'=>true],'standalone exception accepted: '.$rule);
}
$s=n80_engine_snapshot(dirname(__DIR__,2).'/deploy');
demand_runtime($s['executionPolicy']===$p['execution'],'facade has an independent policy');
demand_runtime($s['executionPolicy']['authority']==='N80 Engine'&&$s['executionPolicy']['standaloneRuntimeAllowed']===false,'independent execution allowed');
demand_runtime($s['executionPolicy']['parallelLegacyExecutionAllowed']===false,'legacy duplicate execution allowed');
demand_runtime($s['executionPolicy']['moduleActivation']==='on_demand','eager module execution allowed');
demand_runtime($s['executionPolicy']['registrationIsExecutionProof']===false,'registration treated as execution proof');
$a=n80_guardian_audit(dirname(__DIR__,2).'/deploy');
demand_runtime($a['policyCompliant']&&$a['runtimeConformance']==='not_verified','guardian fabricated runtime conformance');
demand_runtime($a['engineOperationalReady']===false&&$s['dispatchEnabled']===false,'policy enabled unverified adapters');
demand_runtime(array_keys(n80_workspaces())===['admin','creator_lab','ai_lab'],'workspace split changed');
demand_runtime(array_column(n80_workspaces(),'label')===['홈페이지 설정','CREATOR LAB','AI LAB'],'canonical categories changed');
echo "N80_SINGLE_RUNTIME_POLICY_OK no standalone, no duplicate owner, demand loading, honest conformance\n";
