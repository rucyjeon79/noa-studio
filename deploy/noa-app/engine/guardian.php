<?php
declare(strict_types=1);
require_once __DIR__.'/policy.php';
require_once __DIR__.'/readiness.php';
/** Independent, read-only Guardian policy audit. No self-authorization or dispatch. */
function n80_guardian_audit(string $root): array {
    $readiness=n80_engine_readiness($root);
    $policy=n80_policy();
    $checks=[
        'authority_is_user'=>$policy['decisionAuthority']==='user',
        'peers_are_equal'=>$policy['peers']===['chat_assistant','n80_guardian'],
        'assets_preserved'=>$policy['principles']['preserve_existing_assets']===true,
        'bridge_is_single'=>$policy['principles']['single_bridge']===true,
        'dispatch_remains_disabled'=>$readiness['automaticDispatch']==='disabled',
        'integrity_gates_preserved'=>count($policy['nonOverrideable'])===3,
    ];
    return [
        'guardian'=>'N80 GUARDIAN','mode'=>'read_only',
        'policyCompliant'=>!in_array(false,$checks,true),
        'engineOperationalReady'=>$readiness['operationalReady'],
        'checks'=>$checks,
        'decisionAuthority'=>'user',
    ];
}
