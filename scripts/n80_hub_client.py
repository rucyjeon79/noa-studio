"""Direct N80 Hub management; standard library only, no GitHub identity or API."""
import argparse, base64, hashlib, hmac, json, os, re, secrets, time, urllib.request
from pathlib import Path

def request(body):
    key_path=Path(os.environ['N80_HUB_KEY_FILE'])
    if key_path.is_symlink() or key_path.stat().st_mode & 0o077:
        raise RuntimeError('private_key_file_required')
    key=key_path.read_bytes().strip()
    if not re.fullmatch(b'[a-f0-9]{64}',key):raise RuntimeError('invalid_key')
    raw=json.dumps(body,separators=(',',':')).encode();ts=str(int(time.time()));nonce=secrets.token_hex(16)
    digest=hmac.new(key,('N80-HUB-1\n'+hashlib.sha256(raw).hexdigest()+'\n'+ts+'\n'+nonce).encode(),hashlib.sha256).hexdigest()
    req=urllib.request.Request('https://noastudio.ai.kr/noa-bridge/hub-admin.php',data=raw,headers={'Content-Type':'application/json','X-N80-Time':ts,'X-N80-Nonce':nonce,'X-N80-Signature':digest})
    with urllib.request.urlopen(req,timeout=150)as r:result=json.load(r)
    if result.get('ok') is not True:raise RuntimeError('hub_operation_failed')
    return result

def package(entries,manifest):
    files=[]
    for entry in entries:
        remote,local=entry.split('=',1)
        if remote not in manifest['files']:raise RuntimeError('preimage_missing')
        data=Path(local).read_bytes();sha=hashlib.sha256(data).hexdigest();before=manifest['files'][remote]
        if before and before['sha256']==sha:continue
        files.append({'path':remote,'beforeSha256':before['sha256'] if before else None,'sha256':sha,'bytes':len(data),'data':base64.b64encode(data).decode()})
    if not files:raise RuntimeError('no_changes')
    return {'action':'release','revision':manifest['revision'],'package':{'version':1,'id':secrets.token_hex(16),'files':files}}

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('action',choices=['status','manifest','prepare','apply','recover']);p.add_argument('files',nargs='*',help='remote=local for prepare, remote paths for manifest');p.add_argument('--manifest');p.add_argument('--package');a=p.parse_args()
    if a.action=='prepare':
        result=package(a.files,json.loads(Path(a.manifest).read_text()))
        # Store once and resend exactly this document if a response is lost.
        Path(a.package).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print('N80_HUB_PACKAGE_PREPARED');return
    if a.action=='apply':result=request(json.loads(Path(a.package).read_text()))
    elif a.action=='manifest':result=request({'action':'manifest','paths':a.files})
    else:result=request({'action':a.action})
    print(json.dumps(result,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
