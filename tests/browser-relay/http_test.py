import http.cookiejar
import json
import re
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path
from fixture import create
with tempfile.TemporaryDirectory(prefix='n80-browser-http-') as root:
    html=create(root)
    with socket.socket() as s:
        s.bind(('127.0.0.1',0)); port=s.getsockname()[1]
    server=subprocess.Popen(['php','-S',f'127.0.0.1:{port}','-t',str(html)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    cookies=http.cookiejar.CookieJar(); opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookies))
    def request(api=False,role='admin',body=None,csrf='',origin='https://noastudio.ai.kr'):
        cookies.set_cookie(http.cookiejar.Cookie(0,'qa_role',role,None,False,'127.0.0.1',False,False,'/',True,False,None,True,None,None,{}))
        req=urllib.request.Request(f'http://127.0.0.1:{port}/noa-browser-connect.php'+('?api=1' if api else ''),data=json.dumps(body).encode() if body is not None else None,headers={'Origin':origin,'Content-Type':'application/json','X-NOA-CSRF':csrf})
        try:r=opener.open(req,timeout=3)
        except urllib.error.HTTPError as e:r=e
        return r.status,r.headers,r.read().decode()
    try:
        for _ in range(50):
            try:code,headers,body=request();break
            except urllib.error.URLError:time.sleep(.05)
        else:raise AssertionError('server_not_ready')
        assert code==200 and 'Gemini·Flow 연결' in body
        assert headers['Cache-Control']=='private, no-store' and headers['X-Frame-Options']=='SAMEORIGIN'
        csrf=re.search('data-csrf="([a-f0-9]+)"',body).group(1)
        before=(Path(root)/'noa-ai-lab/state.json').read_bytes()
        for role in ('guest','member'):
            assert request(role=role)[0]==403
            assert request(api=True,role=role)[0]==403
        for token,origin in [('bad','https://noastudio.ai.kr'),(csrf,'https://other.test')]:
            assert request(api=True,body={'command':'open'},csrf=token,origin=origin)[0]==403
        assert (Path(root)/'noa-ai-lab/state.json').read_bytes()==before
        code,headers,body=request(api=True,body={'command':'open'},csrf=csrf)
        assert code==200 and json.loads(body)['state']=='queued',body
        public=json.loads(request(api=True)[2]);assert 'lease' not in public and 'input' not in public
        assert public['csrf']==csrf
        wake=Path(root)/'wake-count'; assert wake.exists()
        count=wake.read_bytes()
        for command in ('open','retry'):
            assert request(api=True,body={'command':command,'id':public['id']},csrf=csrf)[0]==200
        assert wake.read_bytes()==count,'duplicate wake'
        state_path=Path(root)/'noa-ai-lab/state.json'; state=json.loads(state_path.read_text()); state['browserControl']['retryAt']=int(time.time())-1;state_path.write_text(json.dumps(state))
        assert json.loads(request(api=True)[2])['retryAllowed']
        assert wake.read_bytes()==count,'GET woke worker'
        for token,origin in [('bad','https://noastudio.ai.kr'),(csrf,'https://other.test')]:
            assert request(api=True,body={'command':'retry','id':public['id']},csrf=token,origin=origin)[0]==403
        assert wake.read_bytes()==count
        assert request(api=True,body={'command':'retry','id':public['id']},csrf=csrf)[0]==200
        assert len(wake.read_bytes())==2*len(count),'retry wake missing'
        # Rotate only the disposable administrator HTTP session; connection ownership stays the same.
        cookies.clear()
        assert request(api=True,body={'command':'retry','id':public['id']},csrf=csrf)[0]==403
        renewed=json.loads(request(api=True)[2]);assert renewed['csrf']!=csrf and renewed['id']==public['id']
        csrf=renewed['csrf']
        # Exercise the real public HTTP input boundary after an isolated worker provides a frame.
        subprocess.run(['php','-r',"define('_GNUBOARD_',true);define('G5_PATH',$argv[1]);require G5_PATH.'/noa-bridge/lab-core.php';require G5_PATH.'/noa-bridge/browser-control.php';lab_lock(function(&$s){$c=nb_worker($s,['command'=>'claim'],time());nb_worker($s,['command'=>'exchange','id'=>$c['id'],'lease'=>$c['lease'],'ack'=>0,'frame'=>['url'=>'https://accounts.google.com/','image'=>'data:image/jpeg;base64,ZmFrZQ==']],time());});",str(html)],check=True)
        frame=json.loads(request(api=True)[2]);assert frame['inputReady']
        click={'command':'input','id':frame['id'],'frameSeq':frame['frameSeq'],'event':{'kind':'click','x':1200,'y':32}}
        assert request(api=True,body=click,csrf=csrf)[0]==200
        assert not json.loads(request(api=True)[2])['inputReady']
        assert request(api=True,body=click,csrf=csrf)[0]==409
        assert request(api=True,body={'command':'close','id':public['id']},csrf=csrf)[0]==200
        print('N80_BROWSER_HTTP_OK admin-only origin CSRF session-renewal real-HTTP-input no-store single-session')
    finally:
        server.terminate();server.wait(timeout=5)
