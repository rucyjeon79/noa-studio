"""N80-owned, one-request ChatGPT account connection on its subordinate runner."""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import signal
import socket
import stat
import subprocess
import sys
import tarfile
import time
import urllib.request

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

ROOT='/hosting/noastudio/noa-hub'
PRIVATE=ROOT+'/codex'
VERSION='0.167.1'
URL='https://github.com/openai/codex/releases/download/rust-v0.167.1/codex-x86_64-unknown-linux-musl.tar.gz'
ARCHIVE_SHA='64bcc99c32e434b4bcb0508a97df9b7aeecdb97e956d976fb13661096ec4e3e2'
BINARY_SHA='dd5bfdf19d794dcc6fb482d2d5a2d9fb31d11f6caa44b303bb72890d461e8a02'
HOST_FP='SHA256:0LqxbpOziJ4XgOMNEkfVrVGle3kpjJessI+jKqZ4JCU'
AAD=b'N80-CODEX-CHATGPT-1'

def dump(value):return (json.dumps(value,separators=(',',':'))+'\n').encode()
def request():
    q=json.loads(Path('config/n80-codex-connect-request.json').read_text())
    if q.get('action')!='connect_chatgpt' or not re.fullmatch('[a-f0-9]{32}',q.get('id','')):
        raise RuntimeError('invalid_connection_request')
    return q
def paths():
    root=Path(os.environ['RUNNER_TEMP'])/'n80-codex-connect'
    root.mkdir(mode=0o700,exist_ok=True)
    return root,Path.home()/'.codex'/'auth.json'
def clean_env():
    allow={'PATH','HOME','LANG','LC_ALL','TMPDIR','SSL_CERT_FILE','SSL_CERT_DIR'}
    return {k:v for k,v in os.environ.items() if k in allow}
def atomic(path,value):
    temp=path.with_name(path.name+'.tmp-'+secrets.token_hex(8))
    with temp.open('xb') as f:os.chmod(temp,0o600);f.write(dump(value))
    temp.replace(path)
def challenge_from_output(text):
    clean=re.sub(r'\x1b\[[0-9;]*m','',text)
    match=re.search(r'\n\s+([A-Z0-9]{3,10}-[A-Z0-9]{3,10})\s*\n',clean)
    if 'https://auth.openai.com/codex/device' not in clean or not match:return None
    return {'url':'https://auth.openai.com/codex/device','code':match.group(1)}
def encrypt_challenge(challenge,public_pem):
    key=serialization.load_pem_public_key(public_pem)
    return base64.b64encode(key.encrypt(dump(challenge),padding.OAEP(mgf=padding.MGF1(hashes.SHA256()),algorithm=hashes.SHA256(),label=None))).decode()
def seal(raw,key):
    nonce=secrets.token_bytes(12)
    return nonce+AESGCM(key).encrypt(nonce,raw,AAD)
def unseal(blob,key):return AESGCM(key).decrypt(blob[:12],blob[12:],AAD)
def allowed_new_request(existing,q,run):
    if existing is None:return True
    # Neither a rerun nor a new request silently replaces an unresolved login.
    if existing.get('state')=='authenticated':return False
    raise RuntimeError('prior_connection_requires_review')

