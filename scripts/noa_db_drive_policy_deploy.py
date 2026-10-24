"""Install only the offsite-only SQL backup guard with a verified Drive preimage."""
import base64
import hashlib
import json
import os
from pathlib import Path
import stat
import urllib.request
import paramiko

ROOT='/hosting/noastudio/html'
PATH=ROOT+'/noa-app/database/core.php'
EXPECTED='e214dd38ca9d97aa9405ce4d87f25ed846dab49f95dad3249e975d883c57beed'
DRIVE_PREIMAGE_ID='1N1a2ZoLmE4wJIWfZGmBemKGCwATlOXmO'


def main():
    new=Path('deploy/noa-app/database/core.php').read_bytes()
    newsha=hashlib.sha256(new).hexdigest()
    t=paramiko.Transport((os.environ['NOA_SSH_HOST'],2022))
    temp=PATH+'.drive-policy-'+os.environ['GITHUB_RUN_ID']+'.tmp'
    s=None
    try:
        t.get_security_options().key_types=('ssh-ed25519',)
        t.start_client(timeout=30)
        fp='SHA256:'+base64.b64encode(hashlib.sha256(t.get_remote_server_key().asbytes()).digest()).decode().rstrip('=')
        if fp!=os.environ['NOA_SSH_HOST_FINGERPRINT']:raise RuntimeError('host_key_mismatch')
        t.auth_password(os.environ['NOA_SSH_USER'],os.environ['NOA_SSH_PASSWORD'])
        s=paramiko.SFTPClient.from_transport(t)
        if s.normalize(ROOT)!=ROOT:raise RuntimeError('unexpected_root')
        def read(path):
            attr=s.lstat(path)
            if not stat.S_ISREG(attr.st_mode):raise RuntimeError('nonregular_file_preserved')
            with s.open(path,'rb') as f:return f.read()
        before=read(PATH)
        oldsha=hashlib.sha256(before).hexdigest()
        if oldsha==newsha:
            print('DRIVE_SQL_POLICY_ALREADY_INSTALLED');return
        if oldsha!=EXPECTED:raise RuntimeError('concurrent_database_core_preserved')
        guard={p:hashlib.sha256(read(ROOT+'/'+p)).hexdigest() for p in ['index.php','common.php','config.php','data/dbconfig.php','noa-app/jukebox/core.php','noa-app/jukebox/service.php']}
        with s.open(temp,'wx') as f:f.write(new)
        s.chmod(temp,stat.S_IMODE(s.lstat(PATH).st_mode))
        if hashlib.sha256(read(temp)).hexdigest()!=newsha or hashlib.sha256(read(PATH)).hexdigest()!=EXPECTED:raise RuntimeError('concurrent_change_preserved')
        s.posix_rename(temp,PATH)
        try:
            if hashlib.sha256(read(PATH)).hexdigest()!=newsha:raise RuntimeError('policy_install_checksum_mismatch')
            for p,h in guard.items():
                if hashlib.sha256(read(ROOT+'/'+p)).hexdigest()!=h:raise RuntimeError('protected_runtime_changed')
            for path in ['/','/bbs/login.php','/noa-music.php','/noa-app/database/index.php']:
                with urllib.request.urlopen('https://noastudio.ai.kr'+path,timeout=30) as response:
                    body=response.read()
                    if response.status!=200 or b'Fatal error:' in body:raise RuntimeError('policy_http_smoke_failed')
        except Exception:
            if hashlib.sha256(read(PATH)).hexdigest()!=newsha:raise RuntimeError('rollback_concurrent_change_preserved')
            with s.open(temp,'wx') as f:f.write(before)
            s.chmod(temp,stat.S_IMODE(s.lstat(PATH).st_mode));s.posix_rename(temp,PATH)
            raise
        print('NOA_DB_DRIVE_ONLY_POLICY_INSTALLED '+json.dumps({'before_sha256':EXPECTED,'after_sha256':newsha,'drive_preimage_id':DRIVE_PREIMAGE_ID,'local_backup_created':False,'sql_export_blocked_until_verified_drive_provider_available':True,'production_mysql_modified':False,'protected_runtime_unchanged':True}))
    finally:
        if s:
            try:
                if hashlib.sha256(read(temp)).hexdigest() in [newsha,EXPECTED]:s.remove(temp)
            except FileNotFoundError:pass
        t.close()


if __name__=='__main__':main()
