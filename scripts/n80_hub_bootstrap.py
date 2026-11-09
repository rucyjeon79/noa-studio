"""One-time, pinned transport for moving control into the existing N80 host."""
import base64
import hashlib
import json
import os
import paramiko
from pathlib import Path
import io, re, shlex, stat, subprocess, tarfile, time, hmac, secrets, urllib.request


def connect():
    transport = paramiko.Transport((os.environ['NOA_SSH_HOST'], 2022))
    transport.get_security_options().key_types = ('ssh-ed25519',)
    transport.start_client(timeout=20)
    fingerprint = 'SHA256:' + base64.b64encode(hashlib.sha256(transport.get_remote_server_key().asbytes()).digest()).decode().rstrip('=')
    if fingerprint != 'SHA256:0LqxbpOziJ4XgOMNEkfVrVGle3kpjJessI+jKqZ4JCU':
        transport.close()
        raise RuntimeError('host_key_mismatch')
    transport.auth_password(os.environ['NOA_SSH_USER'], os.environ['NOA_SSH_PASSWORD'])
    return transport


def probe():
    transport = connect()
    try:
        channel = transport.open_session(timeout=20)
        channel.settimeout(30)
        channel.exec_command('for tool in php php8.2 php82 php-cgi python3 python node crontab git java javac ffmpeg ffprobe bash; do command -v "$tool" || true; done; test -d /proc && echo proc_present; test -r /proc/self/status && echo proc_self_readable; crontab -l >/dev/null 2>&1; printf "cron_read_status=%s\\n" "$?"; ls -ld /usr/bin/php* /usr/local/bin/php* /hosting/noastudio/noa-ai-lab/host-runtime 2>/dev/null')
        output = channel.makefile('r').read(16384).decode(errors='replace')
        print('N80_HUB_HOST_CAPABILITIES', json.dumps({'output': output, 'exitCode': channel.recv_exit_status()}))
    finally:
        transport.close()


ROOT = '/hosting/noastudio/noa-hub'
WEB = '/hosting/noastudio/html'
FILES = {
 'noa-hub.php':'deploy/noa-hub.php', 'noa-hub-owner.php':'deploy/noa-hub-owner.php',
 'noa-bridge/hub-worker.php':'bridge/hub-worker.php',
 **{'noa-app/engine/'+n:'deploy/noa-app/engine/'+n for n in ['hub.php','hub-release.php','hub-specialists.php']},
}

def install():
    transport=connect()
    try:
        with paramiko.SFTPClient.from_transport(transport,window_size=8388608) as s:
            s.get_channel().settimeout(60)
            def mkdir(p):
                try:s.mkdir(p,0o700)
                except OSError:pass
                if not stat.S_ISDIR(s.lstat(p).st_mode) or s.normalize(p)!=p:raise RuntimeError('unsafe_directory')
                s.chmod(p,0o700)
            def read(p):
                try:info=s.lstat(p)
                except FileNotFoundError:return None
                if not stat.S_ISREG(info.st_mode) or info.st_size>134217728:raise RuntimeError('unsafe_file')
                with s.open(p,'rb') as f:return f.read()
            def put(p,data,mode=0o600):
                old=read(p)
                if old==data:return
                temp=p+'.stage-'+secrets.token_hex(8)
                with s.open(temp,'wx') as f:f.set_pipelined(True);f.write(data)
                s.chmod(temp,mode)
                if read(temp)!=data:raise RuntimeError('readback_mismatch')
                if read(p)!=old:raise RuntimeError('concurrent_change')
                s.posix_rename(temp,p)
            mkdir(ROOT);mkdir(ROOT+'/runtime')
            # New Hub files only. Existing core files use their own guarded owner.
            for target,source in FILES.items():
                desired=Path(source).read_bytes();old=read(WEB+'/'+target)
                known=set()
                for rev in subprocess.check_output(['git','log','--format=%H','--',source],text=True).splitlines():
                    known.add(subprocess.check_output(['git','show',rev+':'+source]))
                if old is not None and old not in known and old!=desired:raise RuntimeError('unknown_hub_version')
                put(WEB+'/'+target,desired,0o644)
            for name in ['runner.mjs','launch.mjs']:put(ROOT+'/runtime/'+name,Path('runtime/hub/'+name).read_bytes())
            manifest=json.loads(read('/hosting/noastudio/noa-ai-lab/host-runtime/node-current.json'))
            digest=manifest['nodeSha256']
            if not re.fullmatch('[a-f0-9]{64}',digest):raise RuntimeError('node_manifest_invalid')
            node='/hosting/noastudio/noa-ai-lab/host-runtime/node-'+digest[:16]
            if hashlib.sha256(read(node)).hexdigest()!=digest:raise RuntimeError('node_hash_mismatch')
            args=[node]
            if manifest['privateLibraries']:
                lib='/hosting/noastudio/noa-ai-lab/host-runtime/lib-'+digest[:16]
                args=[lib+'/ld-linux-x86-64.so.2','--library-path',lib,node]
            put(ROOT+'/node-command.json',json.dumps(args).encode())
            put(ROOT+'/operations.json',Path('config/n80-hub-operations.json').read_bytes())
            put(ROOT+'/dependencies.json',Path('config/n80-hub-dependencies.json').read_bytes())
            if read(ROOT+'/control.json') is None:
                put(ROOT+'/control.json',json.dumps({'revision':1,'paused':False,'activeOperations':['hub.verify']}).encode())
            # The initial full source snapshot moves out of GitHub, never into public media.
            if read(ROOT+'/source.json') is None:
                members=subprocess.check_output(['git','ls-files','-z']).decode().split('\0');members=[p for p in members if p and Path(p).is_file()]
                out=io.BytesIO()
                with tarfile.open(fileobj=out,mode='w:gz') as archive:
                    for name in members:archive.add(name,arcname=name,recursive=False)
                data=out.getvalue();put(ROOT+'/source-initial.tar.gz',data)
                put(ROOT+'/source.json',json.dumps({'revision':1,'files':len(members),'sourceCommit':os.environ['GITHUB_SHA'],'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data),'provider':'N80 Hub'}).encode())
            channel=transport.open_session(timeout=20);channel.settimeout(25)
            channel.exec_command(shlex.join(args+[ROOT+'/runtime/launch.mjs']))
            output=channel.makefile('r').read(1024).decode();code=channel.recv_exit_status();channel.close()
            if code!=0 or 'N80_HUB_' not in output:raise RuntimeError('hub_launch_failed')
            key=read('/hosting/noastudio/noa-ai-lab/worker.key').strip()
            for attempt in range(10):
                state=json.loads(read(ROOT+'/status.json') or b'{}')
                receipts=json.loads(read(ROOT+'/receipts.json') or b'[]')
                if any(r['operation']=='hub.verify' and r['state']=='succeeded' for r in receipts) and time.time()-state.get('heartbeatAt',0)<120:break
                time.sleep(3)
            else:raise RuntimeError('hub_execution_unverified')
            print('N80_HUB_INSTALLED',json.dumps({'sourceStored':True,'hostNodeRunning':True,'nativeVerification':True,'activeOperations':['hub.verify'],'githubRequiredForHubTick':False,'files':len(FILES)}))
    finally:transport.close()

if __name__ == '__main__':
    if os.environ.get('N80_HUB_INSTALL')=='1':install()
    else:probe()