class Host:
    def __enter__(self):
        import paramiko
        sock=socket.create_connection((os.environ['NOA_SSH_HOST'],2022),timeout=20)
        self.transport=paramiko.Transport(sock);self.transport.auth_timeout=25
        self.transport.get_security_options().key_types=('ssh-ed25519',)
        self.transport.start_client(timeout=20)
        fingerprint='SHA256:'+base64.b64encode(hashlib.sha256(self.transport.get_remote_server_key().asbytes()).digest()).decode().rstrip('=')
        if fingerprint!=HOST_FP:self.transport.close();raise RuntimeError('host_key_mismatch')
        self.transport.auth_password(os.environ['NOA_SSH_USER'],os.environ['NOA_SSH_PASSWORD'])
        self.s=paramiko.SFTPClient.from_transport(self.transport);self.s.get_channel().settimeout(25)
        if self.s.normalize(ROOT)!=ROOT:raise RuntimeError('host_root_invalid')
        return self
    def __exit__(self,*args):self.transport.close()
    def read(self,name):
        path=PRIVATE+'/'+name
        try:info=self.s.lstat(path)
        except FileNotFoundError:return None
        if not stat.S_ISREG(info.st_mode) or info.st_size>1048576:raise RuntimeError('private_file_invalid')
        with self.s.open(path,'rb') as f:return f.read()
    def write(self,name,raw,expected):
        if self.read(name)!=expected:raise RuntimeError('private_file_changed')
        path=PRIVATE+'/'+name;tmp=path+'.stage-'+secrets.token_hex(8)
        try:
            with self.s.open(tmp,'wx') as f:f.write(raw)
            self.s.chmod(tmp,0o600)
            with self.s.open(tmp,'rb') as f:
                if f.read()!=raw:raise RuntimeError('private_file_readback_failed')
            if self.read(name)!=expected:raise RuntimeError('private_file_changed')
            self.s.posix_rename(tmp,path)
        finally:
            try:self.s.remove(tmp)
            except FileNotFoundError:pass
    def claim(self,q):
        control_path=ROOT+'/control.json'
        with self.s.open(control_path,'rb') as f:control=json.load(f)
        if control.get('paused') or control.get('stop'):raise RuntimeError('n80_paused')
        try:self.s.mkdir(PRIVATE,0o700)
        except OSError:pass
        if not stat.S_ISDIR(self.s.lstat(PRIVATE).st_mode) or self.s.normalize(PRIVATE)!=PRIVATE:raise RuntimeError('private_directory_invalid')
        old=self.read('connection.json');previous=json.loads(old) if old else None
        if not allowed_new_request(previous,q,os.environ['GITHUB_RUN_ID']):return False
        try:self.s.mkdir(PRIVATE+'/connection.lock',0o700)
        except OSError:raise RuntimeError('connection_busy')
        self.write('connection.json',dump({'requestId':q['id'],'runId':os.environ['GITHUB_RUN_ID'],'state':'connecting','owner':'n80_hub','executor':'github_subordinate','startedAt':int(time.time()),'generationRequests':0,'automaticRetry':False}),old)
        return True
    def finish(self,q,state,**extra):
        old=self.read('connection.json');current=json.loads(old or b'{}')
        if current.get('requestId')!=q['id'] or current.get('runId')!=os.environ['GITHUB_RUN_ID']:raise RuntimeError('connection_owner_changed')
        if current.get('state')!='connecting':raise RuntimeError('connection_already_finished')
        current.update(state=state,finishedAt=int(time.time()),**extra)
        self.write('connection.json',dump(current),old)
        self.s.rmdir(PRIVATE+'/connection.lock')
        return current
    def persist_auth(self,q,raw):
        current=json.loads(self.read('connection.json') or b'{}')
        if current.get('state')!='connecting' or current.get('requestId')!=q['id'] or current.get('runId')!=os.environ['GITHUB_RUN_ID']:raise RuntimeError('connection_owner_changed')
        if self.read('chatgpt-auth.enc') is not None:raise RuntimeError('existing_auth_preserved')
        key=self.read('auth-vault.key')
        if key is None:key=secrets.token_bytes(32);self.write('auth-vault.key',key,None)
        if len(key)!=32:raise RuntimeError('auth_vault_key_invalid')
        encrypted=seal(raw,key)
        self.write('chatgpt-auth.enc',encrypted,None)
        if unseal(self.read('chatgpt-auth.enc'),key)!=raw:raise RuntimeError('auth_vault_verification_failed')

