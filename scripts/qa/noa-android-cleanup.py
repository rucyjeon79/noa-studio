"""Recover only exact Android QA helpers whose runner was lost after cleanup timeout."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import hashlib,json,re,secrets,stat,time,urllib.request
import paramiko
from noa_full_inventory import connect,ROOT

def sha(data):return hashlib.sha256(data).hexdigest()
template=Path('scripts/noa_member_qa_control.php').read_text()
t=connect();s=paramiko.SFTPClient.from_transport(t);s.get_channel().settimeout(45)
try:
    if s.normalize(ROOT)!=ROOT:raise RuntimeError('Unexpected root')
    count=0
    for entry in s.listdir_attr(ROOT+'/noa-bridge'):
        match=re.fullmatch(r'member-qa-([a-f0-9]{12})\.php',entry.filename)
        if not match or not stat.S_ISREG(entry.st_mode):continue
        nonce=match[1];path=ROOT+'/noa-bridge/'+entry.filename
        with s.open(path,'rb') as f:raw=f.read(20000)
        text=raw.decode();expiry=re.search(r'time\(\)>([0-9]{10})',text);tokenhash=re.search(r"hash_equals\('([a-f0-9]{64})'",text)
        if not expiry or not tokenhash:continue
        values={'__QA_EXPIRY__':expiry[1],'__QA_TOKEN_HASH__':tokenhash[1],'__QA_ID_A__':'nqa'+nonce+'a','__QA_ID_B__':'nqa'+nonce+'b','__QA_NONCE__':nonce,'__QA_AUDIO_SHA__':'0'*64}
        expected=template
        for key,value in values.items():expected=expected.replace(key,value)
        if text!=expected:continue
        # Keep the same narrowly scoped helper, refresh only its private access token/expiry.
        token=secrets.token_hex(32);print('::add-mask::'+token)
        replacement=text.replace(tokenhash[1],sha(token.encode())).replace('time()>'+expiry[1],'time()>'+str(int(time.time())+600)).encode()
        temp=path+'.cleanup-'+secrets.token_hex(6)
        with s.open(temp,'wx') as f:f.write(replacement)
        s.chmod(temp,0o644)
        with s.open(temp,'rb') as f:
            if sha(f.read())!=sha(replacement):raise RuntimeError('Cleanup helper upload mismatch')
        with s.open(path,'rb') as f:
            if sha(f.read())!=sha(raw):raise RuntimeError('QA helper changed; preserved')
        s.posix_rename(temp,path)
        for attempt in range(3):
            try:
                req=urllib.request.Request('https://noastudio.ai.kr/noa-bridge/'+entry.filename,data=json.dumps({'action':'cleanup','owner':0}).encode(),headers={'X-NOA-QA':token,'Content-Type':'application/json'})
                with urllib.request.urlopen(req,timeout=90) as response:result=json.load(response)
                if not result.get('ok'):raise RuntimeError('Scoped account cleanup rejected')
                break
            except (TimeoutError,urllib.error.URLError):
                if attempt==2:raise
        with s.open(path,'rb') as f:
            if sha(f.read())!=sha(replacement):raise RuntimeError('Cleanup target changed; preserved')
        s.remove(path);count+=1
    print('ANDROID_QA_RECOVERY_CLEANED='+str(count))
finally:s.close();t.close()
