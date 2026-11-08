<?php
declare(strict_types=1);ini_set('display_errors','0');header('Content-Type: application/json');header('Cache-Control: no-store');
if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||time()>__EXPIRY__||!hash_equals('__TOKEN_SHA__',hash('sha256',$_SERVER['HTTP_X_NOA_CONTROL']??''))){http_response_code(404);exit;}
$level=ob_get_level();ob_start();require_once dirname(__DIR__).'/common.php';if(session_status()===PHP_SESSION_ACTIVE)session_write_close();
try{
 require_once __DIR__.'/storage.php';$db=noa_bridge_pdo();$b=json_decode(file_get_contents('php://input'),true,32,JSON_THROW_ON_ERROR);
 if(($b['phase']??'')==='prepare'){
  __SCHEMA__
  ncd_schema($db);$checks=['schemaReady'=>true,'existingIncompleteGraceHours'=>24];
 }elseif(($b['phase']??'')==='verify'){
  require_once __DIR__.'/sound-core.php';require_once dirname(__DIR__).'/noa-app/engine/creative.php';ncd_schema($db);
  $before=(int)$db->query('SELECT COUNT(*) FROM noa_creative_drafts')->fetchColumn();$rejected=false;
  try{ncd_create($db,(string)$config['cf_admin'],'__DRAFT_ID__','   ');}catch(InvalidArgumentException $e){if($e->getMessage()!=='content_required')throw $e;$rejected=true;}
  $after=(int)$db->query('SELECT COUNT(*) FROM noa_creative_drafts')->fetchColumn();if(!$rejected||$before!==$after)throw new RuntimeException('empty_create_guard_failed');
  $checks=['emptyCreateRejected'=>true,'emptyCreateRowsAdded'=>$after-$before,'retentionSeconds'=>86400];
 }elseif(($b['phase']??'')==='verify_published'){
  require_once __DIR__.'/sound-core.php';require_once dirname(__DIR__).'/noa-app/engine/creative.php';
  $db->exec('SET TRANSACTION READ ONLY');$db->beginTransaction();
  try{
   $owners=$db->query('SELECT DISTINCT owner_id FROM noa_creative_drafts ORDER BY owner_id LIMIT 50')->fetchAll(PDO::FETCH_COLUMN);$visible=0;$expired=0;$now=time();
   foreach($owners as $owner){$list=ncd_list($db,$owner,[],$now);foreach($list['items'] as $item){$visible++;if(!empty($item['listExpiresAt'])&&$item['listExpiresAt']<=$now)$expired++;}}
   if($expired)throw new RuntimeException('expired_publication_visible');
   $q=$db->query("SELECT c.owner_id,JSON_EXTRACT(d.payload,'$._creative.summary') AS summary,JSON_UNQUOTE(JSON_EXTRACT(d.payload,'$._creative.publication.at')) AS published_at FROM noa_creative_drafts c JOIN noa_documents d ON d.doc_key=c.doc_key WHERE c.retained_at IS NOT NULL AND JSON_UNQUOTE(JSON_EXTRACT(d.payload,'$._creative.summary.stage'))='published' ORDER BY c.created_at DESC LIMIT 20");$boundaries=0;
   foreach($q->fetchAll(PDO::FETCH_ASSOC) as $row){$at=strtotime($row['published_at']??'');if($at===false)continue;$summary=json_decode($row['summary'],true);$options=['q'=>$summary['title'],'filter'=>'published'];$before=ncd_list($db,$row['owner_id'],$options,$at+86399);$after=ncd_list($db,$row['owner_id'],$options,$at+86400);if(in_array($summary['id'],array_column($before['items'],'id'),true)){if(in_array($summary['id'],array_column($after['items'],'id'),true))throw new RuntimeException('publication_boundary_failed');$boundaries++;}}
   $checks=['ownersChecked'=>count($owners),'visibleDrafts'=>$visible,'expiredVisible'=>$expired,'livePublicationBoundariesChecked'=>$boundaries,'registrationRetentionSeconds'=>86400,'readOnlyVerification'=>true];
  }finally{$db->rollBack();}
 }else throw new InvalidArgumentException('invalid_phase');
 $counts=$db->query("SELECT SUM(c.retained_at IS NOT NULL) AS retained,SUM(c.retained_at IS NULL AND c.recovery_until IS NOT NULL) AS recovery,SUM(c.retained_at IS NULL AND d.revision=1 AND TRIM(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(d.payload,'$._creative.story')),''))='' AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(d.payload,'$._creative.summary.title')),'')='' AND JSON_EXTRACT(d.payload,'$._creative.summary.completion')=0) AS legacyEmpty FROM noa_creative_drafts c JOIN noa_documents d ON d.doc_key=c.doc_key WHERE d.kind='n80_creative_draft'")->fetch(PDO::FETCH_ASSOC);
 $out=['ok'=>true,'result'=>$checks+['counts'=>array_map('intval',$counts),'contentDeleted'=>0]];
}catch(Throwable $e){http_response_code(500);$out=['ok'=>false,'error'=>$e->getMessage()];}
while(ob_get_level()>$level)ob_end_clean();echo json_encode($out,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