def install_cli(root):
    archive=root/'codex.tar.gz';h=hashlib.sha256();total=0;started=time.monotonic()
    with urllib.request.urlopen(URL,timeout=30) as response,archive.open('xb') as out:
        while chunk:=response.read(1048576):
            total+=len(chunk)
            if total>150000000 or time.monotonic()-started>120:raise RuntimeError('download_limit')
            h.update(chunk);out.write(chunk)
    if h.hexdigest()!=ARCHIVE_SHA:raise RuntimeError('official_archive_hash_mismatch')
    binary=root/'codex'
    with tarfile.open(archive,'r:gz') as tar:
        members=[m for m in tar.getmembers() if m.isfile() and m.name.rsplit('/',1)[-1]=='codex-x86_64-unknown-linux-musl']
        if len(members)!=1 or members[0].size!=320186856:raise RuntimeError('official_binary_invalid')
        h=hashlib.sha256()
        with tar.extractfile(members[0]) as src,binary.open('xb') as out:
            while chunk:=src.read(1048576):h.update(chunk);out.write(chunk)
    if h.hexdigest()!=BINARY_SHA:raise RuntimeError('official_binary_hash_mismatch')
    binary.chmod(0o700);archive.unlink()
    r=subprocess.run([str(binary),'--version'],env=clean_env(),capture_output=True,text=True,timeout=20)
    if r.returncode or 'codex-cli '+VERSION not in r.stdout:raise RuntimeError('native_cli_unavailable')
    return binary

def start():
    q=request();root,auth_path=paths()
    if auth_path.exists():raise RuntimeError('runner_has_existing_auth_preserved')
    atomic(root/'auth-owner.json',{'requestId':q['id'],'runId':os.environ['GITHUB_RUN_ID']})
    binary=install_cli(root)
    feature=subprocess.run([str(binary),'--no-daemon','features','list'],env=clean_env(),capture_output=True,text=True,timeout=30)
    if feature.returncode:raise RuntimeError('runner_configuration_unavailable')
    with Host() as host:
        if not host.claim(q):
            print(json.dumps({'state':'already_authenticated','owner':'n80_hub'}));return
    log=(root/'monitor.log').open('xb');os.chmod(log.name,0o600)
    proc=subprocess.Popen([sys.executable,str(Path(__file__).resolve()),'monitor'],stdin=subprocess.DEVNULL,stdout=log,stderr=log,start_new_session=True)
    log.close();atomic(root/'monitor.json',{'pid':proc.pid,'requestId':q['id']})
    deadline=time.monotonic()+70
    while time.monotonic()<deadline:
        if Path('codex-proof/device-challenge.json').exists():
            with open(os.environ['GITHUB_OUTPUT'],'a') as f:f.write('needs_auth=true\n')
            print(json.dumps({'state':'authorization_required','requestId':q['id'],'generationRequests':0}));return
        if (root/'result.json').exists():
            result=json.loads((root/'result.json').read_text());print(json.dumps(result));raise RuntimeError(result.get('error','connection_failed'))
        time.sleep(0.5)
    # Keep the same monitor/request. The wait step may still collect a terminal
    # receipt; never launch another login when the response is unconfirmed.
    proc.terminate()
    try:proc.wait(timeout=35)
    except subprocess.TimeoutExpired:proc.kill()
    raise RuntimeError('device_challenge_not_ready')

