<?php
require __DIR__.'/../../bridge/kcp-test-core.php';
function check(bool $v): void {if(!$v)throw new RuntimeException('check_failed');}
$f=nk_fields('NK'.str_repeat('a',32),true);check($f['site_cd']==='T0000' && $f['pay_method']==='CARD' && $f['good_mny']==='1000');
check(nk_fields($f['ordr_idxx'],false)['pay_method']==='100000000000');
foreach(['../bad','NK'.str_repeat('a',31),'LIVE123'] as $id){try{nk_fields($id,true);throw new LogicException('accepted');}catch(InvalidArgumentException $e){}}
$r=nk_registration_fields(['Code'=>'0000','PayUrl'=>'https://testsmpay.kcp.co.kr/pay/mobileGW.kcp','approvalKey'=>'sample']);check($r['approval_key']==='sample');
foreach(['https://smpay.kcp.co.kr/pay/mobileGW.kcp','https://testsmpay.kcp.co.kr.evil.invalid/pay/x','https://testsmpay.kcp.co.kr/pay/../x','http://testsmpay.kcp.co.kr/pay/x'] as $url){try{nk_registration_fields(['Code'=>'0000','PayUrl'=>$url,'approvalKey'=>'sample']);throw new LogicException('accepted');}catch(RuntimeException $e){if($e instanceof LogicException)throw $e;}}
try{nk_registration_fields(['Code'=>'9999']);throw new LogicException('accepted');}catch(RuntimeException $e){check(str_starts_with($e->getMessage(),'register_rejected:'));}
$certificate=nk_test_certificate();
check(!str_contains($certificate,"\n") && !str_contains($certificate,"\r"));
check(str_starts_with($certificate,'-----BEGIN CERTIFICATE-----') && str_ends_with($certificate,'-----END CERTIFICATE-----'));
$der=base64_decode(substr($certificate,27,-25),true);
check(is_string($der) && openssl_x509_parse("-----BEGIN CERTIFICATE-----\n".chunk_split(base64_encode($der),64,"\n")."-----END CERTIFICATE-----")!==false);
$body=nk_approval_request(['id'=>$f['ordr_idxx'],'mode'=>'test','siteCode'=>'T0000','amount'=>1000],['enc_data'=>'test-only','enc_info'=>'test-only','tran_cd'=>'00100000']);
check($body['kcp_cert_info']===$certificate && !str_contains(json_encode($body),'\\n'));
echo "KCP_TEST_ONLY_FIELDS_AND_REDIRECT_GUARDS_OK\n";

// 결제 검증 보완: exact window-to-approval mapping, unknown method and corrupted quote.
foreach([false,true] as $mobile) foreach(['CARD'=>'PACA','BANK'=>'PABK','MOBX'=>'PAMC'] as $method=>$expected) {
    $f=nk_fields('NK'.str_repeat('b',32),$mobile,$method);
    $d=['id'=>$f['ordr_idxx'],'mode'=>'test','siteCode'=>'T0000','amount'=>1000,'paymentMethod'=>$f['pay_method'],'windowFields'=>$f];
    $auth=['enc_data'=>'unchanged+/%=','enc_info'=>'unchanged-info','tran_cd'=>'00100000'];
    $b=nk_approval_request($d,$auth);
    check($b['pay_type']===$expected && $b['ordr_no']===$f['ordr_idxx'] && (string)$b['ordr_mony']===$f['good_mny'] && $b['enc_data']===$auth['enc_data']);
    foreach(['good_mny'=>'1004','ordr_idxx'=>'other','pay_method'=>'UNKNOWN'] as $k=>$v) {
        try {nk_approval_request($d,$auth+[$k=>$v]);throw new LogicException('accepted mismatch');}catch(DomainException $e){}
    }
    $d['windowFields']['good_mny']='999';
    try {nk_approval_request($d,$auth);throw new LogicException('accepted corrupted stored quote');}catch(DomainException $e){}
}
try {nk_pay_type('UNKNOWN');throw new LogicException('accepted unknown method');}catch(DomainException $e){}
echo "KCP_SIX_METHOD_DEVICE_QUOTES_AND_TAMPER_REJECTION_OK\n";
