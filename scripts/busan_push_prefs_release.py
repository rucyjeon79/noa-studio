"""Safely install durable Busan notification preferences from verified live files.

No member rows are changed; creates one additive table after an authenticated
one-time migration. Requires pinned SFTP host, exact preimage SHA and preflight.
Never prints credentials or private subscriber payloads.
"""
import hashlib,hmac,json,os,re,secrets,socket,stat,subprocess,tempfile,urllib.request
from pathlib import Path
import paramiko
from busan_readonly_check import ROOT,PORT,configuration,fingerprint

PRIVATE='/hosting/rucyjeon79/busan-assistant-private'
BASE=ROOT+'/busan-assistant'
API=BASE+'/notification-api.php'
CLIENT=BASE+'/notification-client.js'
EXTEND=ROOT+'/extend/busan-on.extend.php'
HELPER=BASE+'/notification-member-preferences.php'
EXPECTED={
    API:'74745e86d85b4161f7de49bb1c17f8bde8d408185ed986db760904605a541e89',
    CLIENT:'909bbf2ccf77e62118ff8a9cde7f2e8098fc120ad25c3b0291090e4834468cf4',
    EXTEND:'362807a53e039820ec64c9c6aedf5b7603439b180cd49efd31579eccefac145b'
}

def sha(value):return hashlib.sha256(value).hexdigest()
def replacement(value,old,new,description):
    if value.count(old)!=1:
        raise RuntimeError('source_changed_'+description)
    return value.replace(old,new,1)
def patch_api(text):
    text=replacement(text,
        "require_once dirname(__DIR__).'/common.php';require_once __DIR__.'/notification-lib.php';",
        "require_once dirname(__DIR__).'/common.php';require_once __DIR__.'/notification-lib.php';require_once __DIR__.'/notification-member-preferences.php';",
        'api_include')
    text=replacement(text,
        "if(!$m||!busan_push_active($m))continue;",
        "if(!$m||!busan_push_active($m))continue;if(busan_push_pref_read((string)$m['mb_id'])===false)continue;",
        'worker_member_gate')
    text=replacement(text,
        "'can_subscribe'=>true,'login_required'=>false]);",
        "'can_subscribe'=>true,'login_required'=>false,'member_enabled'=>busan_push_pref_read((string)$member['mb_id'])]);",
        'client_get')
    text=replacement(text,
        "if($action==='status')push_reply(['enabled'=>$own]);",
        "if($action==='status'){$pref=busan_push_pref_read((string)$member['mb_id']);push_reply(['enabled'=>$own&&$pref!==false,'member_enabled'=>$pref===null?$own:$pref]);}",
        'member_status')
    text=replacement(text,
        "if($action==='unsubscribe'){if($own&&is_file($path))unlink($path);push_reply(['enabled'=>false]);}",
        "if($action==='unsubscribe'){busan_push_pref_write((string)$member['mb_id'],false);if($own&&is_file($path))unlink($path);push_reply(['enabled'=>false,'member_enabled'=>false]);}",
        'member_disable')
    text=replacement(text,
        "busan_push_write($path,$record);push_reply(['enabled'=>true]);",
        "busan_push_pref_write((string)$member['mb_id'],true);busan_push_write($path,$record);push_reply(['enabled'=>true,'member_enabled'=>true]);",
        'member_enable')
    return text

