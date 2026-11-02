"""Exercise the two trust boundaries and real PHP request handling with an isolated song store."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.request

with tempfile.TemporaryDirectory() as tmp:
    root = Path(tmp) / "web"
    bridge = root / "noa-bridge"
    bridge.mkdir(parents=True)
    shutil.copy("deploy/noa-gpt.php", root)
    (root/"common.php").write_text("""<?php
    $config=['cf_admin'=>'test-owner'];$member=['mb_id'=>'test-owner'];
    $is_member=($_SERVER['HTTP_COOKIE']??'')==='admin=yes';$is_admin=$is_member?'super':'';
    """)
    (bridge/"storage.php").write_text("""<?php
    function noa_bridge_pdo(){static $db;if(!$db){$db=new PDO('sqlite:'.dirname(__DIR__,2).'/test.sqlite');
    $db->exec('CREATE TABLE IF NOT EXISTS noa_request_log(request_id TEXT PRIMARY KEY,doc_key,request_hash,revision)');
    $db->exec('CREATE TABLE IF NOT EXISTS song(title, revision INTEGER)');
    $db->exec("INSERT INTO song SELECT 'Original',1 WHERE NOT EXISTS(SELECT 1 FROM song)");}return $db;}
    """)
    # SQLite has no row lock clause. The production SQL and PDO implementation are unchanged.
    target = root/"noa-gpt.php"
    plugin_key = 'b'*64
    bridge_src = target.read_text()
    import re
    bridge_src = re.sub(r"\$pluginHash = '[a-f0-9]{64}';", "$pluginHash = '"+hashlib.sha256(plugin_key.encode()).hexdigest()+"';", bridge_src)
    shutil.copy("deploy/noa-plugin-records.php",root)
    target.write_text(bridge_src.replace(' WHERE request_id=? FOR UPDATE',' WHERE request_id=?'))
    shutil.copy("bridge/generation-rules.php",bridge)
    (bridge/"taxonomy-store.php").write_text("""<?php
    function nt_effective_rules($db,$genre){return ['common'=>['layout'=>'common-layout'],'genre'=>['style'=>$genre.'-style'],'principleZero'=>[]];}
    """)
    (bridge/"sound-core.php").touch()
    (bridge/"inline-edit.php").write_text("""<?php
    function nie_resolve($db,$q){$r=$db->query('SELECT title,revision FROM song')->fetch();
    return ['writeKey'=>'song:1','fields'=>['title'=>$r['title']],'kind'=>'single','context'=>['genre'=>'your-story'],'payload'=>[],
    'revision'=>(int)$r['revision'],'packageType'=>'original'];}
    function nup_patch($old,$kind,$patch){return $patch;}
    function nup_validate_classification(...$args){}
    function nup_store($db,$key,$kind,$p,$rev,$actor){$q=$db->prepare('UPDATE song SET title=?,revision=revision+1 WHERE revision=?');$q->execute([$p['title'],$rev]);if(!$q->rowCount())throw new DomainException('revision_conflict');return $rev+1;}
    function nup_snapshot(...$args){}
    """)
    with socket.socket() as s:
        s.bind(('127.0.0.1',0))
        port = s.getsockname()[1]
    server = subprocess.Popen(['php','-S',f'127.0.0.1:{port}','-t',str(root)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    def call(op,body=None,admin=False,key=None,status=200):
        headers={'Content-Type':'application/json'}
        if admin: headers.update({'Cookie':'admin=yes','Origin':'https://noastudio.ai.kr','X-NOA-Bridge-Request':'1'})
        if key: headers['X-NOA-Action-Key']=key
        request=urllib.request.Request(f'http://127.0.0.1:{port}/noa-gpt.php?op={op}',headers=headers,data=json.dumps(body).encode() if body is not None else None)
        try: response=urllib.request.urlopen(request)
        except urllib.error.HTTPError as error: response=error
        data=json.load(response)
        assert response.code==status,(op,response.code,data)
        return data
    try:
        for _ in range(100):
            try:
                with socket.create_connection(('127.0.0.1',port),timeout=.1): break
            except OSError: time.sleep(.03)
        call('pair',{},status=403)
        key=call('pair',{},admin=True)['key']
        call('link',{'url':'https://chatgpt.com/g/g-Test'},admin=True)
        task={'selector':{'type':'song','key':'one','source':'music'},'revision':1,'field':'title'}
        call('start',task,admin=True,status=409)
        started=call('start',{**task,'replace':True},admin=True)
        assert not call('progress',{'id':started['id']},admin=True)['saved']
        call('progress',{'id':'wrong'},admin=True,status=409)
        call('read',status=401)
        read=call('read',key=key)
        assert read['song']['title']=='Original' and read['rules']['common']['layout']=='common-layout'
        assert read['rules']['genre']['style']=='your-story-style'
        thumbnail=call('start',{**task,'field':'geminiPrompt'},admin=True)
        assert 'in English' in call('read',key=key)['generationInstructions']
        call('save',{'id':thumbnail['id'],'text':'한글로 작성된 지시문'},key=key,status=409)
        started=call('start',{**task,'replace':True},admin=True)
        result={'id':started['id'],'text':'새 제목'}
        call('save',{**result,'id':'incorrect'},key=key,status=409)
        assert call('save',result,key=key)['revision']==2
        assert call('save',result,key=key)['revision']==2
        assert call('progress',{'id':started['id']},admin=True)['saved']
        call('save',{**result,'text':'다른 제목'},key=key,status=409)
        call('start',{**task,'replace':True},admin=True,status=409)
        call('pair',{},admin=True)
        call('read',key=key,status=401)
        call('health',{},key=plugin_key,status=401)
        call('pluginToggle',{'enabled':True},status=403)
        call('pluginToggle',{'enabled':True},admin=True)
        assert call('health',{},key=plugin_key)['managementConnected']
        call('pluginToggle',{'enabled':False},admin=True)
        call('health',{},key=plugin_key,status=401)
        worker=call('workerPair',{},admin=True)['key']
        one_tap={**task,'worker':True,'revision':2,'replace':True}
        call('start',one_tap,admin=True,status=503)
        call('workerPoll',{},key=worker)
        queued=call('start',one_tap,admin=True)
        assert call('workerPoll',{},key=worker)['id']==queued['id']
        assert 'id' not in call('workerPoll',{},key=worker)
        assert call('read',key=worker)['id']==queued['id']
        assert call('save',{'id':queued['id'],'text':'실행기 결과'},key=worker)['saved']
        assert call('progress',{'id':queued['id']},admin=True)['saved']
        call('workerDisable',{},admin=True)
        call('workerPoll',{},key=worker,status=401)
        print('PASS: authenticated single-field save, overwrite consent, stale revision, idempotent retry and key revocation')
    finally:
        server.terminate()
        server.wait()
