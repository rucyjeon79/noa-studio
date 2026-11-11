"""Bounded, zero-generation prerequisite check on the existing N80 host."""
import json
import gzip
import hashlib
import os
from pathlib import Path
import re
import shlex
import stat
import time
import tarfile
import tempfile
import urllib.request
import paramiko
from n80_hub_bootstrap import connect

ROOT = '/hosting/noastudio/noa-hub'
VERSION='0.167.1'
ASSET='https://github.com/openai/codex/releases/download/rust-v0.167.1/codex-x86_64-unknown-linux-musl.tar.gz'
ASSET_SHA='64bcc99c32e434b4bcb0508a97df9b7aeecdb97e956d976fb13661096ec4e3e2'
PROBE = r'''
const fs=require('node:fs'),https=require('node:https'),dns=require('node:dns');
const names=['github.com','auth.openai.com','chatgpt.com'];
const probe=hostname=>new Promise(resolve=>{
  let done=false,stage='dns';const finish=result=>{if(!done){done=true;clearTimeout(timer);resolve({...result,stage});}};
  const req=https.request({hostname,method:'HEAD',path:'/',family:4,timeout:12000,agent:false},res=>{res.resume();finish({host:hostname,tls:true,status:res.statusCode});});
  req.on('socket',s=>{s.on('lookup',err=>{stage=err?'dns_error':'tcp';});s.on('connect',()=>{stage='tls';});s.on('secureConnect',()=>{stage='http';});});
  const timer=setTimeout(()=>{finish({host:hostname,tls:false,error:'TIMEOUT'});req.destroy();},15000);
  req.on('error',e=>finish({host:hostname,tls:false,error:/^[A-Z_0-9]+$/.test(e.code||'')?e.code:'NETWORK_ERROR'}));req.end();
});
setTimeout(()=>process.exit(124),25000).unref();
Promise.all(names.map(probe)).then(network=>{
const disk=fs.statfsSync('/hosting/noastudio/noa-hub');
const readable=p=>{try{fs.accessSync(p,fs.constants.R_OK);return true;}catch{return false;}};
process.stdout.write(JSON.stringify({node:process.version,platform:process.platform,arch:process.arch,proc:fs.existsSync('/proc/self/exe'),freeBytes:Number(disk.bavail)*Number(disk.bsize),resolverConfigReadable:readable('/etc/resolv.conf'),hostsFileReadable:readable('/etc/hosts'),configuredResolverCount:dns.getServers().length,proxyConfigured:['HTTPS_PROXY','HTTP_PROXY','https_proxy','http_proxy'].some(k=>Boolean(process.env[k])),network,generationRequests:0})+'\n',()=>process.exit(0));
});
'''

def read(sftp, path):
    info=sftp.lstat(path)
    if not stat.S_ISREG(info.st_mode) or info.st_size>1048576:
        raise RuntimeError('host_source_invalid')
    with sftp.open(path,'rb') as stream:
        return stream.read()

