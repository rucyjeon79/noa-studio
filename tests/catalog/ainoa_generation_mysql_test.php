<?php
/** Isolated CI SQL. Provider callbacks are fixtures, never billable API calls. */
declare(strict_types=1);
require_once __DIR__.'/../../bridge/storage.php';require_once __DIR__.'/../../bridge/ainoa-generation.php';
$db=noa_bridge_pdo();$other=noa_bridge_pdo();$calls=0;$id='11111111-2222-4333-8444-555555555555';$hash=na_generation_fingerprint(['field'=>'youtubeTitle','fields'=>['title'=>'곡'],'expectedRevision'=>1]);
function ng_check(bool $v,string $message):void{if(!$v)throw new RuntimeException($message);}
function ng_denied(callable $fn,string $code):void{try{$fn();}catch(DomainException $e){ng_check($e->getMessage()===$code,'wrong_error:'.$e->getMessage());return;}throw new RuntimeException('not_rejected:'.$code);}
$before=$db->query("SELECT doc_key,payload,revision FROM noa_documents WHERE kind IN ('single','story','playlist') ORDER BY doc_key")->fetchAll(PDO::FETCH_ASSOC);
$generate=function()use(&$calls,$other,$id,$hash){$calls++;ng_denied(fn()=>na_generate_once($other,'fixture-admin',$id,$hash,fn()=>throw new RuntimeException('duplicate_provider_call')),'ai_request_pending');return ['text'=>'검토용 AI 초안','usage'=>['inputTokens'=>21,'outputTokens'=>8,'reservedUsd'=>.1,'actualUsd'=>null]];};
$a=na_generate_once($db,'fixture-admin',$id,$hash,$generate);$b=na_generate_once($db,'fixture-admin',$id,$hash,$generate);
ng_check($calls===1&&$a['saved']===false&&$b['replayed']===true&&$a['text']===$b['text'],'replay_no_second_call');
ng_denied(fn()=>na_generate_once($db,'fixture-admin',$id,str_repeat('0',64),$generate),'ai_request_conflict');
$failed='99999999-2222-4333-8444-555555555555';$failing=function()use(&$calls){$calls++;throw new DomainException('ai_result_unconfirmed');};
ng_denied(fn()=>na_generate_once($db,'fixture-admin',$failed,$hash,$failing),'ai_result_unconfirmed');$beforeRetry=$calls;
ng_denied(fn()=>na_generate_once($db,'fixture-admin',$failed,$hash,$failing),'ai_result_unconfirmed');ng_check($beforeRetry===$calls,'ambiguous_failure_not_rebilled');
$owner=na_generate_once($db,'different-admin',$id,$hash,fn()=>['text'=>'다른 관리자 초안']);ng_check($owner['text']!==$a['text'],'receipt_is_owner_scoped');
ng_check(na_generation_fingerprint(['b'=>1,'a'=>['d'=>2,'c'=>3]])===na_generation_fingerprint(['a'=>['c'=>3,'d'=>2],'b'=>1]),'fingerprint_order_stable');
$after=$db->query("SELECT doc_key,payload,revision FROM noa_documents WHERE kind IN ('single','story','playlist') ORDER BY doc_key")->fetchAll(PDO::FETCH_ASSOC);ng_check($before===$after,'generation_must_not_save_song');
echo "AINOA_GENERATION_SQL_PENDING_REPLAY_CONFLICT_FAILURE_OWNER_SOURCE_PRESERVATION_OK\n";
