<?php
declare(strict_types=1);
require __DIR__.'/../subscription/native_fixture.php';define('NOA_PLAY_TEST_HARNESS',true);require __DIR__.'/../../bridge/google-play-core.php';
function check($v,$name){if(!$v)throw new RuntimeException($name);}
function deny($f,$code){try{$f();}catch(DomainException $e){check($e->getMessage()===$code,$e->getMessage());return;}throw new RuntimeException('accepted_'.$code);}
$c=['enabled'=>true,'packageName'=>'kr.ai.noastudio','accountSecret'=>str_repeat('s',32),'mode'=>'live','refundSyncVerified'=>true];
foreach(['play_owner','play_other','play_test','play_rollback']as $m)ns_q('INSERT INTO g5_member VALUES('.ns_e($m).',2,0)');
$p=['purchaseState'=>0,'consumptionState'=>0,'obfuscatedExternalAccountId'=>ngp_account('play_owner',$c['accountSecret'])];
$consumeFails=true;$GLOBALS['ngp_test_transport']=function($path,$method)use(&$p,&$consumeFails){if($method==='GET')return $p;if($consumeFails)throw new DomainException('play_verification_pending');return [];};
deny(fn()=>ngp_confirm('play_other','noa_points_10000','fixture-token-1',$c),'purchase_owner_mismatch');
check(get_point_sum('play_other')===0,'no_wrong_owner_credit');
deny(fn()=>ngp_confirm('play_owner','noa_points_10000','fixture-token-1',$c),'play_verification_pending');
check(get_point_sum('play_owner')===11000,'commit_before_consume');$consumeFails=false;
ngp_confirm('play_owner','noa_points_10000','fixture-token-1',$c);check(get_point_sum('play_owner')===11000,'consume_retry_exactly_once');
$p['consumptionState']=1;ngp_confirm('play_owner','noa_points_10000','fixture-token-1',$c);check(get_point_sum('play_owner')===11000,'consumed_receipt_replay');
deny(fn()=>ngp_confirm('play_owner','noa_points_10000','unknown-consumed-token',$c),'purchase_already_consumed');
insert_point('play_owner',-3000,'spend','fixture','play','spend');ngp_refund('fixture-token-1');ngp_refund('fixture-token-1');check(get_point_sum('play_owner')===-3000,'refund_once_even_after_spend');
deny(fn()=>ngp_confirm('play_owner','noa_points_10000','fixture-token-1',$c),'purchase_refunded');
$p=['purchaseState'=>0,'consumptionState'=>0,'obfuscatedExternalAccountId'=>ngp_account('play_test',$c['accountSecret']),'purchaseType'=>0];ngp_confirm('play_test','noa_points_50000','fixture-token-test',$c);check(get_point_sum('play_test')===0,'test_no_operating_credit');ngp_refund('fixture-token-test');check(get_point_sum('play_test')===0,'test_no_operating_refund');
$p=['purchaseState'=>0,'consumptionState'=>0,'obfuscatedExternalAccountId'=>ngp_account('play_rollback',$c['accountSecret'])];
ns_q("CREATE TRIGGER play_credit_failure BEFORE INSERT ON g5_point FOR EACH ROW BEGIN IF NEW.mb_id='play_rollback' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='fixture_failure'; END IF; END");
try{ngp_confirm('play_rollback','noa_points_5000','fixture-token-rollback',$c);throw new RuntimeException('failure_not_injected');}catch(mysqli_sql_exception $e){}
check(get_point_sum('play_rollback')===0&&!ns_doc('googleplay:receipt:'.hash('sha256','fixture-token-rollback')),'receipt_and_credit_rollback');
ns_q('DROP TRIGGER play_credit_failure');ngp_confirm('play_rollback','noa_points_5000','fixture-token-rollback',$c);check(get_point_sum('play_rollback')===5000,'retry_after_rollback');
check(!ngp_ready(array_replace($c,['refundSyncVerified'=>false])),'live_refund_gate');
check(!ngp_ready([]),'disabled_default');
echo "PLAY_MYSQL_REPLAY_REFUND_TEST_ISOLATION_ROLLBACK_OK\n";
