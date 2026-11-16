"""Real PHP HTTP boundary: owner plugin only, direct source and deployment receipts."""
import base64, hashlib, json, re, shutil, socket, subprocess, tempfile, time, urllib.error, urllib.request
from pathlib import Path

with tempfile.TemporaryDirectory(prefix='n80-direct-') as tmp:
    base=Path(tmp);web=base/'html';engine=web/'noa-app/engine';bridge=web/'noa-bridge';root=base/'noa-hub'
    engine.mkdir(parents=True);bridge.mkdir();root.mkdir(mode=0o700)
    for name in ('hub.php','hub-release.php','hub-chatgpt.php'):shutil.copy(Path('deploy/noa-app/engine')/name,engine/name)
    for name in ('song-generation.php',):(engine/name).write_text('<?php')
    for name in ('storage.php','sound-core.php','inline-edit.php','generation-rules.php'):(bridge/name).write_text('<?php')
    (web/'common.php').write_text("<?php $config=['cf_admin'=>'fixture-owner'];$is_member=true;$is_admin='super';")
    key='b'*64;worker='c'*64;paired='d'*64
    code=Path('deploy/noa-gpt.php').read_text()
    code=re.sub(r"\$pluginHash = '[a-f0-9]{64}';","$pluginHash = '"+hashlib.sha256(key.encode()).hexdigest()+"';",code)
    (web/'noa-gpt.php').write_text(code)
    state_dir=base/'noa-ai-lab/gpt-action';state_dir.mkdir(parents=True,mode=0o700)
    state={'owner':'fixture-owner','pluginEnabled':True,'workerHash':hashlib.sha256(worker.encode()).hexdigest(),'hash':hashlib.sha256(paired.encode()).hexdigest()}
    def state_save():(state_dir/'state.json').write_text(json.dumps(state))
    state_save()
    (root/'control.json').write_text(json.dumps({'revision':1,'activeOperations':['hub.verify']}))
    with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
    server=subprocess.Popen(['php','-S',f'127.0.0.1:{port}','-t',str(web)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    def call(body,key_value=key,status=200):
        headers={'Content-Type':'application/json'}
        if key_value:headers['X-NOA-Action-Key']=key_value
        req=urllib.request.Request(f'http://127.0.0.1:{port}/noa-gpt.php?op=hub',headers=headers,data=json.dumps(body).encode())
        try:r=urllib.request.urlopen(req)
        except urllib.error.HTTPError as error:r=error
        data=json.load(r);assert r.code==status,(r.code,data,body.get('action'));return data
    try:
        for _ in range(100):
            try:
                with socket.create_connection(('127.0.0.1',port),timeout=.1):break
            except OSError:time.sleep(.03)
        for value,status in [(None,401),(worker,403),(paired,403)]:call({'action':'status'},value,status)
        state['pluginEnabled']=False;state_save();call({'action':'status'},status=401)
        state['pluginEnabled']=True;state['owner']='other';state_save();call({'action':'status'},status=401)
        state['owner']='fixture-owner';state_save()
        initial=call({'action':'status'});assert initial['sourceRevision']==0 and initial['githubRequired'] is False
        for path in ('common.php','../private.php','noa-app/engine/secret.php'):
            call({'action':'read','path':path},status=400)
        (web/'noa-app/linked').symlink_to(base,target_is_directory=True)
        call({'action':'list','directory':'noa-app/linked'},status=400)
        data=b'<?php return ["connection"=>"direct"];'
        row={'path':'noa-app/engine/connection.php','beforeSha256':None,'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data),'data':base64.b64encode(data).decode()}
        package={'version':1,'id':'e'*32,'files':[row]}
        assert call({'action':'manifest','paths':[row['path']]})['files'][row['path']] is None
        receipt=call({'action':'release','revision':0,'package':package});assert receipt['revision']==1
        assert (web/row['path']).read_bytes()==data
        assert call({'action':'release','revision':0,'package':package})['duplicate'] is True
        assert call({'action':'receipt','id':package['id']})['packageSha256']==receipt['packageSha256']
        package['id']='f'*32
        call({'action':'release','revision':0,'package':package},status=409)
        call({'action':'release','revision':1,'package':package},status=409)
        assert (web/row['path']).read_bytes()==data
        read=call({'action':'read','path':row['path']});assert base64.b64decode(read['data'])==data and read['sha256']==row['sha256']
        call({'action':'read','path':row['path'],'offset':1},status=409)
        call({'action':'read','path':row['path'],'sha256':'0'*64},status=409)
        (web/'noa-large.js').write_bytes(b'x'*200000)
        one=call({'action':'read','path':'noa-large.js'});two=call({'action':'read','path':'noa-large.js','offset':one['nextOffset'],'sha256':one['sha256']})
        assert len(base64.b64decode(one['data'])+base64.b64decode(two['data']))==200000 and two['nextOffset'] is None
        assert any(r['path']==row['path'] for r in call({'action':'list','directory':'noa-app/engine'})['entries'])
        package['files'][0]={**row,'beforeSha256':row['sha256'],'data':base64.b64encode(b'<?php function (').decode(),'bytes':16,'sha256':hashlib.sha256(b'<?php function (').hexdigest()}
        call({'action':'release','revision':1,'package':package},status=400)
        assert call({'action':'status'})['sourceRevision']==1
        print('N80_CHATGPT_HTTP_VERIFIED: owner binding, credential isolation, paths, chunks, CAS, idempotency, PHP syntax and host receipts')
    finally:server.terminate();server.wait(timeout=5)
