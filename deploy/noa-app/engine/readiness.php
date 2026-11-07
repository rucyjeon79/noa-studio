<?php
declare(strict_types=1);
require_once __DIR__.'/n80.php';
require_once __DIR__.'/service-runtime.php';
/** Evidence is supplied only by a server-side verifier, never by HTTP request parameters. */
function n80_operation_readiness(array $evidence=[],?int $now=null):array {
    $now??=time();$operations=[];
    foreach(noa_engine_adapter_manifest() as $id=>$adapter){
        $operation=$adapter['operation']??($id.'.event');$proof=$evidence[$operation]??[];
        $fresh=is_int($proof['checkedAt']??null)&&$proof['checkedAt']<=$now&&$proof['checkedAt']>=$now-3600;
        $installed=($adapter['installed']??false)===true;
        $verified=$installed&&$fresh&&($proof['authenticated']??false)===true
            &&($proof['durableAck']??false)===true&&($proof['replayVerified']??false)===true
            &&($proof['effect']??'')===(['music'=>'music_catalog_availability_verified','playlist'=>'playlist_read_model_verified','world'=>'world_read_model_verified','admin'=>'admin_integrity_audit_verified'][$id]??null);
        $operations[$operation]=['module'=>$id,'installed'=>$installed,'state'=>$verified?'verified':($installed?'runtime_evidence_required':'handler_not_installed'),
            'authenticated'=>$verified,'durableAck'=>$verified,'replayVerified'=>$verified];
    }
    return $operations;
}
/** N80 operational readiness report. Does not activate workers. */
function n80_engine_readiness(string $root,array $evidence=[]): array {
    if(!$evidence){$path=dirname($root).'/noa-ai-lab/state.json';if(is_file($path)&&!is_link($path)&&filesize($path)<16777216){$state=json_decode(file_get_contents($path),true);$evidence=$state['worker']['readiness']??[];}}
    $snapshot=n80_engine_snapshot($root);
    $modules=$snapshot['audit']['modules'];
    $missing=array_values(array_map(
        static fn(array $m): string => $m['id'],
        array_filter($modules,static fn(array $m): bool => $m['sourcePresence']!=='present')
    ));
    $operations=n80_operation_readiness($evidence);
    $gates=[
        'identity'=>($snapshot['identity']['name']==='N80 ENGINE'),
        'contractAudit'=>$snapshot['audit']['ok'],
        'moduleFilesPresent'=>count($missing)===0,
        'authenticatedAdapters'=>!in_array(false,array_column($operations,'authenticated'),true),
        'durableConsumerAcks'=>!in_array(false,array_column($operations,'durableAck'),true),
        'productionReplayTest'=>!in_array(false,array_column($operations,'replayVerified'),true),
    ];
    return [
        'engine'=>'N80 ENGINE',
        'operationalReady'=>!in_array(false,$gates,true),
        'automaticDispatch'=>'disabled',
        'gates'=>$gates,
        'operations'=>$operations,
        'serviceOperations'=>n80_service_operations(),
        'missingModuleFiles'=>$missing,
        'legacyPreserved'=>true,
    ];
}
