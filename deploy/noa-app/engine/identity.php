<?php
declare(strict_types=1);
/**
 * N80 ENGINE canonical identity. Existing NOA ENGINE module names and entrypoints
 * remain valid as compatibility aliases; no migrations or destructive renames.
 */
function n80_engine_identity(): array {
    return [
        'id'=>'n80-engine',
        'name'=>'N80 ENGINE',
        'legacyName'=>'NOA ENGINE',
        'controller'=>'Chat Assistant',
        'platform'=>'NOA STUDIO 2.0',
        'schemaVersion'=>1,
        'compatibility'=>'preserve_existing',
        'runtimeActivation'=>'disabled',
    ];
}
