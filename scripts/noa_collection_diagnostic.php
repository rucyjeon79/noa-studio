<?php
declare(strict_types=1);
ini_set('display_errors','0');header('Content-Type: application/json');header('Cache-Control: no-store');
if(time()>__EXPIRY__||!hash_equals('__TOKEN_SHA__',hash('sha256',$_SERVER['HTTP_X_NOA_DIAGNOSTIC']??''))){http_response_code(403);exit;}
require dirname(__DIR__).'/common.php';if(session_status()===PHP_SESSION_ACTIVE)session_write_close();
require_once __DIR__.'/storage.php';require_once __DIR__.'/sound-core.php';
$db=noa_bridge_pdo();$result=[];
foreach($db->query("SELECT doc_key,kind,payload,revision FROM noa_documents WHERE kind IN ('single','story','playlist')")as $row){
 $d=json_decode($row['payload'],true);$body=$d['body']??[];$title=(string)($body['confirmedTitle']??$d['title']??'');
 if(!preg_match('/BLOOM|제2회 AMT|미전송|NO LIMITS/iu',$title))continue;
 $result[]=['key'=>$row['doc_key'],'title'=>$title,'kind'=>$row['kind'],'revision'=>(int)$row['revision'],'visibility'=>$d['visibility']??null,'publicStatus'=>$d['publicStatus']??null,'trashed'=>!empty($d['_noaTrash']),'memberVisible'=>noa_sound_visible($d,false),'adminVisible'=>noa_sound_visible($d,true),'genre'=>$d['genreId']??null,'cast'=>$body['thumbCast']??null,'vocal'=>$body['vocal']??null,'members'=>array_map(fn($m)=>['key'=>$m['key']??null],$body['members']??[])];
}
echo json_encode(['ok'=>true,'databaseWrites'=>0,'rows'=>$result],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
