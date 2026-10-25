"""Shared song read-model dependency release using the established NOA SFTP/CAS contract."""
import base64, hashlib, json, os, re, stat, subprocess, urllib.request
from pathlib import Path
import paramiko
ROOT='/hosting/noastudio/html'
FILES={'noa-bridge/sound-core.php':'bridge/sound-core.php','noa-bridge/music-readmodel.php':'bridge/music-readmodel.php','noa-app/jukebox/core.php':'deploy/noa-app/jukebox/core.php'}
PROTECTED=['bbs/login.php','bbs/login_check.php','bbs/board.php','bbs/register.php','common.php','noa-app/jukebox/upload.js','noa-bridge/youtube-store.php']
def sha(data):return hashlib.sha256(data).hexdigest()
def main():
    names=('NOA_SSH_HOST','NOA_SSH_USER','NOA_SSH_PASSWORD','NOA_SSH_HOST_FINGERPRINT')
    if any(not os.getenv(k) for k in names):raise RuntimeError('missing_noa_ssh_secret')
    desired={remote:Path(local).read_bytes() for remote,local in FILES.items()}
    known={}
    for remote,local in FILES.items():
        known[remote]={sha(subprocess.check_output(['git','show',commit+':'+local])) for commit in subprocess.check_output(['git','log','--format=%H','--',local],text=True).splitlines()}
    transport=paramiko.Transport((os.environ['NOA_SSH_HOST'],2022))
    try:
        transport.get_security_options().key_types=('ssh-ed25519',)
        transport.start_client(timeout=20)
        fp='SHA256:'+base64.b64encode(hashlib.sha256(transport.get_remote_server_key().asbytes()).digest()).decode().rstrip('=')
        if fp!=os.environ['NOA_SSH_HOST_FINGERPRINT']:raise RuntimeError('host_key_mismatch')
        transport.auth_password(os.environ['NOA_SSH_USER'],os.environ['NOA_SSH_PASSWORD'])
        sftp=paramiko.SFTPClient.from_transport(transport)
        try:
            sftp.get_channel().settimeout(30)
            if sftp.normalize(ROOT)!=ROOT:raise RuntimeError('unexpected_root')
            def read(path):
                full=ROOT+'/'+path
                if sftp.normalize(full.rsplit('/',1)[0])!=full.rsplit('/',1)[0]:raise RuntimeError('noncanonical_parent')
                try:info=sftp.lstat(full)
                except FileNotFoundError:return None
                if not stat.S_ISREG(info.st_mode):raise RuntimeError('nonregular_target:'+path)
                with sftp.open(full,'rb') as stream:return stream.read()
            before={path:read(path) for path in FILES}
            for path,data in before.items():
                if data is None:
                    if path!='noa-browse-order.js':raise RuntimeError('missing_existing_target:'+path)
                elif sha(data) not in known[path]:raise RuntimeError('unknown_remote_version:'+path)
            protected={path:sha(read(path)) for path in PROTECTED}
            for path,data in desired.items():
                if before[path]==data:continue
                temp=path+'.'+os.environ['GITHUB_SHA'][:12]+'.tmp'
                if read(temp) is not None:raise RuntimeError('temporary_file_exists')
                try:
                    with sftp.open(ROOT+'/'+temp,'wx') as stream:stream.write(data)
                    sftp.chmod(ROOT+'/'+temp,stat.S_IMODE(sftp.lstat(ROOT+'/'+path).st_mode) if before[path] is not None else 0o644)
                    if read(temp)!=data:raise RuntimeError('temporary_readback_mismatch')
                    if read(path)!=before[path]:raise RuntimeError('concurrent_remote_change:'+path)
                    sftp.posix_rename(ROOT+'/'+temp,ROOT+'/'+path)
                    if read(path)!=data:raise RuntimeError('activation_hash_mismatch:'+path)
                finally:
                    if read(temp)==data:sftp.remove(ROOT+'/'+temp)
            assert all(sha(read(path))==digest for path,digest in protected.items()),'protected_source_changed'
            receipt={'sha256':{path:sha(read(path)) for path in FILES},'protectedUnchanged':len(protected),'databaseWrites':0}
        finally:sftp.close()
    finally:transport.close()
    # Read both public projections; no catalog, playlist or media writes.
    models={}
    for page,pattern in [('noa-music.php',r'const records=(\[.*?\]);'),('noa-youtube.php',r'const rows=(\[.*?\]),search=')]:
        with urllib.request.urlopen('https://noastudio.ai.kr/'+page+'?audit='+os.environ['GITHUB_SHA'],timeout=30) as response:
            html=response.read().decode('utf-8')
        match=re.search(pattern,html)
        if not match:raise RuntimeError('public_catalog_missing:'+page)
        models[page]=json.loads(match[1])
    music={str(r.get('orderKey') or r['key']).removeprefix('catalog:') for r in models['noa-music.php']}
    linked=[r for r in models['noa-youtube.php'] if r.get('orderKey') and r.get('genre')!='unclassified']
    missing=[r['key'] for r in linked if r['orderKey'] not in music]
    if missing:raise RuntimeError('linked_youtube_song_missing_in_music:'+','.join(missing))
    receipt['publicLinkedSongsVerified']=len(linked)
    receipt['musicRecords']=len(models['noa-music.php'])
    receipt['missingLinkedSongs']=len(missing)
    Path('initial-flash-proof').mkdir(parents=True,exist_ok=True)
    Path('initial-flash-proof/shared-catalog-deployment.json').write_text(json.dumps(receipt,indent=2))
    print('NOA_SHARED_CATALOG_DEPLOYED',json.dumps(receipt))
if __name__=='__main__':main()
