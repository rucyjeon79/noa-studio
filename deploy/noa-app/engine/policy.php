<?php
declare(strict_types=1);
/**
 * N80 constitutional policy: user-approved architecture is the reference for
 * assistant/guardian disagreement. Security and integrity safeguards remain.
 */
function n80_policy(): array {
    return [
        'version'=>1,
        'decisionAuthority'=>'user',
        'peers'=>['chat_assistant','n80_guardian'],
        'principles'=>[
            'preserve_existing_assets'=>true,
            'reuse_common_modules'=>true,
            'single_bridge'=>true,
            'avoid_duplicate_processing'=>true,
            'deploy_after_validation'=>true,
            'keep_legacy_queues_intact'=>true,
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
