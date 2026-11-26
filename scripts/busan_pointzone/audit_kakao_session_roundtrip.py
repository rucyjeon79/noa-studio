"""Test isolated anonymous session continuity, never log in as a member."""
import hmac,json,secrets,hashlib,http.cookiejar
from urllib.request import Request,build_opener,HTTPCookieProcessor
from urllib.parse import urlencode,urlsplit
import release_submenu_fix as remote
from audit_kakao_login import UA,ORIGIN
WORKER=r'''<?php
if(!hash_equals('__HASH__',hash('sha256',$_SERVER['HTTP_X_BUSAN_AUTH_PROBE']??''))){http_response_code(404);exit;}
require_once dirname(__DIR__).'/common.php';
header('Content-Type: application/json');header('Cache-Control: no-store');
if(!empty($is_member)||!empty($_SESSION['ss_mb_id'])){http_response_code(403);exit;}
$mode=$_GET['mode']??'';
$key='busan_auth_probe_'.substr('__HASH__',0,12);
$result=['cookie_received'=>isset($_COOKIE[session_name()]),'same_session'=>false];
if($mode==='start'&&$_SERVER['REQUEST_METHOD']==='GET'){
    $_SESSION[$key]='__MARKER__';
    $result['same_session']=true;
}elseif($mode==='post'&&$_SERVER['REQUEST_METHOD']==='POST'){
    $result['same_session']=hash_equals('__MARKER__',(string)($_SESSION[$key]??''));
    if($result['same_session']){
        session_regenerate_id(false);
        $_SESSION[$key]='__MARKER__';
    }
}elseif($mode==='finish'&&$_SERVER['REQUEST_METHOD']==='GET'){
    $result['same_session']=hash_equals('__MARKER__',(string)($_SESSION[$key]??''));
    unset($_SESSION[$key]);
}else{http_response_code(400);exit;}
echo json_encode($result);
'''
def audit(s):
    token=secrets.token_hex(32)
    code=WORKER.replace('__HASH__',hashlib.sha256(token.encode()).hexdigest()).replace('__MARKER__',secrets.token_hex(16)).encode()
    name='auth-cookie-probe-'+secrets.token_hex(16)+'.php';dest=remote.ROOT+'/busan-assistant/'+name
    try:
        with s.open(dest,'wx') as f:f.write(code)
        s.chmod(dest,0o644)
        for label,ua in UA.items():
            jar=http.cookiejar.CookieJar();opener=build_opener(HTTPCookieProcessor(jar))
            url=ORIGIN+'/busan-assistant/'+name
            results={}
            for mode in ('start','post','finish'):
                headers={'User-Agent':ua,'X-Busan-Auth-Probe':token,'Cache-Control':'no-cache','Referer':ORIGIN+'/bbs/login.php'}
                data=urlencode({'probe':'1'}).encode() if mode=='post' else None
                with opener.open(Request(url+'?mode='+mode,data=data,headers=headers),timeout=15) as r:
                    results[mode]=json.load(r)
            print('BUSAN_KAKAO_SESSION_ROUNDTRIP',label,json.dumps(results),flush=True)
    finally:
        s.remove(dest)
    print('BUSAN_KAKAO_SESSION_PROBE_END',{'member_logins':0,'authentication_changes':0,'actual_webview':'not_tested'},flush=True)
if __name__=='__main__':
    host,user,password,pin=remote.configuration(remote.os.environ)
    with remote.socket.create_connection((host,remote.PORT),timeout=15) as sock,remote.paramiko.Transport(sock) as t:
        t.get_security_options().key_types=('ssh-ed25519',);t.start_client(timeout=20)
        if not hmac.compare_digest(remote.fingerprint(t.get_remote_server_key()),pin):raise RuntimeError('host identity mismatch')
        t.auth_password(user,password,fallback=False)
        with remote.paramiko.SFTPClient.from_transport(t) as s:
            s.get_channel().settimeout(35);audit(s)
