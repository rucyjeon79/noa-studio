<?php
declare(strict_types=1);
/* 부산지부 ON GitHub OIDC 전용 읽기 전용 포인트 설정 조회. 배포 위치: /busan-assistant/points-inventory.php */
ini_set('display_errors','0');error_reporting(0);
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: private, no-store');header('X-Content-Type-Options: nosniff');
function bp_reply(int $status,array $v): never {http_response_code($status);echo json_encode($v,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_INVALID_UTF8_SUBSTITUTE);exit;}
function bp_b64(string $v): string {
    if($v===''||strlen($v)>12000||!preg_match('/^[A-Za-z0-9_-]+$/D',$v))throw new RuntimeException('bad_b64');
    $x=base64_decode(strtr($v,'-_','+/'),true);if(!is_string($x))throw new RuntimeException('bad_b64');return $x;
}
function bp_der(int $tag,string $bytes): string {$n=strlen($bytes);$long=ltrim(pack('N',$n),"\0");return chr($tag).($n<128?chr($n):chr(128+strlen($long)).$long).$bytes;}
function bp_pubkey(array $k): string {
    $integer=static function(string $v): string {$v=ltrim(bp_b64($v),"\0");if($v==='')throw new RuntimeException('empty_key');return bp_der(2,ord($v[0])>=128?"\0".$v:$v);};
    $rsa=bp_der(48,$integer((string)$k['n']).$integer((string)$k['e']));
    $der=bp_der(48,hex2bin('300d06092a864886f70d0101010500').bp_der(3,"\0".$rsa));
    return "-----BEGIN PUBLIC KEY-----\n".chunk_split(base64_encode($der),64,"\n")."-----END PUBLIC KEY-----\n";
}
function bp_identity(string $token,string $body): bool {
    if(strlen($token)>16000||substr_count($token,'.')!==2)return false;
    [$a,$b,$c]=explode('.',$token);
    $header=json_decode(bp_b64($a),true,8,JSON_THROW_ON_ERROR);
    $claims=json_decode(bp_b64($b),true,12,JSON_THROW_ON_ERROR);
    if(!is_array($header)||!is_array($claims))return false;
    $repo='rucyjeon79/noa-private-worker';$issuer='https://token.actions.githubusercontent.com';$now=time();
    if(($header['alg']??'')!=='RS256'||!is_string($header['kid']??null)||strlen($header['kid'])>256||
       ($claims['iss']??'')!==$issuer||
       ($claims['aud']??'')!=='https://skhnslu-busan.com/point-inventory/'.hash('sha256',$body)||
       ($claims['repository_id']??'')!=='1442403680'||($claims['repository']??'')!==$repo||
       ($claims['ref']??'')!=='refs/heads/main'||
       ($claims['workflow_ref']??'')!==$repo.'/.github/workflows/busan-points-bridge.yml@refs/heads/main'||
       !in_array($claims['event_name']??'',['workflow_dispatch','push'],true)||
       ($claims['iat']??0)<$now-600||($claims['iat']??PHP_INT_MAX)>$now+30||
       ($claims['nbf']??PHP_INT_MAX)>$now+30||($claims['exp']??0)<=$now)return false;
    if(!function_exists('curl_init')||!function_exists('openssl_verify'))return false;
    $ch=curl_init($issuer.'/.well-known/jwks');
    curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>8,CURLOPT_CONNECTTIMEOUT=>5,
        CURLOPT_FOLLOWLOCATION=>false,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS]);
    $data=curl_exec($ch);$status=curl_getinfo($ch,CURLINFO_RESPONSE_CODE);curl_close($ch);
    if($status!==200||!is_string($data)||strlen($data)>100000)throw new UnexpectedValueException('provider');
    $keys=json_decode($data,true,8,JSON_THROW_ON_ERROR)['keys']??[];
    if(!is_array($keys))return false;
    foreach($keys as $k){
        if(!is_array($k)||($k['kid']??'')!==$header['kid']||($k['kty']??'')!=='RSA')continue;
        if(empty($k['n'])||empty($k['e']))return false;
        return openssl_verify($a.'.'.$b,bp_b64($c),bp_pubkey($k),OPENSSL_ALGO_SHA256)===1;
    }
    return false;
}
if(($_SERVER['REQUEST_METHOD']??'')!=='POST')bp_reply(405,['status'=>'method_not_allowed']);
if(strtolower(trim(explode(';',$_SERVER['CONTENT_TYPE']??'')[0]))!=='application/json')bp_reply(415,['status'=>'media_type']);
$body=file_get_contents('php://input',false,null,0,4097);
if(!is_string($body)||strlen($body)<3||strlen($body)>4096)bp_reply(400,['status'=>'invalid_request']);
try{
    $request=json_decode($body,true,8,JSON_THROW_ON_ERROR);
    if(!is_array($request)||array_keys($request)!==['operation','request_id']||
       $request['operation']!=='points.inventory.v1'||!is_string($request['request_id'])||
       !preg_match('/^[a-f0-9]{32}$/D',$request['request_id']))bp_reply(400,['status'=>'invalid_request']);
    if(!bp_identity($_SERVER['HTTP_X_BUSAN_POINTS_OIDC']??'',$body))bp_reply(403,['status'=>'identity_denied']);
}catch(UnexpectedValueException $e){bp_reply(503,['status'=>'provider_unavailable']);}
catch(Throwable $e){bp_reply(403,['status'=>'identity_denied']);}
try{
    require_once dirname(__DIR__).'/common.php';
    if(empty($g5['board_table'])||!isset($config)||!is_array($config))throw new RuntimeException('native_config');
    $keys=['cf_use_point','cf_register_point','cf_login_point','cf_point_term','cf_read_point',
        'cf_write_point','cf_comment_point','cf_download_point'];
    $settings=[];
    foreach($keys as $key){if(!array_key_exists($key,$config))throw new RuntimeException('missing_key');$settings[$key]=(int)$config[$key];}
    $table=$g5['board_table'];
    if(!preg_match('/^[A-Za-z0-9_]{1,80}$/D',$table))throw new RuntimeException('table_name');
    $result=sql_query('SELECT bo_table,bo_subject,bo_write_point,bo_comment_point,bo_read_point,bo_download_point FROM '.$table.' ORDER BY bo_table',false);
    if(!$result)throw new RuntimeException('query_unavailable');
    $boards=[];
    while($row=sql_fetch_array($result)){
        if(count($boards)>=160)throw new RuntimeException('board_limit');
        $name=(string)$row['bo_table'];
        if(!preg_match('/^[A-Za-z0-9_]{1,80}$/D',$name))throw new RuntimeException('bad_board_name');
        $boards[]=['bo_table'=>$name,'bo_subject'=>mb_substr(strip_tags((string)$row['bo_subject']),0,100),
          'bo_write_point'=>(int)$row['bo_write_point'],'bo_comment_point'=>(int)$row['bo_comment_point'],
          'bo_read_point'=>(int)$row['bo_read_point'],'bo_download_point'=>(int)$row['bo_download_point']];
    }
    bp_reply(200,['status'=>'verified','source'=>'busan_gnuboard_live_readonly',
      'request_id'=>$request['request_id'],'config'=>$settings,'boards'=>$boards,
      'board_count'=>count($boards),'custom_rules'=>'not_scanned','mutations'=>0]);
}catch(Throwable $e){bp_reply(503,['status'=>'live_settings_unavailable','mutations'=>0]);}
