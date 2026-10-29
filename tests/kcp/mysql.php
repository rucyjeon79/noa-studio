<?php
require __DIR__.'/../subscription/native_fixture.php';
define('NOA_KCP_TEST_HARNESS',true);
require __DIR__.'/../../bridge/kcp-test-core.php';
function verify($v,$m){if(!$v)throw new RuntimeException($m);}
function denied(callable $f){try{$f();}catch(DomainException|InvalidArgumentException $e){return;}throw new RuntimeException('expected_rejection');}
$now=time();$auth=['res_cd'=>'0000','enc_data'=>'test-encrypted','enc_info'=>'test-info','tran_cd'=>'00100000'];
$good=['res_cd'=>'0000','tno'=>'12345678901234','amount'=>'1000','pay_method'=>'PACA'];
$before=ns_one('SELECT COUNT(*) AS n FROM g5_point')['n'];
$d=nk_create_order('regular',$now);$calls=0;
$GLOBALS['nk_test_transport']=function($body)use(&$calls,$d,$good){$calls++;verify($body['ordr_no']===$d['id']&&$body['ordr_mony']===1000&&$body['pay_type']==='PACA'&&$body['site_cd']==='T0000','stored_quote');return $good;};
denied(fn()=>nk_order($d['id'],'creator'));
$r=nk_return($d['id'],$auth+['good_mny'=>'1'],$now);verify($r['state']==='approved'&&$r['simulatedPoints']===1000&&$r['creditedPoints']===0,'approval_recorded');
verify(nk_return($d['id'],$auth,$now)===$r&&$calls===1,'replay_no_provider_call');
$d2=nk_create_order('regular',$now);$GLOBALS['nk_test_transport']=fn($b)=>$good;
verify(nk_return($d2['id'],$auth,$now)['state']==='review','transaction_id_cannot_credit_another_order');
foreach(['amount'=>999,'pay_method'=>'PABK','tno'=>'invalid','ordr_idxx'=>'other'] as $k=>$v){$o=nk_create_order('regular',$now);$GLOBALS['nk_test_transport']=fn($b)=>array_replace($good,[$k=>$v]);verify(nk_return($o['id'],$auth,$now)['state']==='review','mismatch_'.$k);}
$o=nk_create_order('regular',$now);$calls=0;$GLOBALS['nk_test_transport']=function($b)use(&$calls){$calls++;throw new RuntimeException('timeout');};
verify(nk_return($o['id'],$auth,$now)['state']==='review','timeout_never_success');nk_return($o['id'],$auth,$now+1);verify($calls===1,'unknown_not_reapproved');
$o=nk_create_order('regular',$now);$GLOBALS['nk_test_transport']=fn($b)=>['res_cd'=>'8350'];verify(nk_return($o['id'],$auth,$now)['state']==='declined','provider_rejected');
$o=nk_create_order('regular',$now-1801);denied(fn()=>nk_return($o['id'],$auth,$now));
$o=nk_create_order('regular',$now);denied(fn()=>nk_return($o['id'],array_replace($auth,['enc_info'=>[]]),$now));verify(nk_order($o['id'])['state']==='created','invalid_before_claim');
// Reentrant callback simulates a second worker after the durable processing claim.
$o=nk_create_order('regular',$now);$calls=0;$GLOBALS['nk_test_transport']=function($b)use(&$calls,$o,$auth,$now,$good){$calls++;verify(nk_return($o['id'],$auth,$now)['state']==='processing','concurrent_claim');return array_replace($good,['tno'=>'12345678901235']);};
verify(nk_return($o['id'],$auth,$now)['state']==='approved'&&$calls===1,'one_provider_request');
// Local write failure rolls back the receipt and simulated credit together.
$o=nk_create_order('regular',$now);ns_q("CREATE TRIGGER kcp_fail BEFORE UPDATE ON noa_documents FOR EACH ROW BEGIN IF @kcp_fail=1 AND NEW.kind='kcp_test_order' AND JSON_UNQUOTE(JSON_EXTRACT(NEW.payload,'$.state'))='approved' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='test_failure'; END IF; END");
ns_q('SET @kcp_fail=1');$GLOBALS['nk_test_transport']=fn($b)=>array_replace($good,['tno'=>'12345678901236']);verify(nk_return($o['id'],$auth,$now)['state']==='review','failed_commit_not_success');ns_q('SET @kcp_fail=0');verify(!ns_doc('kcp:test:receipt:'.hash('sha256','12345678901236')),'receipt_rolled_back');
verify(ns_one('SELECT COUNT(*) AS n FROM g5_point')['n']===$before,'zero_spendable_ledger_changes');
$raw=ns_one("SELECT GROUP_CONCAT(payload) AS p FROM noa_documents WHERE kind LIKE 'kcp_test%'")['p'];verify(!str_contains($raw,'test-encrypted')&&!str_contains($raw,'BEGIN CERTIFICATE'),'no_sensitive_auth_persistence');
echo "KCP_MYSQL_APPROVAL_REPLAY_MISMATCH_TIMEOUT_ROLLBACK_NO_NATIVE_POINTS_OK\n";