def install(transport,sftp,args):
    """Only the checksum-pinned OpenAI binary enters the private N80 directory."""
    with tempfile.TemporaryDirectory(prefix='n80-codex-') as temp:
        archive=Path(temp)/'official.tar.gz';digest=hashlib.sha256();total=0
        with urllib.request.urlopen(ASSET,timeout=30) as response,archive.open('wb') as output:
            started=time.monotonic()
            while chunk:=response.read(1048576):
                total+=len(chunk)
                if total>180000000 or time.monotonic()-started>120:raise RuntimeError('download_limit')
                digest.update(chunk);output.write(chunk)
        if digest.hexdigest()!=ASSET_SHA:raise RuntimeError('official_asset_hash_mismatch')
        compressed=Path(temp)/'codex.gz';digest=hashlib.sha256();total=0
        with tarfile.open(archive,'r:gz') as tar:
            members=[m for m in tar.getmembers() if m.isfile() and m.name.rsplit('/',1)[-1]=='codex-x86_64-unknown-linux-musl']
            if len(members)!=1 or not 1000000<members[0].size<600000000:raise RuntimeError('official_asset_member_invalid')
            with tar.extractfile(members[0]) as stream,gzip.open(compressed,'wb',compresslevel=6) as output:
                while chunk:=stream.read(1048576):digest.update(chunk);total+=len(chunk);output.write(chunk)
        manifest={'version':VERSION,'sha256':digest.hexdigest(),'bytes':total}
        print('N80_CODEX_STAGE official_binary_verified '+json.dumps(manifest),flush=True)
        for path in (ROOT+'/codex',ROOT+'/codex/'+VERSION):
            try:sftp.mkdir(path,0o700)
            except OSError:pass
            if not stat.S_ISDIR(sftp.lstat(path).st_mode) or sftp.normalize(path)!=path:raise RuntimeError('private_directory_invalid')
            sftp.chmod(path,0o700)
        script=Path('runtime/hub/codex-install.mjs').read_bytes()
        remote_script=ROOT+'/codex/install-'+hashlib.sha256(script).hexdigest()[:16]+'.mjs'
        remote_archive=ROOT+'/codex/'+VERSION+'/codex.stage.gz'
        with sftp.open(remote_script,'wx') as stream:stream.write(script)
        sftp.chmod(remote_script,0o600)
        if read(sftp,remote_script)!=script:raise RuntimeError('installer_readback_mismatch')
        try:
            started=time.monotonic();reported=[0]
            def progress(sent,size):
                if time.monotonic()-started>360:raise RuntimeError('transfer_deadline')
                step=int(sent/25000000)
                if step>reported[0]:reported[0]=step;print('N80_CODEX_STAGE transfer_bytes '+str(sent),flush=True)
            with compressed.open('rb') as source,sftp.open(remote_archive,'wx') as target:
                target.set_pipelined(True);sent=0
                while chunk:=source.read(1048576):target.write(chunk);sent+=len(chunk);progress(sent,compressed.stat().st_size)
            sftp.chmod(remote_archive,0o600)
            print('N80_CODEX_STAGE host_verification',flush=True)
            channel=transport.open_session(timeout=20);channel.settimeout(160)
            channel.exec_command(shlex.join(args+[remote_script,json.dumps(manifest,separators=(',',':'))]))
            output=channel.makefile('r').read(16384);errors=channel.makefile_stderr('r').read(2048)
            code=channel.recv_exit_status();channel.close()
            if code!=0:raise RuntimeError('codex_install_exit_'+str(code))
            result=json.loads(output)
            Path('codex-proof/codex-install.json').write_text(json.dumps(result,indent=2)+'\n')
            print('N80_CODEX_INSTALL '+json.dumps(result),flush=True)
        finally:
            for path in (remote_archive,remote_script):
                try:sftp.remove(path)
                except FileNotFoundError:pass

def doctor(transport,sftp,args):
    script=r'''
const fs=require('node:fs'),{spawnSync}=require('node:child_process');
const root='/hosting/noastudio/noa-hub/codex',file=root+'/status.json';
const s=JSON.parse(fs.readFileSync(file,'utf8'));
if(!s.nativeVersion||s.version!=='0.167.1')throw new Error('codex_not_verified');
const allowed=new Set(['PATH','HOME','LANG','LC_ALL','TMPDIR','SSL_CERT_FILE','SSL_CERT_DIR']);
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>allowed.has(k)));
const run=args=>{const r=spawnSync(root+'/0.167.1/codex',['--no-daemon',...args],{env,timeout:20000,maxBuffer:262144,encoding:'utf8'});return {code:r.status,signal:r.signal,error:r.error?.code||null,text:(r.stdout||'')+(r.stderr||'')};};
const auth=run(['-c','forced_login_method="chatgpt"','login','status']);
const feature=run(['features','list']);
const featureNames=feature.text.split('\n').filter(x=>/^\w+\s+(?:stable|experimental|under development|removed|deprecated)\s/.test(x)).map(x=>x.split(/\s+/)[0]);
s.loginState=auth.code===0&&/logged in using chatgpt/i.test(auth.text)?'chatgpt':/not logged in/i.test(auth.text)?'login_required':'unconfirmed';
s.disabledFeaturesAvailable=['shell_tool','apps','plugins','hooks','memories','browser_use','computer_use','fast_mode','ultrafast_mode'].filter(k=>featureNames.includes(k));
s.featureCommandExitCode=feature.code;s.authCommandExitCode=auth.code;s.noDaemon=true;
fs.writeFileSync(file+'.tmp',JSON.stringify(s),{mode:0o600});fs.renameSync(file+'.tmp',file);
const redact=t=>t.replace(/sk-[a-zA-Z0-9_-]+/g,'[REDACTED]').replace(/[A-Za-z0-9_-]{80,}/g,'[REDACTED]').replace(/\S+@\S+/g,'[REDACTED]').slice(0,4096);
console.log(JSON.stringify({receipt:s,featureNames,diagnostic:feature.code!==0?redact(feature.text):null,authDiagnostic:s.loginState==='unconfirmed'?redact(auth.text):null,homeAvailable:Boolean(process.env.HOME)}));
'''
    channel=transport.open_session(timeout=20);channel.settimeout(60)
    channel.exec_command(shlex.join(args+['-e',script]))
    out=channel.makefile('r').read(32768);errors=channel.makefile_stderr('r').read(1024)
    code=channel.recv_exit_status();channel.close()
    if code!=0:raise RuntimeError('codex_doctor_failed_'+str(code))
    result=json.loads(out)
    Path('codex-proof/codex-doctor.json').write_text(json.dumps(result,indent=2)+'\n')
    print('N80_CODEX_DOCTOR '+json.dumps(result),flush=True)
    return result['receipt']['loginState']

