"""Safely deploy NOA player entrypoint; never overwrite unknown production changes."""
import base64,hashlib,os,stat,subprocess,urllib.request
from pathlib import Path
import paramiko
ROOT='/hosting/noastudio/html'
REMOTE=ROOT+'/noa-youtube.php'
SOURCE=Path('deploy/noa-youtube.php')
def sha(b):return hashlib.sha256(b).hexdigest()
def main():
    required=('NOA_SSH_HOST','NOA_SSH_USER','NOA_SSH_PASSWORD','NOA_SSH_HOST_FINGERPRINT')
    if any(not os.getenv(k) for k in required):raise RuntimeError('missing_noa_ssh_secret')
    data=SOURCE.read_bytes();new=sha(data)
    commits=subprocess.check_output(['git','log','--format=%H','--','deploy/noa-youtube.php'],text=True).splitlines()
    known=set()
    for commit in commits:
        historical=subprocess.check_output(['git','show',commit+':deploy/noa-youtube.php'])
        known.add(sha(historical))
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
            if sftp.normalize(ROOT)!=ROOT:raise RuntimeError('unexpected_root')
            if not stat.S_ISREG(sftp.lstat(REMOTE).st_mode):raise RuntimeError('nonregular_target')
            with sftp.open(REMOTE,'rb') as stream:old=sha(stream.read())
            print('REMOTE_SHA256',old,'CANDIDATE_SHA256',new)
            if old not in known:raise RuntimeError('unknown_remote_version_refuse_overwrite')
            if old!=new:
                temp=ROOT+'/.noa-youtube.php.'+os.environ['GITHUB_SHA'][:12]+'.tmp'
                try:sftp.lstat(temp)
                except FileNotFoundError:pass
                else:raise RuntimeError('temporary_file_exists')
                with sftp.open(temp,'wb') as stream:stream.write(data)
                with sftp.open(temp,'rb') as stream:
                    if sha(stream.read())!=new:raise RuntimeError('upload_hash_mismatch')
                with sftp.open(REMOTE,'rb') as stream:
                    if sha(stream.read())!=old:raise RuntimeError('concurrent_remote_change')
                sftp.posix_rename(temp,REMOTE)
            with sftp.open(REMOTE,'rb') as stream:
                if sha(stream.read())!=new:raise RuntimeError('activation_hash_mismatch')
            print('PHP_REMOTE_VERIFIED',new)
        finally:sftp.close()
    finally:transport.close()
    request=urllib.request.Request('https://noastudio.ai.kr/noa-youtube.php?audit='+os.environ['GITHUB_SHA'][:12],headers={'Cache-Control':'no-cache'})
    with urllib.request.urlopen(request,timeout=30) as response:
        html=response.read().decode('utf-8','replace')
        if 'noa-browse.js?v=20261024-approved-three-tier-polish' not in html:
            raise RuntimeError('public_player_asset_version_mismatch')
    print('PHP_PUBLIC_VERIFIED',new)
if __name__=='__main__':main()
