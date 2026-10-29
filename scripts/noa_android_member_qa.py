"""Bounded Android live QA account. Never export its session as an artifact."""
import hashlib
import http.cookiejar
import json
import os
from pathlib import Path
import secrets
import stat
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import paramiko
from noa_full_inventory import connect, ROOT

BASE='https://noastudio.ai.kr'
STATE=Path(os.environ.get('RUNNER_TEMP','/tmp'))/'noa-android-qa-state.json'
COOKIE=Path(os.environ.get('RUNNER_TEMP','/tmp'))/'noa-android-qa-cookie.txt'

def private_write(path, data):
    fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
    with os.fdopen(fd,'w') as f: f.write(data)

def request(client,path,data=None,headers=None):
    req=urllib.request.Request(BASE+path,data=data,headers={'Cache-Control':'no-cache',**(headers or {})})
    try:
        with client.open(req,timeout=30) as response:return response.status,response.read()
    except urllib.error.HTTPError as e:return e.code,e.read()

def control(state, action, **values):
    code,body=request(urllib.request.build_opener(),'/'+state['helper'],
        json.dumps({'action':action,'owner':0,**values}).encode(),
        {'X-NOA-QA':state['token'],'Content-Type':'application/json'})
    result=json.loads(body)
    if code!=200 or not result.get('ok'):raise RuntimeError('Android QA control failed: '+action)

def main(action):
    if action=='cleanup' and not STATE.exists():return
    transport=connect();sftp=paramiko.SFTPClient.from_transport(transport);sftp.get_channel().settimeout(30)
    try:
        if sftp.normalize(ROOT)!=ROOT:raise RuntimeError('Unexpected host root')
        if action=='prepare':
            if STATE.exists():raise RuntimeError('Previous QA state requires cleanup')
            nonce=secrets.token_hex(6);token=secrets.token_hex(32);password=secrets.token_urlsafe(36)
            print('::add-mask::'+token);print('::add-mask::'+password)
            state={'token':token,'helper':'noa-bridge/member-qa-'+nonce+'.php','id':'nqa'+nonce+'a','installed':False}
            source=Path('scripts/noa_member_qa_control.php').read_text()
            for key,value in {'__QA_EXPIRY__':str(int(time.time())+7200),'__QA_TOKEN_HASH__':hashlib.sha256(token.encode()).hexdigest(),
                              '__QA_ID_A__':state['id'],'__QA_ID_B__':'nqa'+nonce+'b','__QA_NONCE__':nonce,'__QA_AUDIO_SHA__':'0'*64}.items():source=source.replace(key,value)
            raw=source.encode();state['sha256']=hashlib.sha256(raw).hexdigest()
            private_write(STATE,json.dumps(state))
            with sftp.open(ROOT+'/'+state['helper'],'wx') as f:f.write(raw)
            sftp.chmod(ROOT+'/'+state['helper'],0o644)
            with sftp.open(ROOT+'/'+state['helper'],'rb') as f:
                if hashlib.sha256(f.read()).hexdigest()!=state['sha256']:raise RuntimeError('QA helper hash mismatch')
            state['installed']=True;private_write(STATE,json.dumps(state))
            control(state,'setup',password=password)
            control(state,'level',level=4)
            jar=http.cookiejar.CookieJar();client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
            request(client,'/bbs/login.php')
            request(client,'/bbs/login_check.php',urllib.parse.urlencode({'mb_id':state['id'],'mb_password':password,'url':'/noa-my.php'}).encode(),
                    {'Content-Type':'application/x-www-form-urlencoded','Referer':BASE+'/bbs/login.php'})
            status,body=request(client,'/noa-bridge/catalog.php')
            if status!=200 or not json.loads(body).get('items'):raise RuntimeError('Authenticated live catalog unavailable')
            status,_=request(urllib.request.build_opener(),'/noa-bridge/catalog.php')
            if status!=401:raise RuntimeError('Guest music authorization changed')
            sessions=[c for c in jar if c.name=='PHPSESSID' and c.domain.lstrip('.')=='noastudio.ai.kr']
            if len(sessions)!=1:raise RuntimeError('Missing QA session')
            cookie='PHPSESSID='+sessions[0].value
            print('::add-mask::'+sessions[0].value);print('::add-mask::'+cookie)
            private_write(COOKIE,cookie)
            print('ANDROID_MEMBER_QA_READY: member catalog 200; guest catalog 401')
        elif action=='cleanup':
            state=json.loads(STATE.read_text())
            print('::add-mask::'+state['token'])
            if state['installed']:
                control(state,'cleanup')
                path=ROOT+'/'+state['helper']
                if not stat.S_ISREG(sftp.lstat(path).st_mode):raise RuntimeError('QA cleanup target changed')
                with sftp.open(path,'rb') as f:
                    if hashlib.sha256(f.read()).hexdigest()!=state['sha256']:raise RuntimeError('QA cleanup hash mismatch')
                sftp.remove(path)
            COOKIE.unlink(missing_ok=True);STATE.unlink()
            print('ANDROID_MEMBER_QA_CLEANED')
        else:raise RuntimeError('Unknown QA action')
    finally:sftp.close();transport.close()

if __name__=='__main__':main(sys.argv[1])
