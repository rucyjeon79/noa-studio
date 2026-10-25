"""Safely deploy NOA player entrypoint; never overwrite unknown production changes."""
import base64,hashlib,os,stat,subprocess,urllib.request,re
from pathlib import Path
import paramiko
ROOT='/hosting/noastudio/html'
REMOTE=ROOT+'/noa-app/home.php'
SOURCE=Path('deploy/noa-app/home.php')
def sha(b):return hashlib.sha256(b).hexdigest()
def main():
    required=('NOA_SSH_HOST','NOA_SSH_USER','NOA_SSH_PASSWORD','NOA_SSH_HOST_FINGERPRINT')
    if any(not os.getenv(k) for k in required):raise RuntimeError('missing_noa_ssh_secret')
    entries=[]
    # Dependency first: the new hero runtime also supports the previous HOME markup.
    for path in ('noa-hero.js','noa-app/home.php'):
        source=Path('deploy')/path;data=source.read_bytes()
        commits=subprocess.check_output(['git','log','--format=%H','--',str(source)],text=True).splitlines()
        known={sha(subprocess.check_output(['git','show',commit+':'+str(source)])) for commit in commits}
        entries.append({'path':path,'remote':ROOT+'/'+path,'data':data,'new':sha(data),'known':known})
    new=entries[-1]['new']
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
            for entry in entries:
                if not stat.S_ISREG(sftp.lstat(entry['remote']).st_mode):raise RuntimeError('nonregular_target:'+entry['path'])
                with sftp.open(entry['remote'],'rb') as stream:entry['old']=sha(stream.read())
                print('REMOTE_SHA256',entry['path'],entry['old'],'CANDIDATE_SHA256',entry['new'])
                if entry['old'] not in entry['known']:raise RuntimeError('unknown_remote_version_refuse_overwrite:'+entry['path'])
            for entry in entries:
                if entry['old']==entry['new']:continue
                directory,filename=entry['remote'].rsplit('/',1)
                entry['temp']=directory+'/.'+filename+'.'+os.environ['GITHUB_SHA'][:12]+'.tmp'
                try:sftp.lstat(entry['temp'])
                except FileNotFoundError:pass
                else:raise RuntimeError('temporary_file_exists')
                with sftp.open(entry['temp'],'wb') as stream:stream.write(entry['data'])
                with sftp.open(entry['temp'],'rb') as stream:
                    if sha(stream.read())!=entry['new']:raise RuntimeError('upload_hash_mismatch')
            for entry in entries:
                with sftp.open(entry['remote'],'rb') as stream:
                    if sha(stream.read())!=entry['old']:raise RuntimeError('concurrent_remote_change:'+entry['path'])
            for entry in entries:
                if entry.get('temp'):sftp.posix_rename(entry['temp'],entry['remote'])
                with sftp.open(entry['remote'],'rb') as stream:
                    if sha(stream.read())!=entry['new']:raise RuntimeError('activation_hash_mismatch')
                print('REMOTE_FILE_VERIFIED',entry['path'],entry['new'])
            print('PHP_REMOTE_VERIFIED',new)
        finally:sftp.close()
    finally:transport.close()
    request=urllib.request.Request('https://noastudio.ai.kr/?audit='+os.environ['GITHUB_SHA'][:12],headers={'Cache-Control':'no-cache'})
    with urllib.request.urlopen(request,timeout=30) as response:
        html=response.read().decode('utf-8','replace')
        if re.search(r'TOP\s*10',html,re.IGNORECASE):
            raise RuntimeError('home_top10_label_still_present')
        if '추천 음악' not in html or '당신의 이야기, 우리의 음악' not in html:
            raise RuntimeError('home_sections_missing')
        if 'id="noa-hero-genre"' not in html or 'id="noa-hero-play"' not in html:raise RuntimeError('hero_introduction_markup_missing')
    asset=urllib.request.Request('https://noastudio.ai.kr/noa-hero.js?audit='+os.environ['GITHUB_SHA'][:12],headers={'Cache-Control':'no-cache'})
    with urllib.request.urlopen(asset,timeout=30) as response:
        if sha(response.read())!=entries[0]['new']:raise RuntimeError('hero_public_hash_mismatch')
    print('HERO_PUBLIC_VERIFIED',entries[0]['new'])
    print('PHP_PUBLIC_VERIFIED',new)
if __name__=='__main__':main()
