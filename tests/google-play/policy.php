<?php
declare(strict_types=1);
require __DIR__.'/../../bridge/google-play-policy.php';
function check($v,$name){if(!$v)throw new RuntimeException($name);}
function deny($f,$code){try{$f();}catch(DomainException $e){check($e->getMessage()===$code,$e->getMessage());return;}throw new RuntimeException('accepted_'.$code);}
$a=ngp_account('member',str_repeat('s',32));
check(strlen($a)===64&&$a!==ngp_account('other',str_repeat('s',32)),'account_binding');
$p=['purchaseState'=>0,'consumptionState'=>0,'obfuscatedExternalAccountId'=>$a,'quantity'=>1];
check(ngp_validate($p,'noa_points_10000',$a,'live')['totalPoints']===11000,'bonus');
foreach([1,2,null]as $v)deny(fn()=>ngp_validate(array_replace($p,['purchaseState'=>$v]),'noa_points_10000',$a,'live'),'purchase_not_completed');
deny(fn()=>ngp_validate($p,'noa_points_10000','other','live'),'purchase_owner_mismatch');
deny(fn()=>ngp_validate($p,'bad',$a,'live'),'invalid_product');
deny(fn()=>ngp_validate(array_replace($p,['quantity'=>2]),'noa_points_10000',$a,'live'),'purchase_quantity_mismatch');
deny(fn()=>ngp_validate(array_replace($p,['refundableQuantity'=>0]),'noa_points_10000',$a,'live'),'purchase_quantity_mismatch');
deny(fn()=>ngp_validate(array_replace($p,['productId'=>'other']),'noa_points_10000',$a,'live'),'purchase_product_mismatch');
deny(fn()=>ngp_validate($p,'noa_points_10000',$a,'test'),'purchase_mode_mismatch');
check(ngp_validate($p+['purchaseType'=>0],'noa_points_10000',$a,'live')['test'],'live_test_isolation');
check(ngp_validate($p+['purchaseType'=>0],'noa_points_10000',$a,'test')['test'],'test_mode');
echo "PLAY_POLICY_PENDING_OWNER_PRODUCT_QUANTITY_TEST_ISOLATION_OK\n";
