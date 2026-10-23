<?php
declare(strict_types=1);
require_once __DIR__.'/n80.php';
/** N80 operational readiness report. Does not activate workers. */
function n80_engine_readiness(string $root): array {
    $snapshot=n80_engine_snapshot($root);
    $modules=$snapshot['audit']['modules'];
    $missing=array_values(array_map(
        static fn(array $m): string => $m['id'],
        array_filter($modules,static fn(array $m): bool => $m['sourcePresence']!=='present')
    ));
    $gates=[
        'identity'=>($snapshot['identity']['name']==='N80 ENGINE'),
        'contractAudit'=>$snapshot['audit']['ok'],
        'moduleFilesPresent'=>count($missing)===0,
        'authenticatedAdapters'=>false,
        'durableConsumerAcks'=>false,
        'productionReplayTest'=>false,
    ];
    return [
        'engine'=>'N80 ENGINE',
        'operationalReady'=>!in_array(false,$gates,true),
        'automaticDispatch'=>'disabled',
        'gates'=>$gates,
        'missingModuleFiles'=>$missing,
        'legacyPreserved'=>true,
    ];
}
