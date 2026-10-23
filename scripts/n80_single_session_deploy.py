"""N80 additive deployment: one verified SFTP session, no destructive overwrites.
Only missing files are installed. Existing files must match source exactly.
"""
import os, stat, base64, hashlib, subprocess
from pathlib import Path
import paramiko

ROOT='/hosting/noastudio/html'
MODULES=(
'n80.php','bridge.php','policy.php','guardian.php','lease-state.php',
'music-adapter.php','authenticated-probe.php','readonly-pipeline.php'
)
def sha(data): return hashlib.sha256(data).hexdigest()
def main():
    required=('NOA_SSH_HOST','NOA_SSH_USER','NOA_SSH_PASSWORD','NOA_SSH_HOST_FINGERPRINT','GITHUB_SHA')
    if any(not os.getenv(x) for x in required): raise RuntimeError('missing_deploy_config')
    # A changed deployed file may be replaced only if it exactly matches the
    # previous Git revision. Never overwrite unknown remote changes.
    previous={}
    for name in MODULES:
        rel='deploy/noa-app/engine/'+name
        try:
            history=subprocess.check_output(['git','log','--format=%H','--',rel],text=True).splitlines()
            if len(history)<2:raise subprocess.CalledProcessError(1,'git log')
            previous[name]=subprocess.check_output(['git','show',history[1]+':'+rel],stderr=subprocess.DEVNULL)
        except subprocess.CalledProcessError:
            previous[name]=None
    transport=paramiko.Transport((os.environ['NOA_SSH_HOST'],2022))
    try:
        transport.get_security_options().key_types=('ssh-ed25519',)
        transport.start_client(timeout=20)
        fingerprint='SHA256:'+base64.b64encode(hashlib.sha256(transport.get_remote_server_key().asbytes()).digest()).decode().rstrip('=')
        if fingerprint!=os.environ['NOA_SSH_HOST_FINGERPRINT']:raise RuntimeError('host_key_mismatch')
        transport.auth_password(os.environ['NOA_SSH_USER'],os.environ['NOA_SSH_PASSWORD'])
        if not transport.is_authenticated():raise RuntimeError('authentication_failed')
        sftp=paramiko.SFTPClient.from_transport(transport)
        try:
            if sftp.normalize(ROOT)!=ROOT:raise RuntimeError('root_mismatch')
            directory=ROOT+'/noa-app/engine'
            if not stat.S_ISDIR(sftp.lstat(directory).st_mode):raise RuntimeError('invalid_engine_directory')
            for name in MODULES:
                rel='noa-app/engine/'+name
                source=Path('deploy')/rel
                data=source.read_bytes();expected=sha(data);target=ROOT+'/'+rel
                try:
                    st=sftp.lstat(target)
                    if not stat.S_ISREG(st.st_mode):raise RuntimeError('nonregular_target:'+name)
                    with sftp.open(target,'rb') as handle: current=sha(handle.read())
                    if current==expected:
                        print('N80_UNCHANGED_VERIFIED',name,expected)
                        continue
                    baseline=previous[name]
                    if baseline is None or sha(baseline)!=current:
                        raise RuntimeError('remote_version_conflict:'+name)
                    temp=target+'.'+os.environ['GITHUB_SHA'][:12]+'.tmp'
                    try:sftp.lstat(temp)
                    except FileNotFoundError:pass
                    else:raise RuntimeError('staging_exists:'+name)
                    with sftp.open(temp,'wx') as handle:handle.write(data)
                    with sftp.open(temp,'rb') as handle:
                        if sha(handle.read())!=expected:raise RuntimeError('staging_hash_mismatch:'+name)
                    with sftp.open(target,'rb') as handle:
                        if sha(handle.read())!=current:raise RuntimeError('concurrent_remote_change:'+name)
                    sftp.posix_rename(temp,target)
                    with sftp.open(target,'rb') as handle:
                        if sha(handle.read())!=expected:raise RuntimeError('remote_hash_mismatch:'+name)
                    print('N80_UPGRADED_VERIFIED',name,expected)
                    continue
                except FileNotFoundError:pass
                temp=target+'.'+os.environ['GITHUB_SHA'][:12]+'.tmp'
                try:sftp.lstat(temp)
                except FileNotFoundError:pass
                else:raise RuntimeError('staging_exists:'+name)
                with sftp.open(temp,'wx') as handle:handle.write(data)
                with sftp.open(temp,'rb') as handle:
                    if sha(handle.read())!=expected:raise RuntimeError('staging_hash_mismatch:'+name)
                try:sftp.lstat(target)
                except FileNotFoundError:pass
                else:raise RuntimeError('concurrent_target_creation:'+name)
                sftp.rename(temp,target)
                with sftp.open(target,'rb') as handle:
                    if sha(handle.read())!=expected:raise RuntimeError('remote_hash_mismatch:'+name)
                print('N80_INSTALLED_VERIFIED',name,expected)
        finally:sftp.close()
    finally:transport.close()
    print('N80_SINGLE_SESSION_DEPLOY_OK')
if __name__=='__main__':main()
