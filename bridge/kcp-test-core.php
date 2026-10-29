<?php
declare(strict_types=1);
if (!defined('_GNUBOARD_') && PHP_SAPI !== 'cli') { http_response_code(403); exit; }
// This module is deliberately test-only. No operating ledger or live URL exists here.
function nk_fields(string $id, bool $mobile): array {
    if (!preg_match('/^NK[0-9a-f]{32}$/D', $id)) throw new InvalidArgumentException('invalid_order');
    return ['site_cd'=>'T0000','site_name'=>'NOA STUDIO TEST','shop_name'=>'NOA STUDIO TEST',
        'currency'=>'410','pay_method'=>$mobile?'CARD':'100000000000','ordr_idxx'=>$id,
        'good_name'=>'NOA 테스트 포인트권','good_mny'=>'1000','good_cd'=>'00',
        'Ret_URL'=>'https://noastudio.ai.kr/noa-kcp-test.php','quotaopt'=>'0',
        'res_cd'=>'','res_msg'=>'','enc_info'=>'','enc_data'=>'','tran_cd'=>''];
}
function nk_register(array $fields): array {
    $body = array_intersect_key($fields, array_flip(['site_cd','ordr_idxx','good_name','good_mny','pay_method','Ret_URL']));
    if (($body['site_cd']??'')!=='T0000' || ($body['pay_method']??'')!=='CARD' || ($body['good_mny']??'')!=='1000') throw new InvalidArgumentException('test_only');
    $h=curl_init('https://testsmpay.kcp.co.kr/trade/register.do');
    curl_setopt_array($h,[CURLOPT_POST=>true,CURLOPT_HTTPHEADER=>['Content-Type: application/json; charset=utf-8'],CURLOPT_POSTFIELDS=>json_encode($body,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_TIMEOUT=>15,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_FOLLOWLOCATION=>false]);
    $raw=curl_exec($h);$status=curl_getinfo($h,CURLINFO_HTTP_CODE);curl_close($h);
    if ($raw===false || $status!==200 || strlen($raw)>65536) throw new RuntimeException('register_unavailable');
    return nk_registration_fields(json_decode($raw,true,32,JSON_THROW_ON_ERROR));
}
function nk_registration_fields(array $r): array {
    if (($r['Code']??'')!=='0000') throw new RuntimeException('register_rejected:'.preg_replace('/[^A-Za-z0-9]/','',(string)($r['Code']??'unknown')));
    $url=$r['PayUrl']??'';$key=$r['approvalKey']??'';
    if (!is_string($url) || !preg_match('~^https://testsmpay\.kcp\.co\.kr/pay/[A-Za-z0-9_./-]+$~D',$url) || str_contains($url,'..') || !is_string($key) || $key==='' || strlen($key)>2048) throw new RuntimeException('invalid_registration');
    return ['PayUrl'=>$url,'approval_key'=>$key];
}
function nk_h(string $s): string { return htmlspecialchars($s,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8'); }

// Durable test receipts share NOA's transactional document store, never its spendable ledger.
function nk_storage(): void { require_once __DIR__.'/subscription-core.php'; }
function nk_order_key(string $id): string { nk_fields($id,false); return 'kcp:test:order:'.$id; }
function nk_order(string $id, ?string $owner=null): array {
    $r=ns_doc(nk_order_key($id));
    if (!$r || ($owner!==null && !hash_equals($owner,$r['data']['ownerId']))) throw new DomainException('order_not_found');
    return $r['data'];
}
function nk_create_order(string $owner,int $now): array {
    if ($owner==='' || strlen($owner)>20) throw new DomainException('login_required');
    $id='NK'.bin2hex(random_bytes(16));
    return ns_atomic($owner,false,function()use($owner,$now,$id){
        $d=['id'=>$id,'ownerId'=>$owner,'siteCode'=>'T0000','mode'=>'test','amount'=>1000,'state'=>'created','createdAt'=>$now,'simulatedPoints'=>0,'creditedPoints'=>0];
        ns_put(nk_order_key($id),'kcp_test_order',$d,0,$owner);return $d;
    });
}
function nk_approval_request(array $order,array $input): array {
    if (($order['mode']??'')!=='test' || ($order['siteCode']??'')!=='T0000' || ($order['amount']??0)!==1000) throw new DomainException('test_only');
    nk_order_key($order['id']);
    foreach(['enc_data'=>65536,'enc_info'=>16384,'tran_cd'=>8] as $key=>$max) {
        if (!is_string($input[$key]??null) || $input[$key]==='' || strlen($input[$key])>$max || str_contains($input[$key],"\0")) throw new InvalidArgumentException('invalid_authentication');
    }
    if (!preg_match('/^[0-9]{8}$/D',$input['tran_cd'])) throw new InvalidArgumentException('invalid_authentication');
    return ['site_cd'=>'T0000','kcp_cert_info'=>nk_test_certificate(),'enc_data'=>$input['enc_data'],'enc_info'=>$input['enc_info'],'tran_cd'=>$input['tran_cd'],
        'ordr_mony'=>$order['amount'],'pay_type'=>'PACA','ordr_no'=>$order['id'],'ordr_idxx'=>$order['id']];
}
function nk_approval_api(array $body): array {
    if (defined('NOA_KCP_TEST_HARNESS') && PHP_SAPI==='cli' && isset($GLOBALS['nk_test_transport'])) return ($GLOBALS['nk_test_transport'])($body);
    if (($body['site_cd']??'')!=='T0000') throw new DomainException('test_only');
    $h=curl_init('https://stg-spl.kcp.co.kr/gw/enc/v1/payment');
    curl_setopt_array($h,[CURLOPT_POST=>true,CURLOPT_HTTPHEADER=>['Content-Type: application/json; charset=utf-8'],CURLOPT_POSTFIELDS=>json_encode($body,JSON_THROW_ON_ERROR),CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_TIMEOUT=>20,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS]);
    $raw=curl_exec($h);$code=curl_getinfo($h,CURLINFO_HTTP_CODE);curl_close($h);
    if (!is_string($raw) || $code!==200 || strlen($raw)>262144) throw new RuntimeException('approval_unknown');
    $r=json_decode($raw,true,32,JSON_THROW_ON_ERROR);
    if (!is_array($r) || !is_string($r['res_cd']??null) || !preg_match('/^[A-Za-z0-9]{4}$/D',$r['res_cd'])) throw new RuntimeException('approval_unknown');
    return $r;
}
function nk_validate_approval(array $d,array $r): void {
    if (($d['mode']??'')!=='test' || ($d['siteCode']??'')!=='T0000') throw new DomainException('test_only');
    if (($r['res_cd']??'')!=='0000' || !in_array($r['amount']??null,[$d['amount'],(string)$d['amount']],true) || ($r['pay_method']??'')!=='PACA' || !is_string($r['tno']??null) || !preg_match('/^[0-9]{14}$/D',$r['tno'])) throw new DomainException('approval_mismatch');
    // KCP validates ordr_no in the approval request; some responses also echo the order ID.
    if (isset($r['ordr_idxx']) && $r['ordr_idxx']!==$d['id']) throw new DomainException('approval_mismatch');
}
function nk_finish(string $id,array $response,int $now): array {
    $order=nk_order($id);nk_validate_approval($order,$response);
    return ns_atomic($order['ownerId'],false,function()use($id,$response,$now){
        $row=ns_doc(nk_order_key($id),true);$d=$row['data'];nk_validate_approval($d,$response);
        if ($d['state']==='approved') {if (($d['transactionId']??'')!==$response['tno']) throw new DomainException('receipt_conflict');return $d;}
        if ($d['state']!=='processing') throw new DomainException('approval_state_conflict');
        $receipt='kcp:test:receipt:'.hash('sha256',$response['tno']);$seen=ns_doc($receipt,true);
        if ($seen && $seen['data']['orderId']!==$id) throw new DomainException('receipt_conflict');
        if (!$seen) ns_put($receipt,'kcp_test_receipt',['orderId'=>$id,'amount'=>$d['amount'],'simulatedPoints'=>1000,'creditedPoints'=>0],0,$d['ownerId']);
        $d['state']='approved';$d['transactionId']=$response['tno'];$d['verifiedAt']=$now;$d['simulatedPoints']=1000;$d['creditedPoints']=0;
        ns_put(nk_order_key($id),'kcp_test_order',$d,$row['revision'],$d['ownerId']);return $d;
    });
}
function nk_return(string $id,array $input,int $now): array {
    $d=nk_order($id);$body=nk_approval_request($d,$input);
    if (($input['res_cd']??'')!=='0000') throw new DomainException('authentication_incomplete');
    $claimed=ns_atomic($d['ownerId'],false,function()use($id,$now){
        $row=ns_doc(nk_order_key($id),true);$d=$row['data'];
        if ($d['state']!=='created') return false;
        if ($now-$d['createdAt']>1800 || $now<$d['createdAt']) throw new DomainException('order_expired');
        $d['state']='processing';$d['attemptedAt']=$now;ns_put(nk_order_key($id),'kcp_test_order',$d,$row['revision'],$d['ownerId']);return true;
    });
    // A timeout or interrupted worker must never issue another approval blindly.
    if (!$claimed) return nk_order($id);
    $responseCode=null;
    try {
        $response=nk_approval_api($body);
        $responseCode=$response['res_cd'];
        if (($response['res_cd']??'')==='0000') return nk_finish($id,$response,$now);
        $state='declined';
    } catch (Throwable $e) { $state='review'; }
    return ns_atomic($d['ownerId'],false,function()use($id,$state,$now,$responseCode){
        $row=ns_doc(nk_order_key($id),true);$d=$row['data'];
        if ($d['state']!=='processing') return $d;
        $d['state']=$state;$d['verifiedAt']=$now;
        // Keep only the validated provider code, never encrypted auth or card data.
        if (is_string($responseCode) && preg_match('/^[A-Za-z0-9]{4}$/D',$responseCode)) $d['responseCode']=$responseCode;
        ns_put(nk_order_key($id),'kcp_test_order',$d,$row['revision'],$d['ownerId']);return $d;
    });
}

// Official PUBLIC T0000 test certificate (2026–2031); never a merchant credential.
// Source: https://developer.kcp.co.kr/download/cert/splCert.pem
function nk_test_certificate(): string {
    $pem=<<<'PEM'
-----BEGIN CERTIFICATE-----
MIIDgTCCAmmgAwIBAgIHBzKxiAs+9jANBgkqhkiG9w0BAQsFADBzMQswCQYDVQQGE
wJLUjEOMAwGA1UECAwFU2VvdWwxEDAOBgNVBAcMB0d1cm8tZ3UxFTATBgNVBAoMDE
5ITktDUCBDb3JwLjETMBEGA1UECwwKSVQgQ2VudGVyLjEWMBQGA1UEAwwNc3BsLmt
jcC5jby5rcjAeFw0yNjA2MjkwNjEwNTdaFw0zMTA2MjgwNjEwNTdaMHAxCzAJBgNV
BAYTAktSMQ4wDAYDVQQIDAVTZW91bDEQMA4GA1UEBwwHR3Vyby1ndTERMA8GA1UEC
gwITG9jYWxXZWIxETAPBgNVBAsMCERFVlBHV0VCMRkwFwYDVQQDDBAyMDIxMDYyOT
EwMDAwMDI0MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAppkVQkU4SwN
TYbIUaNDVhu2w1uvG4qip0U7h9n90cLfKymIRKDiebLhLIVFctuhTmgY7tkE7yQTN
kD+jXHYufQ/qj06ukwf1BtqUVru9mqa7ysU298B6l9v0Fv8h3ztTYvfHEBmpB6AoZ
DBChMEua7Or/L3C2vYtU/6lWLjBT1xwXVLvNN/7XpQokuWq0rnjSRThcXrDpWMbqY
YUt/CL7YHosfBazAXLoN5JvTd1O9C3FPxLxwcIAI9H8SbWIQKhap7JeA/IUP1Vk4K
/o3Yiytl6Aqh3U1egHfEdWNqwpaiHPuM/jsDkVzuS9FV4RCdcBEsRPnAWHz10w8CX
7e7zdwIDAQABox0wGzAOBgNVHQ8BAf8EBAMCB4AwCQYDVR0TBAIwADANBgkqhkiG9
w0BAQsFAAOCAQEAt8c1yT65AP32LOAaADoPelluhBgFVYEiFNOTTjO34ZO5X17ySA
zQmIKc+3K4TesH46zSe1F91CBvBLjUCvWgzrycevdtqinOgDkN3J9zSGc5aw5sRIS
rK4mdQ/Hx/TtT6mc2jiuJo4k6iBWWMtJnCOHl9urei3HIMR8quRIHMCFDfCpkjXez
EUvM3kw6TCCeTkII7K+RZxQRyhI1xJzLsCMl1I9H+Znt/aBjFz4MWayXmE6yFZ+Gp
T+BL5lG/J9PSUQLb5mVp7+PXJhepSQRYDYrvtX5oL8J6CZz91K8gxJxD2qX1AI72P
ej4M9lVDLGtvVfndE4bazMZEyj2O42hw==
-----END CERTIFICATE-----
PEM;
    $c=openssl_x509_parse($pem);
    if (!$c || time()<$c['validFrom_time_t'] || time()>=$c['validTo_time_t']) throw new DomainException('test_certificate_expired');
    return $pem;
}