def monitor():
    import selectors
    def cancelled(*_):raise RuntimeError('connection_cancelled')
    signal.signal(signal.SIGTERM,cancelled)
    q=request();root,auth_path=paths();binary=root/'codex';proc=None
    result={'state':'failed','requestId':q['id'],'generationRequests':0}
    try:
        args=[str(binary),'--no-daemon','-c','forced_login_method="chatgpt"','-c','cli_auth_credentials_store="file"','login','--device-auth']
        proc=subprocess.Popen(args,env=clean_env(),stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,start_new_session=True)
        select=selectors.DefaultSelector();select.register(proc.stdout,selectors.EVENT_READ)
        text='';sent=False;started=time.monotonic();started_at=int(time.time())
        while proc.poll() is None:
            if time.monotonic()-started>720:raise RuntimeError('authorization_expired')
            for key,_ in select.select(0.5):
                chunk=os.read(key.fd,4096)
                if not chunk:continue
                text+=chunk.decode(errors='replace')
                if len(text)>65536:raise RuntimeError('login_output_limit')
                challenge=challenge_from_output(text)
                if challenge and not sent:
                    challenge['expiresAt']=started_at+720
                    encrypted=encrypt_challenge(challenge,Path('config/n80-codex-device-public.pem').read_bytes())
                    Path('codex-proof').mkdir(exist_ok=True)
                    atomic(Path('codex-proof/device-challenge.json'),{'requestId':q['id'],'expiresAt':started_at+720,'ciphertext':encrypted})
                    sent=True
        if proc.returncode!=0:
            text+=(proc.stdout.read(65536-len(text)) or b'').decode(errors='replace')
            if re.search(r'device.{0,40}(?:not enabled|disabled)',text,re.I):raise RuntimeError('device_login_disabled')
            if re.search(r'403|forbidden',text,re.I):raise RuntimeError('authentication_access_denied')
            if re.search(r'unexpected argument|unknown.*field|invalid value',text,re.I):raise RuntimeError('login_configuration_invalid')
            raise RuntimeError('device_login_failed')
        check=subprocess.run([str(binary),'--no-daemon','-c','forced_login_method="chatgpt"','login','status'],env=clean_env(),capture_output=True,text=True,timeout=20)
        if check.returncode or 'logged in using chatgpt' not in (check.stdout+check.stderr).lower():raise RuntimeError('subscription_auth_unverified')
        if not auth_path.is_file() or auth_path.is_symlink() or auth_path.stat().st_size>1048576:raise RuntimeError('auth_file_invalid')
        raw=auth_path.read_bytes();data=json.loads(raw)
        if data.get('OPENAI_API_KEY') or not isinstance(data.get('tokens'),dict):raise RuntimeError('subscription_auth_required')
        with Host() as host:
            host.persist_auth(q,raw)
            receipt=host.finish(q,'authenticated',auth='chatgpt',vaultVerified=True,workerActivated=False)
        result={'state':'authenticated','requestId':q['id'],'generationRequests':0,'vaultVerified':True,'workerActivated':False}
    except Exception as e:
        code=str(e)
        result['error']=code if re.fullmatch('[a-z_]{3,80}',code) else 'connection_failed'
        if proc is not None and proc.poll() is None:
            os.killpg(proc.pid,signal.SIGTERM)
            try:proc.wait(timeout=4)
            except subprocess.TimeoutExpired:os.killpg(proc.pid,signal.SIGKILL);proc.wait(timeout=4)
        try:
            with Host() as host:host.finish(q,'failed',error=result['error'])
        except Exception:result['hostReceiptUnconfirmed']=True
    finally:
        if auth_path.exists() and auth_path.is_file() and not auth_path.is_symlink():auth_path.unlink()
        atomic(root/'result.json',result)

def wait():
    root,_=paths();deadline=time.monotonic()+740
    while time.monotonic()<deadline:
        if (root/'result.json').exists():
            result=json.loads((root/'result.json').read_text())
            Path('codex-proof').mkdir(exist_ok=True);atomic(Path('codex-proof/connection-result.json'),result)
            print(json.dumps(result))
            if result.get('state')!='authenticated':raise RuntimeError(result.get('error','connection_failed'))
            return
        time.sleep(1)
    raise RuntimeError('connection_result_unconfirmed')

def cleanup():
    root,auth_path=paths();q=request();pidfile=root/'monitor.json'
    if not (root/'result.json').exists() and pidfile.exists():
        identity=json.loads(pidfile.read_text())
        if identity.get('requestId')!=q['id']:raise RuntimeError('monitor_owner_changed')
        try:os.kill(identity['pid'],signal.SIGTERM)
        except ProcessLookupError:pass
        until=time.monotonic()+40
        while time.monotonic()<until and not (root/'result.json').exists():time.sleep(1)
    marker=root/'auth-owner.json'
    owned=marker.is_file() and json.loads(marker.read_text())=={'requestId':q['id'],'runId':os.environ['GITHUB_RUN_ID']}
    if owned and auth_path.is_file() and not auth_path.is_symlink():auth_path.unlink()
    if (root/'result.json').exists():
        Path('codex-proof').mkdir(exist_ok=True)
        atomic(Path('codex-proof/connection-result.json'),json.loads((root/'result.json').read_text()))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('action',choices=['start','monitor','wait','cleanup']);a=p.parse_args()
    try:globals()[a.action]()
    except Exception as e:
        code=str(e);code=code if re.fullmatch('[a-z_]{3,80}',code) else 'connection_failed'
        print(json.dumps({'ok':False,'error':code,'generationRequests':0}));raise SystemExit(1)