def patch_client(text):
    text=replacement(text,
        "subscription=null,enabled=false,busy=false",
        "subscription=null,enabled=false,memberEnabled=false,busy=false",
        'client_state')
    text=replacement(text,
        "ctx=await request();if(ctx.can_subscribe===false)",
        "ctx=await request();memberEnabled=ctx.member_enabled===true;if(ctx.can_subscribe===false)",
        'client_load')
    text=replacement(text,
        "enabled=v.enabled===true;renewRequired=!enabled;",
        "enabled=v.enabled===true;memberEnabled=v.member_enabled===true;renewRequired=!enabled;",
        'client_status')
    text=replacement(text,
        ":!ctx.ready?'알림 연결을 준비 중이에요. 잠시 후 다시 확인해 주세요.'",
        ":memberEnabled?'회원 알림 설정이 저장돼 있어요. 이 기기에서 알림을 연결하면 다시 받을 수 있어요.':!ctx.ready?'알림 연결을 준비 중이에요. 잠시 후 다시 확인해 주세요.'",
        'client_restore_message')
    text=replacement(text,
        "subscription=null;enabled=false;renewRequired=false;status.textContent='이 기기의 알림을 껐어요.';",
        "subscription=null;enabled=false;memberEnabled=false;renewRequired=false;status.textContent='회원 알림 설정을 껐어요. 다시 켜려면 이 기기에서 연결해 주세요.';",
        'client_disable')
    text=replacement(text,
        "await request('subscribe',subscription);enabled=true;renewRequired=false;",
        "await request('subscribe',subscription);enabled=true;memberEnabled=true;renewRequired=false;",
        'client_enable')
    text=replacement(text,
        "ctx=v;if(ctx.can_subscribe===false)",
        "ctx=v;memberEnabled=v.member_enabled===true;if(ctx.can_subscribe===false)",
        'client_init')
    text=replacement(text,
        "enabled=(await request('status',subscription)).enabled===true;renewRequired=!enabled;",
        "const saved=await request('status',subscription);enabled=saved.enabled===true;memberEnabled=saved.member_enabled===true;renewRequired=!enabled;",
        'client_init_status')
    return text

def patch_extend(text):
    return replacement(text,'notification-client.js?v=20261027-37',
                       'notification-client.js?v=20261120-prefs1','client_cache_bust')

def read(s,path,limit=350000):
    try: a=s.lstat(path)
    except FileNotFoundError:return None
    if not stat.S_ISREG(a.st_mode) or s.normalize(path)!=path or a.st_size>limit:
        raise RuntimeError('unexpected_live_file')
    with s.open(path,'rb') as f: raw=f.read(limit+1)
    if len(raw)>limit:raise RuntimeError('oversized_live_file')
    return raw

def atomic(s,path,raw,mode=0o644,create=False):
    if create and read(s,path) is not None:raise RuntimeError('preexisting_new_helper_conflict')
    temp=path+'.candidate-'+secrets.token_hex(8)
    try:
        with s.open(temp,'wx') as f:f.write(raw)
        s.chmod(temp,mode)
        if sha(read(s,temp))!=sha(raw):raise RuntimeError('write_verify_failed')
        s.posix_rename(temp,path)
        if sha(read(s,path))!=sha(raw):raise RuntimeError('rename_verify_failed')
    finally:
        try:s.remove(temp)
        except FileNotFoundError:pass

def migrate(s):
    token=secrets.token_hex(32)
    template=Path('scripts/busan_notification_schema.php').read_text()
    php=template.replace('__TOKEN_HASH__',sha(token.encode())).encode()
    target=BASE+'/pref-schema-'+secrets.token_hex(16)+'.php'
    if read(s,target) is not None:raise RuntimeError('migration_probe_conflict')
    try:
        with s.open(target,'wx') as f:f.write(php)
        s.chmod(target,0o644)
        req=urllib.request.Request('https://skhnslu-busan.com/busan-assistant/'+target.rsplit('/',1)[1],
             data=b'{}',headers={'X-Busan-Migrate':token,'Content-Type':'application/json'})
        with urllib.request.urlopen(req,timeout=25) as response:
            result=json.loads(response.read(5000))
        if result.get('ok') is not True or result.get('schema_verified') is not True:
            raise RuntimeError('schema_migration_not_verified')
    finally:
        s.remove(target)

