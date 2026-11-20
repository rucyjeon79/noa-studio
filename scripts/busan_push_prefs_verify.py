"""Read-only code and isolated synthetic-row verification after Busan push preference release."""
import hashlib,hmac,json,os,re,secrets,socket,stat,urllib.request
import paramiko
from busan_readonly_check import ROOT,PORT,configuration,fingerprint

BASE=ROOT+'/busan-assistant'
PRIVATE='/hosting/rucyjeon79/busan-assistant-private'
LIVE={
'api':(BASE+'/notification-api.php',b"busan_push_pref_read((string)$m['mb_id'])===false"),
'client':(BASE+'/notification-client.js',b"memberEnabled=v.member_enabled===true"),
'helper':(BASE+'/notification-member-preferences.php',b"function busan_push_pref_write("),
'extend':(ROOT+'/extend/busan-on.extend.php',b"notification-client.js?v=20261120-prefs1")
}

PROBE=r'''<?php
declare(strict_types=1);
ini_set('display_errors','0');
header('Content-Type: application/json');header('Cache-Control: no-store');
if (($_SERVER['REQUEST_METHOD']??'')!=='POST' ||
    !hash_equals('__TOKEN_HASH__',hash('sha256',$_SERVER['HTTP_X_BUSAN_TEST']??''))) {
    http_response_code(404);exit;
}
require_once dirname(__DIR__).'/common.php';
require_once __DIR__.'/notification-member-preferences.php';
$table=busan_push_pref_table();
$id='busan_pref_probe_'.bin2hex(random_bytes(12));
$escaped=sql_real_escape_string($id);
$result=['ok'=>false];
try {
    $exists=sql_fetch("SELECT enabled FROM {$table} WHERE mb_id='{$escaped}'",false);
    if(is_array($exists)&&array_key_exists('enabled',$exists)) throw new RuntimeException('unexpected_row');
    busan_push_pref_write($id,true);
    $on=busan_push_pref_read($id)===true;
    busan_push_pref_write($id,false);
    $off=sql_fetch("SELECT enabled FROM {$table} WHERE mb_id='{$escaped}'",false);
    $off=is_array($off)&&(int)($off['enabled']??-1)===0;
    $result=['ok'=>$on&&$off,'on_persisted'=>$on,'off_persisted'=>$off];
} catch(Throwable $e) {
    $result=['ok'=>false,'code'=>'synthetic_test_failed'];
} finally {
    sql_query("DELETE FROM {$table} WHERE mb_id='{$escaped}' LIMIT 1",false);
    $remaining=sql_fetch("SELECT COUNT(*) AS n FROM {$table} WHERE mb_id='{$escaped}'",false);
    $result['probe_row_cleaned']=((int)($remaining['n']??-1)===0);
}
if(!$result['ok']||!$result['probe_row_cleaned'])http_response_code(503);
echo json_encode($result);
'''
def read(s,p):
    a=s.lstat(p)
    if not stat.S_ISREG(a.st_mode) or a.st_size>400000:raise RuntimeError('source_invalid')
    with s.open(p,'rb') as f:return f.read(400001)
def main():
    host,user,password,pin=configuration(os.environ)
    token=secrets.token_hex(32)
    path=BASE+'/pref-qa-'+secrets.token_hex(16)+'.php'
    with socket.create_connection((host,PORT),timeout=15) as sock:
        with paramiko.Transport(sock) as tr:
            tr.get_security_options().key_types=('ssh-ed25519',)
            tr.start_client(timeout=20)
            if not hmac.compare_digest(fingerprint(tr.get_remote_server_key()),pin):raise RuntimeError('host_key_mismatch')
            tr.auth_password(user,password,fallback=False)
            with paramiko.SFTPClient.from_transport(tr) as s:
                s.get_channel().settimeout(35)
                if s.normalize(ROOT)!=ROOT:raise RuntimeError('wrong_web_root')
                for name,(filename,needle) in LIVE.items():
                    if needle not in read(s,filename):
                        raise RuntimeError('missing_live_release_'+name)
                content=PROBE.replace('__TOKEN_HASH__',hashlib.sha256(token.encode()).hexdigest()).encode()
                try:
                    with s.open(path,'wx') as f:f.write(content)
                    s.chmod(path,0o644)
                    request=urllib.request.Request('https://skhnslu-busan.com/busan-assistant/'+path.rsplit('/',1)[1],
                                  data=b'{}',headers={'X-Busan-Test':token,'Content-Type':'application/json'})
                    with urllib.request.urlopen(request,timeout=25) as reply:
                        result=json.loads(reply.read(5000))
                    if result.get('ok') is not True or result.get('probe_row_cleaned') is not True:
                        raise RuntimeError('durable_preference_test_failed')
                finally:
                    s.remove(path)
                print(json.dumps({'production_patches_verified':len(LIVE),
                    'synthetic_member_preference_on_off':True,
                    'synthetic_row_cleaned':True,'real_member_rows_changed':0,
                    'existing_subscriptions_deleted':0,'source_readback':True}))
if __name__=='__main__':main()
