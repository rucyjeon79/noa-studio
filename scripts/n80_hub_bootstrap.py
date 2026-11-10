"""One-time, pinned transport for moving control into the existing N80 host."""
import base64
import hashlib
import json
import os
import paramiko
from pathlib import Path
import io, re, shlex, stat, subprocess, tarfile, time, hmac, secrets, tempfile, urllib.request, urllib.error


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
 'noa-bridge/hub-worker.php':'bridge/hub-worker.php', 'noa-bridge/hub-admin.php':'bridge/hub-admin.php',
 **{'noa-app/engine/'+n:'deploy/noa-app/engine/'+n for n in ['hub.php','hub-release.php','hub-specialists.php']},
}

def native_call(key,body):
    raw=json.dumps(body,separators=(',',':')).encode();ts=str(int(time.time()));nonce=secrets.token_hex(16)
    signature=hmac.new(key,('N80-HUB-1\n'+hashlib.sha256(raw).hexdigest()+'\n'+ts+'\n'+nonce).encode(),hashlib.sha256).hexdigest()
    req=urllib.request.Request('https://noastudio.ai.kr/noa-bridge/hub-admin.php',data=raw,headers={'Content-Type':'application/json','X-N80-Time':ts,'X-N80-Nonce':nonce,'X-N80-Signature':signature})
    with urllib.request.urlopen(req,timeout=120)as r:result=json.load(r)
    if result.get('ok') is not True:raise RuntimeError('native_admin_failed')
    return result

