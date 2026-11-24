<?php
declare(strict_types=1);
/*
 * 부산지부 호스트 관리 브리지 v1
 * 부트스트랩 설치 경로: <webroot>/busan-assistant/host-bridge.php
 * GitHub OIDC 인증 + 요청 본문 해시 고정 + 경로 허용목록 + 변경 전 백업.
 * 쉘, 임의 SQL, 회원정보 조회, 파일 삭제 API 없음.
 */
ini_set('display_errors','0');
error_reporting(0);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, private');
header('X-Content-Type-Options: nosniff');

function bh_out(int $code,array $body): void {
    http_response_code($code);
    echo json_encode($body,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}
function bh_b64url(string $s): string {
    if($s===''||strlen($s)>12000||!preg_match('/^[a-zA-Z0-9_-]+$/D',$s))throw new RuntimeException('encoding');
    $v=base64_decode(strtr($s,'-_','+/'),true);
    if(!is_string($v))throw new RuntimeException('encoding');
    return $v;
}
function bh_der(int $tag,string $body): string {
    $size=strlen($body);$wide=ltrim(pack('N',$size),"\0");
    return chr($tag).($size<128?chr($size):chr(128+strlen($wide)).$wide).$body;
}
function bh_rsa(array $key): string {
    $enc=static function(string $s): string {
        $v=ltrim(bh_b64url($s),"\0");
        if($v==='')throw new RuntimeException('key');
        return bh_der(2,ord($v[0])>=128?"\0".$v:$v);
    };
    $bytes=bh_der(48,$enc($key['n']).$enc($key['e']));
    $asn=bh_der(48,hex2bin('300d06092a864886f70d0101010500').bh_der(3,"\0".$bytes));
    return "-----BEGIN PUBLIC KEY-----\n".chunk_split(base64_encode($asn),64,"\n")."-----END PUBLIC KEY-----\n";
}
function bh_verified_claims(string $jwt,string $body): ?array {
    if(strlen($jwt)>16000||substr_count($jwt,'.')!==2)return null;
    [$h,$p,$s]=explode('.',$jwt);
    $header=json_decode(bh_b64url($h),true,8,JSON_THROW_ON_ERROR);
    $claims=json_decode(bh_b64url($p),true,12,JSON_THROW_ON_ERROR);
    if(!is_array($header)||!is_array($claims))return null;
    $repo='rucyjeon79/noa-private-worker';$issuer='https://token.actions.githubusercontent.com';$now=time();
    if(($header['alg']??'')!=='RS256'||
       !is_string($header['kid']??null)||strlen($header['kid'])>256||
       ($claims['iss']??'')!==$issuer||
       ($claims['aud']??'')!=='https://skhnslu-busan.com/host-bridge/'.hash('sha256',$body)||
       ($claims['repository_id']??'')!=='1442403680'||
       ($claims['repository']??'')!==$repo||
       ($claims['ref']??'')!=='refs/heads/main'||
       ($claims['workflow_ref']??'')!==$repo.'/.github/workflows/busan-host-bridge.yml@refs/heads/main'||
       !in_array($claims['event_name']??'',['push','workflow_dispatch'],true)||
       ($claims['iat']??0)<$now-600||($claims['iat']??PHP_INT_MAX)>$now+30||
       ($claims['nbf']??PHP_INT_MAX)>$now+30||($claims['exp']??0)<=$now||
       !preg_match('/^[a-f0-9]{40}$/D',(string)($claims['sha']??'')))return null;
    if(!function_exists('curl_init')||!function_exists('openssl_verify'))return null;
    $ch=curl_init($issuer.'/.well-known/jwks');
    curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>8,
        CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS]);
    $response=curl_exec($ch);$http=curl_getinfo($ch,CURLINFO_RESPONSE_CODE);curl_close($ch);
    if($http!==200||!is_string($response)||strlen($response)>100000)
        throw new UnexpectedValueException('oidc_provider');
    $jwks=json_decode($response,true,10,JSON_THROW_ON_ERROR);
    foreach(($jwks['keys']??[]) as $key){
        if(!is_array($key)||($key['kid']??'')!==$header['kid']||($key['kty']??'')!=='RSA')continue;
        if(!is_string($key['n']??null)||!is_string($key['e']??null))return null;
        if(openssl_verify($h.'.'.$p,bh_b64url($s),bh_rsa($key),OPENSSL_ALGO_SHA256)===1)
            return $claims;
        return null;
    }
    return null;
}
function bh_path(string $path): bool {
    if(strlen($path)>220||str_contains($path,'\\')||str_contains($path,'//')||str_starts_with($path,'/'))return false;
    $parts=explode('/',$path);
    foreach($parts as $part){
        if($part===''||$part==='.'||$part==='..'||!preg_match('/^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/D',$part))return false;
    }
    $ext=strtolower(pathinfo($path,PATHINFO_EXTENSION));
    if(!in_array($ext,['css','js','html','txt','json','svg','php'],true))return false;
    $prefixes=['theme/','css/','js/','busan-assistant/managed/'];
    $permitted=false;
    foreach($prefixes as $prefix)if(str_starts_with($path,$prefix))$permitted=true;
    if(preg_match('#^extend/busan-[A-Za-z0-9_.-]+\.php$#D',$path))$permitted=true;
    if(!$permitted)return false;
    // Non-code root config, member data, newsroom publishing, and this bridge are out of scope.
    if(preg_match('#(^|/)(?:config|dbconfig|common|admin|newsroom-account|host-bridge|points-inventory)(?:\.|/|$)#i',$path))return false;
    if($ext==='php' && !(str_starts_with($path,'theme/')||
        str_starts_with($path,'busan-assistant/managed/')||
        preg_match('#^extend/busan-[A-Za-z0-9_.-]+\.php$#D',$path)))return false;
    return true;
}
function bh_target(string $root,string $path): string {
    $target=$root.'/'.$path;$dir=realpath(dirname($target));
    if(!is_string($dir)||!str_starts_with($dir,$root.'/'))throw new RuntimeException('target_directory_missing');
    if(is_link($target)||is_dir($target))throw new RuntimeException('target_not_regular');
    if(file_exists($target)&&!is_file($target))throw new RuntimeException('target_not_regular');
    return $target;
}
function bh_private(string $root): string {
    $base=realpath(dirname($root).'/busan-assistant-private');
    if(!is_string($base)||is_link($base)||!is_dir($base)||
       !str_starts_with($base,dirname($root).'/'))throw new RuntimeException('private_storage_unavailable');
    $dir=$base.'/host-bridge';
    if(!is_dir($dir)&&!mkdir($dir,0700))throw new RuntimeException('backup_unavailable');
    if(is_link($dir)||!is_dir($dir)||!is_writable($dir))throw new RuntimeException('backup_unavailable');
    @chmod($dir,0700);
    return $dir;
}

