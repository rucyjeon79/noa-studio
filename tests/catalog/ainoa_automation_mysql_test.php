<?php
/** Isolated SQL and explicit provider fixtures. No billable generation. */
declare(strict_types=1);define('_GNUBOARD_',true);
if(!str_contains((string)getenv('NOA_MYSQL_DSN'),'dbname=noa_inline_edit_test;'))throw new RuntimeException('isolated_database_required');
require_once __DIR__.'/../../bridge/storage.php';require_once __DIR__.'/../../bridge/ainoa-automation.php';
$db=noa_bridge_pdo();$other=noa_bridge_pdo();$owner='n80-test-admin';$calls=0;
function nt_assert(bool $v,string $m):void{if(!$v)throw new RuntimeException($m);}
function nt_deny(callable $fn,string $code):void{try{$fn();}catch(DomainException $e){nt_assert($e->getMessage()===$code,'wrong_error:'.$e->getMessage());return;}throw new RuntimeException('not_denied:'.$code);}
$source=$db->query("SELECT doc_key,payload,revision FROM noa_documents WHERE kind IN ('single','story','playlist') ORDER BY doc_key")->fetchAll(PDO::FETCH_ASSOC);
$request='n80-request-00000001';$input=['conversationId'=>'n80-thread-00000001','question'=>'제작 작업을 도와줘','trackKey'=>''];
$task=n80_ai_enqueue($db,$owner,$request,'chat',$input);nt_assert($task['state']==='queued','durable_queue');
nt_assert(n80_ai_enqueue($other,$owner,$request,'chat',$input)===$task,'same_request_replayed');
nt_deny(fn()=>n80_ai_enqueue($db,$owner,$request,'chat',$input+['extra'=>'changed']),'ai_request_conflict');
nt_assert(n80_ai_read($db,$task['id'],'another-owner')===null,'owner_isolation');
nt_deny(fn()=>n80_ai_enqueue($db,$owner,'n80-request-00000002','chat',array_replace($input,['question'=>'중복 진행'])),'ai_conversation_pending');
$callback=function($t)use(&$calls,$other,$owner){$calls++;$inflight=n80_ai_run($other,$owner,$t['id'],fn()=>throw new RuntimeException('duplicate_provider_call'));nt_assert($inflight['state']==='running','concurrent_execution_excluded');return ['text'=>'테스트 응답','usage'=>['actualUsd'=>null]];};
$finished=n80_ai_run($db,$owner,$task['id'],$callback);nt_assert($finished['state']==='succeeded'&&$calls===1,'completed_once');
n80_ai_run($db,$owner,$task['id'],$callback);nt_assert($calls===1,'network_retry_no_charge');
$second=n80_ai_enqueue($db,$owner,'n80-request-00000003','chat',array_replace($input,['question'=>'앞의 내용을 이어서'])) ;nt_assert(count($second['context']['conversation'])===2,'persisted_conversation_context');
$failed=n80_ai_run($db,$owner,$second['id'],function()use(&$calls){$calls++;throw new DomainException('ai_result_unconfirmed');});nt_assert($failed['state']==='needs_review','uncertain_response_requires_review');
n80_ai_run($db,$owner,$second['id'],$callback);nt_assert($calls===2,'uncertain_response_not_reissued');
$third=n80_ai_enqueue($db,$owner,'n80-request-00000004','chat',array_replace($input,['conversationId'=>'n80-thread-00000002']));
$cancel=n80_ai_cancel($db,$owner,$third['id'],1);nt_assert($cancel['state']==='cancelled','cancel_pending');n80_ai_run($db,$owner,$third['id'],$callback);nt_assert($calls===2,'cancel_never_calls_provider');
$fourth=n80_ai_enqueue($db,$owner,'n80-request-00000005','chat',array_replace($input,['conversationId'=>'n80-thread-00000003']));$busy=n80_ai_read($db,$fourth['id'],$owner);$busy['state']='running';$busy['startedAt']=time()-150;n80_ai_save($db,$busy);nt_assert(n80_ai_public($busy)['state']==='needs_review','crashed_worker_not_requeued');
$gen=['selector'=>['type'=>'song','source'=>'music','key'=>'single:kpop-original:01'],'field'=>'youtubeTitle','fields'=>[],'expectedRevision'=>1,'requestId'=>'n80-request-00000006'];
$draft=n80_ai_enqueue($db,$owner,$gen['requestId'],'generate',$gen);$draft=n80_ai_run($db,$owner,$draft['id'],fn()=>['text'=>'생성 제목 초안']);nt_assert($draft['state']==='review'&&n80_ai_public($draft)['songSaved']===false,'draft_is_not_published');
nt_assert($source===$db->query("SELECT doc_key,payload,revision FROM noa_documents WHERE kind IN ('single','story','playlist') ORDER BY doc_key")->fetchAll(PDO::FETCH_ASSOC),'existing_songs_preserved');
nt_assert(!isset(n80_ai_public($draft)['context'])&&!isset(n80_ai_public($draft)['input']),'private_context_not_in_task_projection');
echo "N80_AI_SQL_QUEUE_OWNER_REPLAY_CONCURRENCY_CONTEXT_FAILURE_CANCEL_DRAFT_PRESERVATION_OK\n";
