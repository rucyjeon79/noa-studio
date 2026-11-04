<?php
declare(strict_types=1);
// Only the Busan newsroom workflow can post, and its identity token names this exact body.
function bn64(string $value): string {
    $decoded=base64_decode(strtr($value, '-_', '+/'), true);
    if ($decoded === false) throw new RuntimeException('encoding');
    return $decoded;
}
function bn_der(int $tag, string $bytes): string {
    $size=strlen($bytes);
    $long=ltrim(pack('N',$size),"\0");
    return chr($tag).($size<128 ? chr($size) : chr(128+strlen($long)).$long).$bytes;
}
function bn_rsa(array $key): string {
    $integer=static function(string $value): string {
        $bytes=ltrim(bn64($value),"\0");
        if ($bytes==='') throw new RuntimeException('empty key');
        return bn_der(2,ord($bytes[0])>=128 ? "\0".$bytes : $bytes);
    };
    $rsa=bn_der(48,$integer($key['n']).$integer($key['e']));
    $der=bn_der(48,hex2bin('300d06092a864886f70d0101010500').bn_der(3,"\0".$rsa));
    return "-----BEGIN PUBLIC KEY-----\n".chunk_split(base64_encode($der),64,"\n")."-----END PUBLIC KEY-----\n";
}
function bn_identity(string $token, string $body): bool {
    if (strlen($token)>16000 || substr_count($token,'.')!==2) return false;
    [$a,$b,$c]=explode('.',$token);
    $header=json_decode(bn64($a),true,8,JSON_THROW_ON_ERROR);
    $claims=json_decode(bn64($b),true,12,JSON_THROW_ON_ERROR);
    $repo='rucyjeon79/noa-private-worker';
    $issuer='https://token.actions.githubusercontent.com';
    $now=time();
    if (($header['alg']??'')!=='RS256' || empty($header['kid']) ||
        ($claims['iss']??'')!==$issuer || ($claims['aud']??'')!=='https://skhnslu-busan.com/newsroom/'.hash('sha256',$body) ||
        ($claims['repository_id']??'')!=='1442403680' || ($claims['repository']??'')!==$repo ||
        ($claims['ref']??'')!=='refs/heads/main' || ($claims['workflow_ref']??'')!==$repo.'/.github/workflows/busan-newsroom.yml@refs/heads/main' ||
        !in_array($claims['event_name']??'',['schedule','workflow_dispatch','push'],true) ||
        ($claims['iat']??0)<$now-600 || ($claims['iat']??PHP_INT_MAX)>$now+30 ||
        ($claims['nbf']??PHP_INT_MAX)>$now+30 || ($claims['exp']??0)<=$now) return false;
    $ch=curl_init($issuer.'/.well-known/jwks');
    curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>8,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS]);
    $body=curl_exec($ch); $code=curl_getinfo($ch,CURLINFO_RESPONSE_CODE);
    if ($code!==200 || !is_string($body) || strlen($body)>100000) throw new UnexpectedValueException('key discovery');
    foreach (json_decode($body,true,10,JSON_THROW_ON_ERROR)['keys'] as $key) {
        if (($key['kid']??null)===$header['kid'] && ($key['kty']??'')==='RSA')
            return openssl_verify($a.'.'.$b,bn64($c),bn_rsa($key),OPENSSL_ALGO_SHA256)===1;
    }
    return false;
}
if ($_SERVER['REQUEST_METHOD']!=='POST') {http_response_code(405); exit;}
try {
    $requestBody=file_get_contents('php://input',false,null,0,60001);
    if (strlen($requestBody)>60000 || !bn_identity($_SERVER['HTTP_X_BUSAN_RUN']??'', $requestBody)) {
        header('X-Busan-News-Status: identity'); http_response_code(403); exit;
    }
} catch (UnexpectedValueException $e) {header('X-Busan-News-Status: provider'); http_response_code(503); exit;}
catch (Throwable $e) {header('X-Busan-News-Status: token'); http_response_code(403); exit;}
define('BUSAN_ACCOUNT_NEWS',true);
require __DIR__.'/newsroom-account-import.php';
