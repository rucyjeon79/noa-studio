"""Deploy only the approved JUKEBOX upload stylesheet, refusing unknown remote versions."""
import base64, hashlib, os, stat, subprocess, urllib.request
from pathlib import Path
import paramiko

ROOT = '/hosting/noastudio/html'
REL = 'noa-app/jukebox/upload.css'
SOURCE = Path('deploy') / REL
def digest(data): return hashlib.sha256(data).hexdigest()
def main():
    required = ('NOA_SSH_HOST','NOA_SSH_USER','NOA_SSH_PASSWORD','NOA_SSH_HOST_FINGERPRINT','GITHUB_SHA')
    if any(not os.getenv(k) for k in required): raise RuntimeError('missing_deployment_configuration')
    data = SOURCE.read_bytes()
    expected = digest(data)
    commits = subprocess.check_output(['git','log','--format=%H','--',str(SOURCE)],text=True).splitlines()
    known = set()
    for commit in commits:
        known.add(digest(subprocess.check_output(['git','show',commit+':'+str(SOURCE)])))
    transport = paramiko.Transport((os.environ['NOA_SSH_HOST'],2022))
    try:
        transport.get_security_options().key_types = ('ssh-ed25519',)
        transport.start_client(timeout=20)
        fingerprint = 'SHA256:'+base64.b64encode(hashlib.sha256(transport.get_remote_server_key().asbytes()).digest()).decode().rstrip('=')
        if fingerprint != os.environ['NOA_SSH_HOST_FINGERPRINT']: raise RuntimeError('host_key_mismatch')
        transport.auth_password(os.environ['NOA_SSH_USER'],os.environ['NOA_SSH_PASSWORD'])
        if not transport.is_authenticated(): raise RuntimeError('authentication_failed')
        sftp = paramiko.SFTPClient.from_transport(transport)
        try:
            if sftp.normalize(ROOT) != ROOT: raise RuntimeError('unexpected_root')
            target = ROOT+'/'+REL
            if not stat.S_ISREG(sftp.lstat(target).st_mode): raise RuntimeError('target_missing_or_nonregular')
            with sftp.open(target,'rb') as stream: old = digest(stream.read())
            print('REMOTE_SHA256',old,'EXPECTED_SHA256',expected)
            if old not in known: raise RuntimeError('unknown_remote_version_refuse_overwrite')
            if old != expected:
                temp = target+'.'+os.environ['GITHUB_SHA'][:12]+'.tmp'
                try: sftp.lstat(temp)
                except FileNotFoundError: pass
                else: raise RuntimeError('temporary_file_exists')
                with sftp.open(temp,'xb') as stream: stream.write(data)
                with sftp.open(temp,'rb') as stream:
                    if digest(stream.read()) != expected: raise RuntimeError('staging_hash_mismatch')
                with sftp.open(target,'rb') as stream:
                    if digest(stream.read()) != old: raise RuntimeError('concurrent_remote_change')
                sftp.posix_rename(temp,target)
            with sftp.open(target,'rb') as stream:
                if digest(stream.read()) != expected: raise RuntimeError('remote_hash_mismatch')
            print('JUKEBOX_CSS_REMOTE_VERIFIED',expected)
        finally: sftp.close()
    finally: transport.close()
    url = 'https://noastudio.ai.kr/'+REL+'?audit='+os.environ['GITHUB_SHA'][:12]
    request = urllib.request.Request(url,headers={'Cache-Control':'no-cache'})
    with urllib.request.urlopen(request,timeout=30) as response:
        if digest(response.read()) != expected: raise RuntimeError('public_css_mismatch')
    print('JUKEBOX_CSS_PUBLIC_VERIFIED',expected)
if __name__ == '__main__': main()
