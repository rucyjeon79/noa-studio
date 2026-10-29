<?php
declare(strict_types=1);
if (!defined('_GNUBOARD_')) { http_response_code(403); exit; }
require_once __DIR__.'/membership-core.php';
require_once __DIR__.'/google-play-policy.php';
function ngp_config(): array {
    $path=dirname(__DIR__,2).'/noa-private/google-play.php';
    $c=is_file($path)&&!is_link($path)?require $path:[];
    return is_array($c)?$c:[];
}
function ngp_ready(array $c): bool {
    return (is_file(dirname(__DIR__,2).'/noa-private/google-play-service-account.json') || (defined('NOA_PLAY_TEST_HARNESS') && PHP_SAPI==='cli')) && ($c['enabled']??false)===true && ($c['packageName']??'')==='kr.ai.noastudio'
        && in_array($c['mode']??'',['test','live'],true) && strlen($c['accountSecret']??'')>=32
        && ($c['mode']!=='live'||($c['refundSyncVerified']??false)===true);
}
function ngp_http(string $url,string $method,array $headers,?string $body=null): array {
    if (!function_exists('curl_init')) throw new DomainException('play_unavailable');
    $h=curl_init($url);
    curl_setopt_array($h,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,CURLOPT_CONNECTTIMEOUT=>3,CURLOPT_TIMEOUT=>15,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_CUSTOMREQUEST=>$method,CURLOPT_HTTPHEADER=>$headers]);
    if ($body!==null) curl_setopt($h,CURLOPT_POSTFIELDS,$body);
    $raw=curl_exec($h);$code=(int)curl_getinfo($h,CURLINFO_RESPONSE_CODE);curl_close($h);
    if (!is_string($raw)||strlen($raw)>2097152||$code<200||$code>=300) throw new DomainException('play_verification_pending');
    if ($raw==='') return [];
    $d=json_decode($raw,true,64,JSON_THROW_ON_ERROR);
    if (!is_array($d)) throw new DomainException('play_verification_pending');
    return $d;
}
function ngp_access_token(): string {
    static $token=null;
    if ($token!==null) return $token;
    // Fixed private path; never accept service-account files or URLs from a request.
    $path=dirname(__DIR__,2).'/noa-private/google-play-service-account.json';
    if (!is_file($path)||is_link($path)) throw new DomainException('play_not_configured');
    $sa=json_decode(file_get_contents($path),true,16,JSON_THROW_ON_ERROR);
    if (($sa['type']??'')!=='service_account'||!is_string($sa['private_key']??null)||!is_string($sa['client_email']??null)) throw new DomainException('play_not_configured');
    $b64=static fn(string $s)=>rtrim(strtr(base64_encode($s),'+/','-_'),'=');$now=time();
    $jwt=$b64(json_encode(['alg'=>'RS256','typ'=>'JWT'],JSON_THROW_ON_ERROR)).'.'.$b64(json_encode(['iss'=>$sa['client_email'],'scope'=>'https://www.googleapis.com/auth/androidpublisher','aud'=>'https://oauth2.googleapis.com/token','iat'=>$now,'exp'=>$now+3600],JSON_THROW_ON_ERROR));
    if (!openssl_sign($jwt,$signature,$sa['private_key'],OPENSSL_ALGO_SHA256)) throw new DomainException('play_not_configured');
    $r=ngp_http('https://oauth2.googleapis.com/token','POST',['Content-Type: application/x-www-form-urlencoded'],http_build_query(['grant_type'=>'urn:ietf:params:oauth:grant-type:jwt-bearer','assertion'=>$jwt.'.'.$b64($signature)]));
    if (!is_string($r['access_token']??null)||$r['access_token']==='') throw new DomainException('play_not_configured');
    return $token=$r['access_token'];
}
function ngp_api(array $c,string $suffix,string $method='GET'): array {
    if (defined('NOA_PLAY_TEST_HARNESS') && PHP_SAPI==='cli' && isset($GLOBALS['ngp_test_transport'])) return ($GLOBALS['ngp_test_transport'])($suffix,$method);
    return ngp_http('https://androidpublisher.googleapis.com/androidpublisher/v3/applications/'.rawurlencode($c['packageName']).'/purchases/'.$suffix,$method,['Authorization: Bearer '.ngp_access_token(),'Content-Type: application/json'],$method==='POST'?'{}':null);
}
function ngp_confirm(string $owner,string $product,string $token,array $c): array {
    if (!ngp_ready($c)) throw new DomainException('play_not_configured');
    if (!isset(ngp_products()[$product])||strlen($token)<8||strlen($token)>4096||preg_match('/[\x00-\x20\x7f]/',$token)) throw new InvalidArgumentException('invalid_request');
    $path='products/'.rawurlencode($product).'/tokens/'.rawurlencode($token);
    $p=ngp_api($c,$path);$q=ngp_validate($p,$product,ngp_account($owner,$c['accountSecret']),$c['mode']);
    $id=hash('sha256',$token);$key='googleplay:receipt:'.$id;
    $d=ns_atomic($owner,true,function()use($owner,$product,$p,$q,$id,$key){
        nr_member($owner);$old=ns_doc($key,true);
        if ($old) {
            $d=$old['data'];
            if ($d['ownerId']!==$owner||$d['productId']!==$product) throw new DomainException('purchase_owner_mismatch');
            if ($d['state']==='refunded') throw new DomainException('purchase_refunded');
            return $d;
        }
        if (($p['consumptionState']??null)!==0) throw new DomainException('purchase_already_consumed');
        // Token itself is never persisted in the generic document/history store.
        $d=['ownerId'=>$owner,'productId'=>$product,'test'=>$q['test'],'totalPoints'=>$q['totalPoints'],'state'=>'credited','createdAt'=>time()];
        ns_put($key,'googleplay_receipt',$d,0,$owner);
        if (!$q['test']) nr_insert_points($owner,$q['totalPoints'],'Google Play 포인트권 구매','noa_googleplay',$id,'paid');
        nr_sync_member($owner,time());return $d;
    });
    // Delivery commits first. A consume timeout is safe to retry without another credit.
    if (($p['consumptionState']??null)===0) ngp_api($c,$path.':consume','POST');
    return ['state'=>$d['state'],'test'=>$d['test'],'totalPoints'=>$d['totalPoints']];
}
function ngp_refund(string $token): void {
    $id=hash('sha256',$token);$key='googleplay:receipt:'.$id;$r=ns_doc($key);
    if (!$r) return;
    $owner=$r['data']['ownerId'];
    ns_atomic($owner,true,function()use($key,$id,$owner){
        $r=ns_doc($key,true);$d=$r['data'];if ($d['state']==='refunded') return;
        nr_member($owner);
        if (!$d['test']) {
            [$rel,$action]=ns_point_relation($id,'refund');
            $level=ob_get_level();ob_start(static fn($s)=>'');
            try {$ok=insert_point($owner,-$d['totalPoints'],'Google Play 결제 취소','noa_googleplay',$rel,$action);$out=ob_get_contents();}
            finally {while(ob_get_level()>$level)ob_end_clean();}
            $v=ns_one('SELECT po_point FROM '.ns_table('point_table').' WHERE mb_id='.ns_e($owner)." AND po_rel_table='noa_googleplay' AND po_rel_id=".ns_e($rel).' AND po_rel_action='.ns_e($action));
            if ($ok!==1||trim($out)!==''||!$v||(int)$v['po_point']!==-$d['totalPoints']) throw new RuntimeException('refund_failed');
        }
        $d['state']='refunded';$d['refundedAt']=time();ns_put($key,'googleplay_receipt',$d,$r['revision'],$owner);nr_sync_member($owner,time());
    });
}