def install():
    transport=connect();args=None
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
                with s.open(p,'rb') as f:
                    f.prefetch(info.st_size,max_concurrent_requests=32)
                    return f.read()
            def present(p):
                try:info=s.lstat(p)
                except FileNotFoundError:return False
                if not stat.S_ISREG(info.st_mode) or info.st_size>134217728:raise RuntimeError('unsafe_file')
                return True
            def remote_hash(p):
                js="const f=require('fs'),c=require('crypto');process.stdout.write(c.createHash('sha256').update(f.readFileSync(process.argv[1])).digest('hex'))"
                channel=transport.open_session(timeout=20);channel.settimeout(60);channel.exec_command(shlex.join(args+['-e',js,p]))
                result=channel.makefile('r').read(512).decode().strip();code=channel.recv_exit_status();channel.close()
                if code!=0 or not re.fullmatch('[a-f0-9]{64}',result):raise RuntimeError('host_hash_failed')
                return result
            unchanged=object()
            def put(p,data,mode=0o600,expected_old=unchanged):
                large=len(data)>1048576 and args is not None
                old=(remote_hash(p) if present(p) else None) if large else read(p)
                if expected_old is not unchanged and old!=expected_old:raise RuntimeError('concurrent_change')
                desired=hashlib.sha256(data).hexdigest() if large else data
                if old==desired:return
                temp=p+'.stage-'+secrets.token_hex(8)
                with s.open(temp,'wx') as f:f.set_pipelined(True);f.write(data)
                s.chmod(temp,mode)
                if (remote_hash(temp) if large else read(temp))!=desired:raise RuntimeError('readback_mismatch')
                current=(remote_hash(p) if present(p) else None) if large else read(p)
                if current!=old:raise RuntimeError('concurrent_change')
                s.posix_rename(temp,p)
            mkdir(ROOT);mkdir(ROOT+'/runtime');print('N80_HUB_STAGE directories',flush=True)
            manifest=json.loads(read('/hosting/noastudio/noa-ai-lab/host-runtime/node-current.json'))
            digest=manifest['nodeSha256']
            if not re.fullmatch('[a-f0-9]{64}',digest):raise RuntimeError('node_manifest_invalid')
            node='/hosting/noastudio/noa-ai-lab/host-runtime/node-'+digest[:16]
            args=[node]
            if manifest['privateLibraries']:
                lib='/hosting/noastudio/noa-ai-lab/host-runtime/lib-'+digest[:16]
                args=[lib+'/ld-linux-x86-64.so.2','--library-path',lib,node]
            # Use the already installed N80 Node to hash its local file. Do not transfer the large runtime over SFTP.
            js="const f=require('fs'),c=require('crypto');process.stdout.write(c.createHash('sha256').update(f.readFileSync(process.argv[1])).digest('hex'))"
            channel=transport.open_session(timeout=20);channel.settimeout(45)
            channel.exec_command(shlex.join(args+['-e',js,node]))
            actual=channel.makefile('r').read(512).decode().strip();code=channel.recv_exit_status();channel.close()
            if code!=0 or actual!=digest:raise RuntimeError('node_hash_mismatch')
            print('N80_HUB_STAGE node_verified',flush=True)
            put(ROOT+'/runtime/stop.mjs',Path('runtime/hub/stop.mjs').read_bytes())
            # Quiesce the previous fixed runner before changing its protocol or public handlers.
            if read(ROOT+'/runtime/runner.mjs') not in (None,Path('runtime/hub/runner.mjs').read_bytes()):
                previous=read(ROOT+'/control.json')
                if previous:
                    control=json.loads(previous);control['stop']=True;control['revision']=control.get('revision',0)+1
                    put(ROOT+'/control.json',json.dumps(control).encode(),expected_old=previous)
                    channel=transport.open_session(timeout=20);channel.settimeout(15);channel.exec_command(shlex.join(args+[ROOT+'/runtime/stop.mjs']))
                    output=channel.makefile('r').read(512).decode();code=channel.recv_exit_status();channel.close()
                    if code!=0 or 'N80_HUB_STOPPED' not in output:raise RuntimeError('runner_quiescence_unconfirmed')
            # Another N80 release owns these shared modules; never install a registry with missing dependencies.
            for name in ['module-contract.php','setup.php','lab.php']:
                if read(WEB+'/noa-app/engine/'+name) is None:raise RuntimeError('specialist_release_not_installed')
            # New Hub files only. Existing core files use their own guarded owner.
            for target,source in FILES.items():
                desired=Path(source).read_bytes();old=read(WEB+'/'+target)
                known=set()
                for rev in subprocess.check_output(['git','log','--format=%H','--',source],text=True).splitlines():
                    known.add(subprocess.check_output(['git','show',rev+':'+source]))
                if old is not None and old not in known and old!=desired:raise RuntimeError('unknown_hub_version')
                put(WEB+'/'+target,desired,0o644)
            print('N80_HUB_STAGE php_sources',flush=True)
            for name in ['runner.mjs','launch.mjs','probe.mjs','stop.mjs']:put(ROOT+'/runtime/'+name,Path('runtime/hub/'+name).read_bytes())
            put(ROOT+'/client.py',Path('scripts/n80_hub_client.py').read_bytes())
            put(ROOT+'/operations-guide.md',Path('docs/operations/n80-hub.md').read_bytes())
            channel=transport.open_session(timeout=20);channel.settimeout(35);channel.exec_command(shlex.join(args+[ROOT+'/runtime/probe.mjs']))
            raw=channel.makefile('r').read(4096).decode();code=channel.recv_exit_status();channel.close()
            if code!=0:raise RuntimeError('host_route_probe_failed')
            routes=json.loads(raw);print('N80_HUB_ROUTES',json.dumps(routes),flush=True)
            route=next((r['name'] for r in routes if r.get('verified') and r['name'] in ['https_ipv4','https_loopback','loopback']),None)
            if route is None:raise RuntimeError('host_route_unavailable')
            put(ROOT+'/transport.json',json.dumps({'route':route}).encode())
            put(ROOT+'/node-command.json',json.dumps(args).encode())
            put(ROOT+'/operations.json',Path('config/n80-hub-operations.json').read_bytes())
            put(ROOT+'/dependencies.json',Path('config/n80-hub-dependencies.json').read_bytes())
            if read(ROOT+'/access.key') is None:put(ROOT+'/access.key',secrets.token_hex(32).encode())
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
            if not present(ROOT+'/source.bundle'):
                with tempfile.TemporaryDirectory(prefix='n80-hub-')as folder:
                    bundle=Path(folder)/'source.bundle'
                    subprocess.run(['git','bundle','create',str(bundle),'HEAD'],check=True,capture_output=True)
                    subprocess.run(['git','bundle','verify',str(bundle)],check=True,capture_output=True)
                    data=bundle.read_bytes();put(ROOT+'/source.bundle',data)
                    source=json.loads(read(ROOT+'/source.json'));source['bundleSha256']=hashlib.sha256(data).hexdigest();source['bundleCommit']=os.environ['GITHUB_SHA']
                    put(ROOT+'/source.json',json.dumps(source).encode())
            # Keep later source history as small native incremental bundles, with no remote repository dependency.
            previous=read(ROOT+'/source.json');source=json.loads(previous);base=source.get('historyHead',source.get('bundleCommit'))
            if base and base!=os.environ['GITHUB_SHA']:
                subprocess.run(['git','merge-base','--is-ancestor',base,'HEAD'],check=True,capture_output=True)
                with tempfile.TemporaryDirectory(prefix='n80-hub-history-')as folder:
                    bundle=Path(folder)/'update.bundle';subprocess.run(['git','bundle','create',str(bundle),base+'..HEAD'],check=True,capture_output=True)
                    subprocess.run(['git','bundle','verify',str(bundle)],check=True,capture_output=True)
                    data=bundle.read_bytes();name='history-'+os.environ['GITHUB_SHA']+'.bundle';put(ROOT+'/'+name,data)
                    source.setdefault('history',[]).append({'commit':os.environ['GITHUB_SHA'],'base':base,'file':name,'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data)})
                    source['historyHead']=os.environ['GITHUB_SHA'];put(ROOT+'/source.json',json.dumps(source).encode(),expected_old=previous)
            print('N80_HUB_STAGE source_stored',flush=True)
            previous=read(ROOT+'/control.json');control=json.loads(previous)
            if control.get('stop'):
                control['stop']=False;control['revision']=control.get('revision',0)+1
                put(ROOT+'/control.json',json.dumps(control).encode(),expected_old=previous)
            channel=transport.open_session(timeout=20);channel.settimeout(25)
            channel.exec_command(shlex.join(args+[ROOT+'/runtime/launch.mjs']))
            output=channel.makefile('r').read(1024).decode();code=channel.recv_exit_status();channel.close()
            if code!=0 or 'N80_HUB_' not in output:raise RuntimeError('hub_launch_failed')
            key=read(ROOT+'/access.key').strip()
            # Prove automation credentials cannot obtain deployment authority.
            try:native_call(read('/hosting/noastudio/noa-ai-lab/worker.key').strip(),{'action':'status'})
            except urllib.error.HTTPError as error:
                if error.code!=401:raise
            else:raise RuntimeError('automation_key_accepted_for_admin')
            for attempt in range(10):
                state=json.loads(read(ROOT+'/status.json') or b'{}')
                receipts=json.loads(read(ROOT+'/receipts.json') or b'[]')
                if any(r['operation']=='hub.verify' and r['state']=='succeeded' for r in receipts) and time.time()-state.get('heartbeatAt',0)<120:break
                time.sleep(3)
            else:raise RuntimeError('hub_execution_unverified:'+json.dumps(json.loads(read(ROOT+'/runner-error.json') or b'{}')))
            # Integrate navigation and registry through the new native deployment path itself.
            package={'version':1,'id':secrets.token_hex(16),'files':[]}
            integrations=[('deploy/noa-app/engine/'+n,'noa-app/engine/'+n)for n in ['registry.php','workspaces.php']]+[('bridge/lab-worker.php','noa-bridge/lab-worker.php')]
            for source,target in integrations:
                old=read(WEB+'/'+target);desired=Path(source).read_bytes()
                if old==desired:continue
                known=[subprocess.check_output(['git','show',rev+':'+source])for rev in subprocess.check_output(['git','log','--format=%H','--',source],text=True).splitlines()]
                if old not in known:raise RuntimeError('integration_preimage_changed')
                package['files'].append({'path':target,'beforeSha256':hashlib.sha256(old).hexdigest(),'sha256':hashlib.sha256(desired).hexdigest(),'bytes':len(desired),'data':base64.b64encode(desired).decode()})
            for target,source in FILES.items():
                desired=Path(source).read_bytes();digest=hashlib.sha256(desired).hexdigest()
                package['files'].append({'path':target,'beforeSha256':digest,'sha256':digest,'bytes':len(desired),'data':base64.b64encode(desired).decode()})
            if package['files']:
                current=native_call(key,{'action':'status'})
                receipt=native_call(key,{'action':'release','revision':current['source']['revision'],'package':package})
                for row in package['files']:
                    if hashlib.sha256(read(WEB+'/'+row['path'])).hexdigest()!=row['sha256']:raise RuntimeError('native_release_readback_failed')
                print('N80_HUB_NATIVE_RELEASE',json.dumps({'revision':receipt['revision'],'files':len(package['files']),'githubRequiredByRelease':False}),flush=True)
            if os.getenv('N80_HUB_CUTOVER')=='1':
                current=native_call(key,{'action':'status'})
                active=['hub.verify','ai.text','ai.batch','catalog.index','notifications.dispatch','popularity.calculate','members.maintain']
                native_call(key,{'action':'control','revision':current['revision'],'activeOperations':active})
                for attempt in range(35):
                    current=native_call(key,{'action':'status'})
                    states={r['id']:r['last'] for r in current['operations'] if r['id'] in active}
                    if len(states)==len(active) and all(r and r['state']=='succeeded' for r in states.values()):break
                    time.sleep(4)
                else:raise RuntimeError('cutover_not_verified:'+','.join(k+':'+(v or {}).get('state','waiting')+':'+(v or {}).get('error','')for k,v in states.items()))
                print('N80_HUB_CUTOVER',json.dumps({'activeOperations':active,'verifiedReceipts':len(states)}),flush=True)
            # Remove only abandoned staging files created by this bootstrap, never source archives or user data.
            for entry in s.listdir_attr(ROOT):
                if re.fullmatch(r'(?:source-initial\.tar\.gz|source\.bundle)\.stage-[a-f0-9]{16}',entry.filename) and stat.S_ISREG(entry.st_mode):
                    s.remove(ROOT+'/'+entry.filename)
            print('N80_HUB_INSTALLED',json.dumps({'sourceStored':True,'hostNodeRunning':True,'nativeVerification':True,'activeOperations':native_call(key,{'action':'status'})['operations'],'githubRequiredForHubTick':False,'files':len(FILES)}))
    finally:transport.close()

if __name__ == '__main__':
    if os.environ.get('N80_HUB_INSTALL')=='1':install()
    else:probe()
