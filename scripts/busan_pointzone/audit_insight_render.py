"""Read-only: locate the synthetic Insight children and their insertion anchor."""
import hmac,re,json,secrets,stat
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.parse import urlsplit,parse_qs
import release_submenu_fix as remote
def audit(s):
    token=secrets.token_hex(32)
    code=Path('scripts/busan_pointzone/register_honor_menu.php').read_text().replace('__TOKEN_HASH__',remote.digest(token.encode())).encode()
    name='insight-render-audit-'+secrets.token_hex(16)+'.php';dest=remote.ROOT+'/busan-assistant/'+name
    try:
        with s.open(dest,'wx') as f:f.write(code)
        s.chmod(dest,0o644)
        req=Request('https://skhnslu-busan.com/busan-assistant/'+name,data=b'{"mode":"snapshot"}',headers={'X-Busan-Pointzone':token,'Content-Type':'application/json'})
        with urlopen(req,timeout=25) as r: result=json.load(r)
        rows=result['rows']
        def safe(x):
            p=urlsplit(x['me_link']);q=parse_qs(p.query)
            return [x['me_code'],x['me_name'],x['me_order'],x['me_use'],x['me_mobile_use'],p.path,q.get('bo_table',[])]
        print('BUSAN_INSIGHT_ALL_ROWS',json.dumps([safe(x) for x in rows],ensure_ascii=False),flush=True)
        for item in sorted(s.listdir_attr(remote.PRIVATE),key=lambda x:x.st_mtime,reverse=True):
            if not re.fullmatch(r'pointzone-honor-menu-[a-f0-9]{64}\.json',item.filename):continue
            old=json.loads(remote.read(s,remote.PRIVATE+'/'+item.filename,100000))
            if not isinstance(old,list) or any(x.get('me_name')=='명예의 전당' and len(x['me_code'])==2 for x in old):continue
            print('BUSAN_INSIGHT_OLD_ROWS',json.dumps([safe(x) for x in old],ensure_ascii=False),flush=True);break
    finally:s.remove(dest)
    pattern=re.compile(r'회사[·ㆍ. ]그룹|노동조합 소식|세계 노동 동향|노동법[·ㆍ.]판례|권리노트|OpenAI 인사이트|busan_news|me_code|me_order|get_menu_db',re.I)
    def walk(p,depth=0):
        if depth>5:return
        try:items=s.listdir_attr(p)
        except OSError:return
        for f in items:
            rel=p+'/'+f.filename
            if stat.S_ISDIR(f.st_mode):
                if f.filename not in ('img','images','fonts','vendor','cache','ckeditor','smarteditor2','data','upload','backup','node_modules','icons','assets'):walk(rel,depth+1)
            elif f.filename.endswith(('.php','.js')) and f.st_size<500000:
                b=remote.read(s,rel,500000)
                if not b:continue
                lines=b.decode('utf-8','replace').splitlines()
                hits=[(i+1,x.strip()[:350]) for i,x in enumerate(lines) if pattern.search(x)]
                if hits:print('BUSAN_INSIGHT_RENDER_SOURCE',json.dumps({'path':rel[len(remote.ROOT):],'sha':remote.blob(b),'hits':hits[:35]},ensure_ascii=False),flush=True)
    for folder in ('/extend','/theme/UXC_Flarumix','/lib'):
        walk(remote.ROOT+folder)
if __name__=='__main__':
    host,user,password,pin=remote.configuration(remote.os.environ)
    with remote.socket.create_connection((host,remote.PORT),timeout=15) as sock,remote.paramiko.Transport(sock) as t:
        t.get_security_options().key_types=('ssh-ed25519',);t.start_client(timeout=20)
        if not hmac.compare_digest(remote.fingerprint(t.get_remote_server_key()),pin):raise RuntimeError('host identity mismatch')
        t.auth_password(user,password,fallback=False)
        with remote.paramiko.SFTPClient.from_transport(t) as s:
            s.get_channel().settimeout(35);audit(s)