def check_candidate(files):
    with tempfile.TemporaryDirectory() as tmp:
        for name,content in files.items():
            local=Path(tmp)/name
            local.write_bytes(content)
            cmd=['node','--check',str(local)] if name.endswith('.js') else ['php','-l',str(local)]
            proc=subprocess.run(cmd,text=True,capture_output=True,timeout=20)
            if proc.returncode:raise RuntimeError('syntax_check_failed_'+name)
    if b"busan_push_pref_read((string)$m['mb_id'])===false" not in files['notification-api.php']:
        raise RuntimeError('missing_worker_gate')
    if b"memberEnabled=v.member_enabled===true" not in files['notification-client.js']:
        raise RuntimeError('missing_browser_restore')
    return True

def main():
    host,user,password,pin=configuration(os.environ)
    helper=Path('deploy/busan/notifications/member-preferences.php').read_bytes()
    with socket.create_connection((host,PORT),timeout=15) as sock:
        with paramiko.Transport(sock) as tr:
            tr.get_security_options().key_types=('ssh-ed25519',)
            tr.start_client(timeout=20)
            if not hmac.compare_digest(fingerprint(tr.get_remote_server_key()),pin):raise RuntimeError('host_key_mismatch')
            tr.auth_password(user,password,fallback=False)
            with paramiko.SFTPClient.from_transport(tr) as s:
                s.get_channel().settimeout(35)
                if s.normalize(ROOT)!=ROOT or s.normalize(PRIVATE)!=PRIVATE:
                    raise RuntimeError('unexpected_host_path')
                live={}
                for path,expected in EXPECTED.items():
                    body=read(s,path)
                    if body is None or sha(body)!=expected:raise RuntimeError('remote_preimage_mismatch_'+path.rsplit('/',1)[-1])
                    live[path]=body
                if read(s,HELPER) is not None:raise RuntimeError('helper_already_exists_review_required')
                candidate={
                    'notification-api.php':patch_api(live[API].decode()).encode(),
                    'notification-client.js':patch_client(live[CLIENT].decode()).encode(),
                    'busan-on.extend.php':patch_extend(live[EXTEND].decode()).encode(),
                    'notification-member-preferences.php':helper}
                check_candidate(candidate)
                if os.environ.get('BUSAN_PREFS_MODE')=='preflight':
                    print(json.dumps({'status':'candidate_verified','syntax_checked':True,
                                      'source_sha_verified':True,'site_files_changed':0,
                                      'db_changes':0,'member_rows_read':0}))
                    return

                # Back up source under a private path; each backup is individually SHA verified.
                backup=PRIVATE+'/backup-member-notification-pref-20261120'
                try:s.mkdir(backup,0o700)
                except OSError:
                    if s.normalize(backup)!=backup or not stat.S_ISDIR(s.lstat(backup).st_mode):
                        raise RuntimeError('backup_path_conflict')
                for path,raw in live.items():
                    name=path.rsplit('/',1)[-1]
                    dst=backup+'/'+name
                    prior=read(s,dst)
                    if prior is not None:
                        if sha(prior)!=sha(raw):raise RuntimeError('preexisting_backup_conflict')
                    else:
                        with s.open(dst,'wx') as f:f.write(raw)
                        s.chmod(dst,0o600)
                    if sha(read(s,dst))!=sha(raw):raise RuntimeError('backup_verify_failed')
                migrate(s)

                applied=[]
                try:
                    atomic(s,HELPER,helper,0o644,True);applied.append((HELPER,None))
                    for path,name in ((API,'notification-api.php'),
                                      (CLIENT,'notification-client.js'),
                                      (EXTEND,'busan-on.extend.php')):
                        atomic(s,path,candidate[name]);applied.append((path,live[path]))
                except Exception:
                    # Compensating restoration of files; additive schema stays intact.
                    for path,original in reversed(applied):
                        try:
                            if original is None:s.remove(path)
                            else:atomic(s,path,original)
                        except Exception:pass
                    raise
                print(json.dumps({'status':'verified_release','schema':'additive_member_preferences',
                     'replaced_files':3,'new_helper':1,'backups_verified':3,
                     'existing_member_rows_updated':0,'existing_subscriptions_deleted':0,
                     'php_js_syntax_checked':True,'endpoint_auth_unchanged':True}))
if __name__=='__main__':main()
