<?php
require __DIR__.'/../../bridge/kcp-test-core.php';
function check(bool $v): void {if(!$v)throw new RuntimeException('check_failed');}
$f=nk_fields('NK'.str_repeat('a',32),true);check($f['site_cd']==='T0000' && $f['pay_method']==='CARD' && $f['good_mny']==='1000');
check(nk_fields($f['ordr_idxx'],false)['pay_method']==='100000000000');
foreach(['../bad','NK'.str_repeat('a',31),'LIVE123'] as $id){try{nk_fields($id,true);throw new LogicException('accepted');}catch(InvalidArgumentException $e){}}
$r=nk_registration_fields(['Code'=>'0000','PayUrl'=>'https://testsmpay.kcp.co.kr/pay/mobileGW.kcp','approvalKey'=>'sample']);check($r['approval_key']==='sample');
foreach(['https://smpay.kcp.co.kr/pay/mobileGW.kcp','https://testsmpay.kcp.co.kr.evil.invalid/pay/x','https://testsmpay.kcp.co.kr/pay/../x','http://testsmpay.kcp.co.kr/pay/x'] as $url){try{nk_registration_fields(['Code'=>'0000','PayUrl'=>$url,'approvalKey'=>'sample']);throw new LogicException('accepted');}catch(RuntimeException $e){if($e instanceof LogicException)throw $e;}}
try{nk_registration_fields(['Code'=>'9999']);throw new LogicException('accepted');}catch(RuntimeException $e){check(str_starts_with($e->getMessage(),'register_rejected:'));}
echo "KCP_TEST_ONLY_FIELDS_AND_REDIRECT_GUARDS_OK\n";
