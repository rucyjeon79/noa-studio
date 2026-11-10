<?php
declare(strict_types=1);
/** Independent, read-only Guardian policy audit. No self-authorization or dispatch. */
function n80_guard_audit(string $root): array {
    require_once __DIR__.'/policy.php';
    require_once __DIR__.'/readiness.php';
    $readiness=n80_engine_readiness($root);
    $policy=n80_policy();
    $checks=[
        'authority_is_user'=>$policy['decisionAuthority']==='user',
        'peers_are_equal'=>$policy['peers']===['chat_assistant','n80_guardian'],
        'assets_preserved'=>$policy['principles']['preserve_existing_assets']===true,
        'bridge_is_single'=>$policy['principles']['single_bridge']===true,
        'n80_only_execution_required'=>$policy['principles']['n80_only_execution']===true&&$policy['execution']['standaloneRuntimeAllowed']===false,
        'single_owner_required'=>$policy['principles']['single_owner_per_operation']===true&&$policy['execution']['parallelLegacyExecutionAllowed']===false,
        'lazy_activation_required'=>$policy['principles']['activate_selected_module_only']===true&&$policy['execution']['moduleActivation']==='on_demand',
        'registry_navigation_required'=>$policy['principles']['registry_owned_navigation']===true,
        'runtime_proof_required'=>$policy['execution']['registrationIsExecutionProof']===false,
        'dispatch_remains_disabled'=>$readiness['automaticDispatch']==='disabled',
        'integrity_gates_preserved'=>count($policy['nonOverrideable'])===3,
    ];
    return [
        'guardian'=>'N80 GUARDIAN','module'=>'guard','mode'=>'read_only',
        'policyCompliant'=>!in_array(false,$checks,true),
        'runtimeConformance'=>'not_verified',
        'engineOperationalReady'=>$readiness['operationalReady'],
        'checks'=>$checks,
        'decisionAuthority'=>'user',
    ];
}

/** Gate shared by specialized service owners; the verified bridge supplies context. */
function n80_guard_service_check(?array $operation,array $context):array {
    require_once __DIR__.'/registry.php';
    if(!$operation)return ['ok'=>false,'error'=>'unknown_operation'];
    if(($context['authenticatedByServer']??null)!==true||($context['principal']??'')!=='n80_lab_worker'
       ||!in_array($operation['permission'],$context['permissions']??[],true))return ['ok'=>false,'error'=>'unauthorized'];
    if(($context['method']??'')!==$operation['method'])return ['ok'=>false,'error'=>'method_not_allowed'];
    if(!isset(noa_engine_modules()[$operation['module']]))return ['ok'=>false,'error'=>'unregistered_module'];
    return ['ok'=>true,'operation'=>$operation];
}
