<?php
declare(strict_types=1);
/** N80 Node owns execution capability, not a second workload queue or provider policy. */
function n80_node_contract():array {
    return ['module'=>'node','label'=>'N80 Node','authority'=>'N80 Engine','workloadModule'=>'lab',
        'operations'=>['engine.status','ai.muvy'],'executor'=>'existing_noa_host',
        'transport'=>'existing_n80_auto_tool_channel','daemon'=>false,'maxTasksPerInvocation'=>1];
}
/** Bounded installation evidence only; a manifest never proves current process health. */
function n80_node_installation_status(?string $root=null):array {
    $result=n80_node_contract()+['installed'=>false,'state'=>'not_installed','runtimeHealth'=>'not_checked'];
    $root??=dirname(__DIR__,3).'/noa-ai-lab/host-runtime';
    $path=rtrim($root,'/').'/node-current.json';
    if(!is_file($path))return $result;
    $result['state']='manifest_invalid';
    if(is_link($root)||is_link($path)||filesize($path)>16384)return $result;
    $data=json_decode((string)file_get_contents($path),true);
    if(!is_array($data)||($data['version']??null)!==1||($data['authority']??'')!=='N80 Engine'
        ||!is_string($data['nodeVersion']??null)||!preg_match('/^v24[.][0-9]+[.][0-9]+$/D',$data['nodeVersion'])
        ||!is_bool($data['privateLibraries']??null))return $result;
    foreach(['nodeSha256','bundleSha256']as $key)
        if(!is_string($data[$key]??null)||!preg_match('/^[a-f0-9]{64}$/D',$data[$key]))return $result;
    $binary=$root.'/node-'.substr($data['nodeSha256'],0,16);
    $worker=$root.'/n80-'.substr($data['bundleSha256'],0,16).'/runtime/node/worker.mjs';
    if(!is_file($binary)||is_link($binary)||!is_file($worker)||is_link($worker))return $result;
    return array_replace($result,['installed'=>true,'state'=>'installed_not_probed',
        'nodeVersion'=>$data['nodeVersion'],'bundleSha256'=>$data['bundleSha256']]);
}
