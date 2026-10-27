"""Verify real logout using one marked disposable member and always clean it."""
import hashlib,json,os,secrets,subprocess,time,urllib.request
from pathlib import Path
import paramiko
from noa_full_inventory import connect,ROOT
def sha(data):return hashlib.sha256(data).hexdigest()
def main():
    out=Path('logout-proof');out.mkdir(exist_ok=True)
    nonce=secrets.token_hex(6);token=secrets.token_hex(32);password=secrets.token_urlsafe(36);member='nqa'+nonce+'a'
    print('::add-mask::'+token);print('::add-mask::'+password)
    code=Path('scripts/noa_member_qa_control.php').read_text()
    for key,value in {'__QA_EXPIRY__':str(int(time.time())+900),'__QA_TOKEN_HASH__':sha(token.encode()),'__QA_ID_A__':member,'__QA_ID_B__':'nqa'+nonce+'b','__QA_NONCE__':nonce,'__QA_AUDIO_SHA__':'0'*64}.items():code=code.replace(key,value)
    data=code.encode();helper='noa-bridge/logout-qa-'+nonce+'.php'
    credentials=Path(os.environ['RUNNER_TEMP'])/'noa-logout-credentials.json'
    def control(action,**values):
        request=urllib.request.Request('https://noastudio.ai.kr/'+helper,data=json.dumps({'action':action,'owner':0,**values}).encode(),headers={'Content-Type':'application/json','X-NOA-QA':token})
        with urllib.request.urlopen(request,timeout=30)as response:result=json.load(response)
        if not result.get('ok'):raise RuntimeError('logout_qa_'+action+'_failed')
        return result
    t=connect();installed=False
    try:
        with paramiko.SFTPClient.from_transport(t)as s:
            s.get_channel().settimeout(30)
            with s.open(ROOT+'/'+helper,'wx')as stream:stream.write(data)
            installed=True;s.chmod(ROOT+'/'+helper,0o644)
            with s.open(ROOT+'/'+helper,'rb')as stream:
                if sha(stream.read())!=sha(data):raise RuntimeError('QA helper mismatch')
        control('setup',password=password);control('level',level=3)
        credentials.touch(mode=0o600);credentials.write_text(json.dumps({'member':member,'password':password}))
        subprocess.run(['node',os.environ['NOA_LOGOUT_BROWSER']],env={**os.environ,'NOA_LOGOUT_CREDENTIALS':str(credentials)},check=True)
    finally:
        try:
            if installed:
                result=control('cleanup')
                with paramiko.SFTPClient.from_transport(t)as s:
                    s.get_channel().settimeout(30)
                    with s.open(ROOT+'/'+helper,'rb')as stream:
                        if sha(stream.read())!=sha(data):raise RuntimeError('Changed QA helper preserved')
                    s.remove(ROOT+'/'+helper)
                proof={'ok':True,'account':result,'helperRemoved':True,'existingMembersChanged':0,'existingSongsChanged':0}
                (out/'cleanup.json').write_text(json.dumps(proof));print('NOA_LOGOUT_CLEANUP',json.dumps(proof))
        finally:
            credentials.unlink(missing_ok=True);t.close()
if __name__=='__main__':main()