if(($_SERVER['REQUEST_METHOD']??'')!=='POST')bh_out(405,['status'=>'method_not_allowed']);
if(strtolower(trim(explode(';',$_SERVER['CONTENT_TYPE']??'')[0]))!=='application/json')
    bh_out(415,['status'=>'content_type_rejected']);
$raw=file_get_contents('php://input',false,null,0,262145);
if(!is_string($raw)||strlen($raw)>262144||strlen($raw)<10)bh_out(400,['status'=>'request_rejected']);
try{
    $req=json_decode($raw,true,10,JSON_THROW_ON_ERROR);
    if(!is_array($req))bh_out(400,['status'=>'request_rejected']);
    $op=$req['operation']??null;$id=$req['request_id']??null;$path=$req['path']??null;
    if(!in_array($op,['host.inspect.v1','host.apply.v1'],true)||
       !is_string($id)||!preg_match('/^[a-f0-9]{32}$/D',$id)||
       !is_string($path)||!bh_path($path)||
       !is_string($req['source_commit']??null)||!preg_match('/^[a-f0-9]{40}$/D',$req['source_commit']))
        bh_out(400,['status'=>'request_rejected']);
    $claims=bh_verified_claims((string)($_SERVER['HTTP_X_BUSAN_HOST_OIDC']??''),$raw);
    if($claims===null||$claims['sha']!==$req['source_commit'])bh_out(403,['status'=>'identity_denied']);
}catch(UnexpectedValueException $e){bh_out(503,['status'=>'identity_provider_unavailable']);}
catch(Throwable $e){bh_out(403,['status'=>'identity_denied']);}

$root=realpath(dirname(__DIR__));
if(!is_string($root)||!is_file($root.'/common.php')||!is_file($root.'/data/dbconfig.php'))
    bh_out(503,['status'=>'unexpected_site_root']);
