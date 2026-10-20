<?php
declare(strict_types=1);
if (PHP_SAPI!=='cli') {http_response_code(403);exit;}
define('_GNUBOARD_',true);
require dirname(__DIR__).'/data/dbconfig.php';
require __DIR__.'/storage.php';
require __DIR__.'/source-import.php';
try {
    $db=noa_bridge_pdo();
    $result=noa_import_source($db);
    $seed=require __DIR__.'/seed.php';$match=0;$missing=[];$changed=[];
    $get=$db->prepare('SELECT payload FROM noa_documents WHERE doc_key=?');
    foreach($seed['items'] as $item){
        $get->execute([$item['key']]);$raw=$get->fetchColumn();
        if($raw===false){$missing[]=$item['key'];continue;}
        $actual=json_decode($raw,true,512,JSON_THROW_ON_ERROR);
        if($actual==$item['payload'])$match++;else $changed[]=$item['key'];
    }
    $result['music_documents']=['source'=>count($seed['items']),'matching'=>$match,'missing'=>$missing,'different_preserved'=>$changed];
    echo json_encode($result,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR).PHP_EOL;
    exit(($result['conflicts']||$missing||$changed)?2:0);
}catch(Throwable $e){echo json_encode(['error'=>get_class($e)]).PHP_EOL;exit(1);}
