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