def login(transport,sftp,args):
    script=Path('runtime/hub/codex-login.mjs').read_bytes()
    remote=ROOT+'/codex/login-'+hashlib.sha256(script).hexdigest()[:16]+'.mjs'
    with sftp.open(remote,'wx') as f:f.write(script)
    sftp.chmod(remote,0o600)
    if read(sftp,remote)!=script:raise RuntimeError('login_helper_readback_mismatch')
    public_key=Path('config/n80-codex-device-public.pem').read_text()
    channel=transport.open_session(timeout=20);channel.settimeout(50)
    channel.exec_command(shlex.join(args+[remote,'start',public_key]))
    out=channel.makefile('r').read(16384);errors=channel.makefile_stderr('r').read(1024)
    code=channel.recv_exit_status();channel.close()
    if code!=0:raise RuntimeError('codex_login_start_failed_'+str(code))
    result=json.loads(out)
    Path('codex-proof/device-challenge-encrypted.json').write_text(json.dumps(result,indent=2)+'\n')
    print('N80_CODEX_LOGIN '+json.dumps(result),flush=True)

def main():
    transport=connect()
    try:
        with paramiko.SFTPClient.from_transport(transport) as sftp:
            sftp.get_channel().settimeout(30)
            before=read(sftp,ROOT+'/control.json')
            control=json.loads(before)
            if control.get('stop') or control.get('paused'):
                raise RuntimeError('host_intentionally_paused')
            args=json.loads(read(sftp,ROOT+'/node-command.json'))
            if not isinstance(args,list) or not 1<=len(args)<=4 or any(not isinstance(a,str) or (a!='--library-path' and not re.fullmatch(r'/hosting/noastudio/noa-ai-lab/host-runtime/(?:node-[a-f0-9]{16}|lib-[a-f0-9]{16}(?:/ld-linux-x86-64[.]so[.]2)?)',a)) for a in args):
                raise RuntimeError('host_node_command_invalid')
            channel=transport.open_session(timeout=20)
            channel.settimeout(40)
            channel.exec_command(shlex.join(args+['-e',PROBE]))
            output=channel.makefile('r').read(16384)
            error=channel.makefile_stderr('r').read(1024)
            code=channel.recv_exit_status();channel.close()
            if code!=0:
                raise RuntimeError('host_probe_failed_exit_'+str(code))
            result=json.loads(output)
            if read(sftp,ROOT+'/control.json')!=before:
                raise RuntimeError('host_control_changed')
            status=json.loads(read(sftp,ROOT+'/status.json'))
            result.update({'verifiedAt':int(time.time()),'heartbeatAgeSeconds':int(time.time())-status.get('heartbeatAt',0),'hostControlUnchanged':True,'newSchedulers':0,'filesChanged':0})
            Path('codex-proof').mkdir(exist_ok=True)
            Path('codex-proof/host-prerequisites.json').write_text(json.dumps(result,indent=2)+'\n')
            print('N80_CODEX_HOST '+json.dumps(result),flush=True)
            if os.environ.get('N80_CODEX_INSTALL')=='1':
                install(transport,sftp,args)
                if read(sftp,ROOT+'/control.json')!=before:raise RuntimeError('host_control_changed_during_install')
            if os.environ.get('N80_CODEX_DOCTOR')=='1':
                state=doctor(transport,sftp,args)
                if state=='login_required' and os.environ.get('N80_CODEX_LOGIN')=='1':login(transport,sftp,args)
    finally:
        transport.close()

if __name__=='__main__':
    main()
