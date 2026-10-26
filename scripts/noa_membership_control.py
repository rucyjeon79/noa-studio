"""Expiring same-host control; outputs only hashes/counts, never member rows or keys."""
import hashlib,json,secrets,sys,time,urllib.request,urllib.error,subprocess
from pathlib import Path
import paramiko
from noa_full_inventory import connect,ROOT
def main():
    mode=sys.argv[1] if len(sys.argv)>1 else 'audit'
    if mode not in ['audit','activate','verify','maintain']:raise RuntimeError('invalid_mode')
    token=secrets.token_hex(32);nonce=secrets.token_hex(8);name='membership-control-'+nonce+'.php';remote=ROOT+'/noa-bridge/'+name
    storage=Path('scripts/noa_membership_storage.php').read_text().replace('<?php','',1).replace('declare(strict_types=1);','',1)
    verify=Path('scripts/noa_membership_verify.php').read_text().replace('<?php','',1).replace('declare(strict_types=1);','',1)
    code=Path('scripts/noa_membership_control.php').read_text().replace('/*NOA_STORAGE_FUNCTIONS*/',storage).replace('/*NOA_VERIFY_FUNCTIONS*/',verify).replace('NOA_CONTROL_EXPIRY',str(int(time.time())+600)).replace('NOA_CONTROL_TOKEN_SHA',hashlib.sha256(token.encode()).hexdigest()).encode()
    transport=connect();installed=False
    try:
        with paramiko.SFTPClient.from_transport(transport) as s:
            s.get_channel().settimeout(45)
            try:s.lstat(remote)
            except FileNotFoundError:pass
            else:raise RuntimeError('helper_collision')
            try:
                with s.open(remote,'wx') as f:f.write(code)
                installed=True;s.chmod(remote,0o644)
                with s.open(remote,'rb') as f:
                    if f.read()!=code:raise RuntimeError('helper_readback_mismatch')
                body=json.dumps({'mode':mode,'approvedPolicy':'NOA-20261026-MEMBERSHIP-REWARDS'}).encode()
                req=urllib.request.Request('https://noastudio.ai.kr/noa-bridge/'+name,data=body,headers={'Content-Type':'application/json','X-NOA-Control':token})
                try:
                    with urllib.request.urlopen(req,timeout=120) as r:raw=r.read();status=r.status
                except urllib.error.HTTPError as e:raw=e.read();status=e.code
                try:data=json.loads(raw)
                except ValueError:raise RuntimeError('control_non_json_http_'+str(status)+'_bytes_'+str(len(raw))) from None
                out=Path('membership-proof');out.mkdir(exist_ok=True);(out/(mode+'.json')).write_text(json.dumps(data,ensure_ascii=False,indent=2))
                if not data.get('ok'):raise RuntimeError('membership_control_failed:'+str(data.get('error'))+':'+str(data.get('file',''))+':'+str(data.get('line','')))
                print('MEMBERSHIP_'+mode.upper()+'_VERIFIED',json.dumps(data,ensure_ascii=False))
            finally:
                if installed:
                    with s.open(remote,'rb') as f:current=f.read()
                    if current==code:s.remove(remote)
                    else:raise RuntimeError('changed_helper_preserved')
    finally:transport.close()
    if mode=='audit' and '--verify-if-active' in sys.argv and data.get('membershipActive'):
        subprocess.run([sys.executable,__file__,'verify'],check=True)
if __name__=='__main__':main()
