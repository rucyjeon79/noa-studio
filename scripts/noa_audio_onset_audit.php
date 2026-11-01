<?php
declare(strict_types=1);
header('Content-Type: application/json');header('Cache-Control: no-store');
if(time()>__EXPIRY__||!hash_equals('__TOKEN_SHA__',hash('sha256',$_SERVER['HTTP_X_NOA_DIAGNOSTIC']??''))){http_response_code(403);exit;}
require dirname(__DIR__).'/common.php';
require_once __DIR__.'/storage.php';
require_once __DIR__.'/inline-edit.php';
require_once dirname(__DIR__).'/noa-app/jukebox/core.php';
$db=noa_bridge_pdo();
$matches=[];
foreach($db->query("SELECT a.*,d.payload FROM noa_jukebox_assets a JOIN noa_documents d ON d.doc_key=a.song_key WHERE a.status='ready' AND a.audio_path<>''") as $row){
 $doc=json_decode($row['payload'],true);
 if((int)($doc['ep']??0)===32&&nup_fields($doc)['title']==='작은 떨림')$matches[]=$row;
}
if(count($matches)!==1||!nj_verified($matches[0],'audio')){http_response_code(409);exit;}
$a=$matches[0];
echo json_encode(['ok'=>true,'path'=>nj_file($a['audio_path']),'sha'=>$a['audio_sha256'],'source'=>json_decode($a['source_analysis']??'null',true)['lufs']??null,'final'=>json_decode($a['final_analysis']??'null',true)['lufs']??null]);
