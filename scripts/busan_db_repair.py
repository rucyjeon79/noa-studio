"""Prepared only. Requires explicit approval and BUSAN_DB_PASSWORD; no workflow calls this yet."""
import hashlib,hmac,json,os,re,secrets,socket,stat,urllib.request
import paramiko
from busan_readonly_check import configuration,fingerprint,HOST,USER,PORT,ROOT
EXPECTED='b1e89be49871953db16f85f85148316a408c633c25ec715ea58ed445d4ced6cb'
PRIVATE='/hosting/rucyjeon79/busan-assistant-private'
CONFIG=ROOT+'/data/dbconfig.php'
PHP='''<?php
ini_set('display_errors','0');error_reporting(0);
if(!hash_equals('__HASH__',hash('sha256',$_SERVER['HTTP_X_BUSAN_DIAG']??''))){http_response_code(404);exit;}
header('Content-Type: application/json');header('Cache-Control: no-store');
define('_GNUBOARD_',true);include '/hosting/rucyjeon79/html/data/dbconfig.php';
if(G5_MYSQL_HOST!=='localhost'||G5_MYSQL_USER!=='rucyjeon79'||G5_MYSQL_DB!=='rucyjeon79'){echo json_encode(['ok'=>false,'target_mismatch'=>true]);exit;}
$in=json_decode(file_get_contents('php://input',false,null,0,4096),true);
if(!is_array($in)||!is_string($in['password']??null)){http_response_code(400);exit;}
mysqli_report(MYSQLI_REPORT_OFF);$c=mysqli_init();mysqli_options($c,MYSQLI_OPT_CONNECT_TIMEOUT,5);
$ok=@mysqli_real_connect($c,'localhost','rucyjeon79',$in['password'],'rucyjeon79');
echo json_encode(['ok'=>$ok,'errno'=>$ok?0:mysqli_connect_errno()]);if($ok)mysqli_close($c);
'''
def sha(b):return hashlib.sha256(b).hexdigest()
def read_regular(s,p):
    a=s.lstat(p)
    if not stat.S_ISREG(a.st_mode) or s.normalize(p)!=p or a.st_size>131072:raise RuntimeError('unexpected_file')
    with s.open(p,'rb') as f:b=f.read(131073)
    if len(b)>131072:raise RuntimeError('size_limit')
    return b,a

def create(s,p,b,mode):
    with s.open(p,'wx') as f:f.write(b)
    s.chmod(p,mode)
    if sha(read_regular(s,p)[0])!=sha(b):raise RuntimeError('upload_hash_mismatch')

def main():
    if os.environ.get('BUSAN_APPROVE_DB_REPAIR')!='repair-only-existing-busan-db-password':raise RuntimeError('approval_missing')
    host,user,password,pin=configuration(os.environ)
    new=os.environ.get('BUSAN_DB_PASSWORD','')
    if not new or len(new)>512 or '\x00' in new or '\n' in new or '\r' in new:raise RuntimeError('db_secret_missing_or_invalid')
    with socket.create_connection((host,PORT),timeout=15) as sock:
        with paramiko.Transport(sock) as t:
            t.banner_timeout=15;t.auth_timeout=15;t.get_security_options().key_types=('ssh-ed25519',)
            t.start_client(timeout=20)
            if not hmac.compare_digest(fingerprint(t.get_remote_server_key()),pin):raise RuntimeError('host_key_mismatch')
            t.auth_password(user,password,fallback=False)
            with paramiko.SFTPClient.from_transport(t) as s:
                s.get_channel().settimeout(25)
                for p in (ROOT,ROOT+'/busan-assistant',PRIVATE,ROOT+'/data'):
                    if s.normalize(p)!=p or not stat.S_ISDIR(s.lstat(p).st_mode):raise RuntimeError('unexpected_directory')
                old,attrs=read_regular(s,CONFIG)
                if sha(old)!=EXPECTED:raise RuntimeError('existing_config_changed_abort')
                pattern=rb"define\s*\(\s*(['\"])G5_MYSQL_PASSWORD\1\s*,\s*(['\"])(?:\\.|(?!\2).)*?\2\s*\)"
                matches=list(re.finditer(pattern,old,re.S))
                if len(matches)!=1:raise RuntimeError('password_definition_not_unambiguous')
                token=secrets.token_hex(32);probe=ROOT+'/busan-assistant/diag-'+secrets.token_hex(16)+'.php'
                try:
                    create(s,probe,PHP.replace('__HASH__',sha(token.encode())).encode(),0o644)
                    req=urllib.request.Request('https://skhnslu-busan.com/busan-assistant/'+probe.rsplit('/',1)[1],data=json.dumps({'password':new}).encode(),headers={'X-Busan-Diag':token,'Content-Type':'application/json'})
                    with urllib.request.urlopen(req,timeout=20) as r:result=json.loads(r.read(4096))
                    if result.get('ok') is not True:raise RuntimeError('provided_db_password_not_valid')
                finally:s.remove(probe)
                value=new.replace('\\','\\\\').replace("'","\\'").encode()
                m=matches[0];candidate=old[:m.start()]+b"define('G5_MYSQL_PASSWORD', '"+value+b"')"+old[m.end():]
                backup=PRIVATE+'/dbconfig-before-'+EXPECTED+'.php'
                try:
                    s.lstat(backup)
                    if sha(read_regular(s,backup)[0])!=EXPECTED:raise RuntimeError('backup_conflict')
                except FileNotFoundError:create(s,backup,old,0o600)
                temp=PRIVATE+'/dbconfig-new-'+secrets.token_hex(16)+'.php'
                create(s,temp,candidate,stat.S_IMODE(attrs.st_mode))
                if sha(read_regular(s,CONFIG)[0])!=EXPECTED:raise RuntimeError('concurrent_config_change_abort')
                s.posix_rename(temp,CONFIG)
                if sha(read_regular(s,CONFIG)[0])!=sha(candidate):raise RuntimeError('final_config_hash_mismatch')
                print(json.dumps({'status':'database_connection_setting_repaired','changed_definition':'G5_MYSQL_PASSWORD','backup_verified':True,'sql_data_changed':False}))

if __name__=='__main__':
    try:main()
    except Exception as exc:
        # Never print transport, SQL, response body, source, or secret values.
        print(json.dumps({'status':'blocked','error':str(exc) if type(exc) is RuntimeError else type(exc).__name__}))
        raise SystemExit(1)
