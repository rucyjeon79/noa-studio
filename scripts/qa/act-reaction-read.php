<?php
declare(strict_types=1);
ini_set('display_errors','0');header('Content-Type: application/json');header('Cache-Control: no-store');
if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||time()>NOA_ENGAGEMENT_EXPIRY||!hash_equals('NOA_ENGAGEMENT_TOKEN_SHA',hash('sha256',(string)($_SERVER['HTTP_X_NOA_CONTROL']??'')))){http_response_code(404);exit;}
$level=ob_get_level();ob_start();require_once dirname(__DIR__).'/common.php';require_once __DIR__.'/storage.php';require_once __DIR__.'/engagement-core.php';
require_once __DIR__.'/engagement-targets.php';
try{
 $db=noa_bridge_pdo();$member=['mb_id'=>'__noa_read_probe','mb_level'=>3];$is_admin='';
 $out=[];$batch=ny_batch($db);
 foreach(ne_rows($db,"SELECT doc_key,payload FROM noa_documents WHERE kind IN ('single','story') AND (doc_key LIKE '%:31' OR doc_key LIKE '%:32' OR doc_key LIKE '%:33')",[]) as $r){
  $d=json_decode($r['payload'],true);
  if(!noa_sound_visible($d,false))continue;
  $k=$r['doc_key'];$aliases=ne_rows($db,'SELECT DISTINCT a.entity_id,v.public_verified FROM noa_catalog_aliases a LEFT JOIN noa_catalog_versions v ON v.entity_id=a.entity_id AND v.batch_id=a.batch_id AND v.entity_type=\'song\' WHERE a.batch_id=? AND a.alias_key=?',[$batch,$k]);
  try{$t=ne_target($db,'music',$k);ne_stats($db,$t);$state='ok';}catch(Throwable $e){$state=$e instanceof DomainException?$e->getMessage():get_class($e);}
  $out[]=[$k,$state,count($aliases),array_column($aliases,'public_verified')];
 }
 $amt=[];
 foreach(['story:your-story:35fa27149612463491996053','catalog:a785dbc3e646c64b54cd1536048100e5ee66f55ec9be69d39e6b5251c91f4bba','story:your-story:6d2ff36af19c40d596c51002'] as $k){
  $t=ne_target($db,'music',$k);$stats=ne_stats($db,$t,true);$comments=ne_comments($db,$t,0);
  $amt[]=['title'=>$t['title'],'like'=>$t['canLike'],'comment'=>$t['canComment'],'counts'=>[$stats['likes'],$stats['comments']],'list'=>isset($comments['items'])];
 }
 $result=['ok'=>true,'rows'=>$out,'amt'=>$amt];
}catch(Throwable $e){$result=['ok'=>false,'class'=>get_class($e)];}
while(ob_get_level()>$level)ob_end_clean();echo json_encode($result,JSON_THROW_ON_ERROR);
