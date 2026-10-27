"""Create one marked, disposable native-login account and remove only its records."""
import hashlib,json,os,secrets,subprocess,sys,time,urllib.request
from pathlib import Path
import paramiko
from noa_full_inventory import connect,ROOT

root=Path(os.environ['RUNNER_TEMP']);state_path=root/'noa-android-member-state.json';credentials=root/'noa-android-credentials.json'
out=Path('android');out.mkdir(exist_ok=True)
def digest(data):return hashlib.sha256(data).hexdigest()
def control(state,action,**values):
    body=json.dumps({'action':action,'owner':0,**values}).encode()
    request=urllib.request.Request('https://noastudio.ai.kr/'+state['helper'],data=body,headers={'Content-Type':'application/json','X-NOA-QA':state['token'],'User-Agent':'NOA-native-release-QA'})
    with urllib.request.urlopen(request,timeout=30) as r:value=json.load(r)
    if not value.get('ok'):raise RuntimeError('native_qa_'+action+'_failed')
    return value

if sys.argv[1]=='prepare':
    if state_path.exists():raise SystemExit('Existing native QA state preserved')
    nonce=secrets.token_hex(6);token=secrets.token_hex(32);password=secrets.token_urlsafe(36);member='nqa'+nonce+'a'
    print('::add-mask::'+token);print('::add-mask::'+password)
    code=Path('scripts/noa_member_qa_control.php').read_text()
    for key,value in {'__QA_EXPIRY__':str(int(time.time())+1800),'__QA_TOKEN_HASH__':digest(token.encode()),'__QA_ID_A__':member,'__QA_ID_B__':'nqa'+nonce+'b','__QA_NONCE__':nonce,'__QA_AUDIO_SHA__':'0'*64}.items():code=code.replace(key,value)
    data=code.encode();state={'helper':'noa-bridge/native-qa-'+nonce+'.php','token':token,'hash':digest(data),'created':False}
    state_path.touch(mode=0o600);state_path.write_text(json.dumps(state))
    t=connect()
    try:
        with paramiko.SFTPClient.from_transport(t) as s:
            s.get_channel().settimeout(30)
            with s.open(ROOT+'/'+state['helper'],'wx') as f:f.write(data)
            s.chmod(ROOT+'/'+state['helper'],0o644)
            with s.open(ROOT+'/'+state['helper'],'rb') as f:
                if digest(f.read())!=state['hash']:raise RuntimeError('QA helper transfer mismatch')
        control(state,'setup',password=password);state['created']=True;state_path.write_text(json.dumps(state));control(state,'level',level=6)
        credentials.touch(mode=0o600);credentials.write_text(json.dumps({'member':member,'password':password}))
        print('ISOLATED_NATIVE_QA_ACCOUNT_READY')
    finally:t.close()
elif sys.argv[1]=='install':
    serial=subprocess.check_output(['adb','get-serialno'],text=True).strip()
    if not serial.startswith('emulator-'):raise SystemExit('QA credentials require a disposable emulator')
    temporary='/data/local/tmp/noa-qa-credentials.json'
    subprocess.run(['adb','push',str(credentials),temporary],check=True,stdout=subprocess.DEVNULL)
    for command in [['shell','run-as','kr.ai.noastudio','mkdir','-p','files'],['shell','run-as','kr.ai.noastudio','cp',temporary,'files/noa-qa-credentials.json'],['shell','rm',temporary]]:subprocess.run(['adb',*command],check=True,stdout=subprocess.DEVNULL)
elif sys.argv[1]=='cleanup':
    if not state_path.exists():print('NO_NATIVE_QA_ACCOUNT_TO_CLEAN');sys.exit(0)
    state=json.loads(state_path.read_text());result=control(state,'cleanup');t=connect()
    try:
        with paramiko.SFTPClient.from_transport(t) as s:
            s.get_channel().settimeout(30);path=ROOT+'/'+state['helper']
            with s.open(path,'rb') as f:
                if digest(f.read())!=state['hash']:raise RuntimeError('Changed helper preserved')
            s.remove(path)
    finally:t.close()
    credentials.unlink(missing_ok=True);state_path.unlink();(out/'noa-member-cleanup.json').write_text(json.dumps({'ok':True,'account':result,'helperRemoved':True,'existingMembersChanged':0,'existingSongsChanged':0}))
    print('ISOLATED_NATIVE_QA_ACCOUNT_REMOVED')
else:raise SystemExit('Unknown QA action')
