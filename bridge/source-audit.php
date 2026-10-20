<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/common.php';
require_once __DIR__.'/storage.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: private, no-store');
header('X-Content-Type-Options: nosniff');
if(empty($is_member)||($is_admin??'')!=='super'){http_response_code(403);exit;}
try {
    $db=noa_bridge_pdo();$source=require __DIR__.'/source-archive.php';$seed=require __DIR__.'/seed.php';
    $get=$db->prepare('SELECT source_bytes FROM noa_source_files WHERE path_hash=?');
    $archive=['expected'=>count($source['files']),'verified'=>0,'missing'=>[],'different'=>[]];
    foreach($source['files'] as $f){
        $get->execute([hash('sha256',$f['path'])]);$raw=$get->fetchColumn();
        if($raw===false)$archive['missing'][]=$f['path'];
        elseif(hash('sha256',$raw)!==$f['sha256'])$archive['different'][]=$f['path'];else $archive['verified']++;
    }
    $music=['expected'=>count($seed['items']),'matching'=>0,'missing'=>[],'different'=>[],'genres'=>[],'source_fields'=>[]];
    $get=$db->prepare('SELECT payload FROM noa_documents WHERE doc_key=?');
    foreach($seed['items'] as $item){
        $p=$item['payload'];$genre=$p['genreId'];$kind=$item['kind'];
        $music['genres'][$genre][$kind]=($music['genres'][$genre][$kind]??0)+1;
        foreach(['lyricsBlock','thumbUrl','thumbCast','youtubeUrl','sunoUrl'] as $field)
            if(!empty($p['body'][$field]))$music['source_fields'][$field]=($music['source_fields'][$field]??0)+1;
        $get->execute([$item['key']]);$raw=$get->fetchColumn();
        if($raw===false)$music['missing'][]=$item['key'];
        elseif(json_decode($raw,true,512,JSON_THROW_ON_ERROR)!==$p)$music['different'][]=$item['key'];else $music['matching']++;
    }
    echo json_encode(['source'=>'GitHub repository snapshot','archive'=>$archive,'music'=>$music],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
}catch(Throwable $e){http_response_code(503);echo json_encode(['error'=>'이전 검증 자료를 아직 조회할 수 없습니다.']);error_log('[noa-source-audit] '.get_class($e));}
