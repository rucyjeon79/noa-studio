<?php
declare(strict_types=1);
/**
 * N80 constitutional policy: user-approved architecture is the reference for
 * assistant/guardian disagreement. Security and integrity safeguards remain.
 */
function n80_policy(): array {
    return [
        'version'=>2,
        'decisionAuthority'=>'user',
        'peers'=>['chat_assistant','n80_guardian'],
        'principles'=>[
            'preserve_existing_assets'=>true,
            'reuse_common_modules'=>true,
            'single_bridge'=>true,
            'n80_only_execution'=>true,
            'single_owner_per_operation'=>true,
            'registry_owned_navigation'=>true,
            'activate_selected_module_only'=>true,
            'forbid_parallel_legacy_runtime'=>true,
            'avoid_duplicate_processing'=>true,
            'deploy_after_validation'=>true,
            'keep_legacy_queues_intact'=>true,
        ],
        // Architecture requirements, not a claim that every deployed caller has migrated.
        'execution'=>[
            'authority'=>'N80 Engine',
            'standaloneRuntimeAllowed'=>false,
            'parallelLegacyExecutionAllowed'=>false,
            'moduleActivation'=>'on_demand',
            'registrationIsExecutionProof'=>false,
            'conformance'=>'requires_runtime_evidence',
        ],
        'nonOverrideable'=>['authorization','data_integrity','credential_protection'],
    ];
}
function n80_resolve_disagreement(string $topic,?bool $assistant,?bool $guardian): array {
    $policy=n80_policy();
    if($assistant===$guardian)return ['status'=>'agreed','decision'=>$assistant];
    if(array_key_exists($topic,$policy['principles']))
        return ['status'=>'resolved_by_user_policy','decision'=>$policy['principles'][$topic]];
    return ['status'=>'requires_user_decision','decision'=>null];
}
