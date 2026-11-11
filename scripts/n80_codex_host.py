"""Bounded, zero-generation prerequisite check on the existing N80 host."""
import json
from pathlib import Path
import re
import shlex
import stat
import time
import paramiko
from n80_hub_bootstrap import connect

ROOT = '/hosting/noastudio/noa-hub'
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
    finally:
        transport.close()

if __name__=='__main__':
    main()