try{
    $target=bh_target($root,$path);
    $exists=is_file($target);
    $oldhash=$exists?hash_file('sha256',$target):null;
    $oldsize=$exists?filesize($target):0;
    if($op==='host.inspect.v1'){
        if(array_keys($req)!==['operation','request_id','path','source_commit'])
            bh_out(400,['status'=>'request_rejected']);
        bh_out(200,['status'=>'verified','operation'=>$op,'request_id'=>$id,'path'=>$path,
            'exists'=>$exists,'sha256'=>$oldhash,'bytes'=>$oldsize,'mutations'=>0]);
    }
    if(array_keys($req)!==['operation','request_id','path','source_commit','expected_sha256',
        'content_sha256','content_b64','approval'])bh_out(400,['status'=>'request_rejected']);
    if(($req['approval']??null)!=='BUSAN_HOST_APPLY_EXPLICIT_OWNER_APPROVAL')
        bh_out(403,['status'=>'approval_required']);
    $expected=$req['expected_sha256']??null;
    if($expected!==null&&(!is_string($expected)||!preg_match('/^[a-f0-9]{64}$/D',$expected)))
        bh_out(400,['status'=>'request_rejected']);
    if($expected!==$oldhash)bh_out(409,['status'=>'base_version_mismatch','path'=>$path,
        'actual_sha256'=>$oldhash,'mutations'=>0]);
    $base64=$req['content_b64']??null;
    if(!is_string($base64)||strlen($base64)>240000||strlen($base64)<4||
       !preg_match('#^[A-Za-z0-9+/]+={0,2}$#D',$base64))
        bh_out(400,['status'=>'payload_rejected']);
    $content=base64_decode($base64,true);
    if(!is_string($content)||strlen($content)<1||strlen($content)>180000||
       hash('sha256',$content)!==($req['content_sha256']??null)||
       strpos($content,"\0")!==false)bh_out(400,['status'=>'payload_rejected']);
    if($oldhash===hash('sha256',$content))
        bh_out(200,['status'=>'already_current','path'=>$path,'sha256'=>$oldhash,'mutations'=>0]);
    $private=bh_private($root);
    $lock=fopen($private.'/host-bridge.lock','c+');
    if(!$lock||!flock($lock,LOCK_EX|LOCK_NB))bh_out(423,['status'=>'bridge_busy']);
    try{
        // Revalidate under lock: reject concurrent modifications.
        if((is_file($target)?hash_file('sha256',$target):null)!==$expected)
            bh_out(409,['status'=>'base_version_mismatch','mutations'=>0]);
        $receipt=$private.'/receipt-'.$id.'.json';
        if(file_exists($receipt))bh_out(409,['status'=>'replayed_request','mutations'=>0]);
        $backup=null;
        if($exists){
            $backup=$private.'/backup-'.$id.'.bak';
            $backupFile=fopen($backup,'x');
            if(!$backupFile)throw new RuntimeException('backup_unavailable');
            if(fwrite($backupFile,file_get_contents($target))!==$oldsize){
                fclose($backupFile);throw new RuntimeException('backup_unavailable');
            }
            fclose($backupFile);@chmod($backup,0600);
        }
        $temp=$target.'.tmp-'.$id;
        $file=fopen($temp,'x');if(!$file)throw new RuntimeException('staging_failed');
        try{
            if(fwrite($file,$content)!==strlen($content))throw new RuntimeException('staging_failed');
        }finally{fclose($file);}
        chmod($temp,$exists?(fileperms($target)&0777):0644);
        if(hash_file('sha256',$temp)!==$req['content_sha256'])throw new RuntimeException('staging_failed');
        if(!rename($temp,$target))throw new RuntimeException('atomic_replace_failed');
        $result=['status'=>'applied','path'=>$path,'old_sha256'=>$oldhash,
            'sha256'=>$req['content_sha256'],'request_id'=>$id,'mutations'=>1];
        $audit=['request_id'=>$id,'source_commit'=>$req['source_commit'],'operation'=>$op,
            'path'=>$path,'previous_hash'=>$oldhash,'new_hash'=>$req['content_sha256'],
            'backup_file'=>$backup!==null?basename($backup):null,'utc'=>gmdate('c')];
        if(file_put_contents($receipt,json_encode($audit,JSON_UNESCAPED_SLASHES),LOCK_EX)===false)
            throw new RuntimeException('receipt_write_failed');
        @chmod($receipt,0600);
        bh_out(200,$result);
    }finally{
        if(isset($temp)&&is_file($temp))@unlink($temp);
        flock($lock,LOCK_UN);fclose($lock);
    }
}catch(Throwable $e){
    // No remote filesystem paths, credentials or database details in HTTP response.
    bh_out(503,['status'=>'host_operation_unavailable','reason'=>($e instanceof RuntimeException?$e->getMessage():'internal_error')]);
}
