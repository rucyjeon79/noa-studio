"""Read-only diagnostics of real menu renderers; do not expose member or session data."""
import hmac,re,json
from urllib.request import Request,urlopen
import release_submenu_fix as remote
from html.parser import HTMLParser
class Links(HTMLParser):
    def __init__(self):super().__init__();self.links=[];self.current=None
    def handle_starttag(self,tag,attrs):
        if tag=='a':self.current=[dict(attrs).get('href',''),'']
    def handle_data(self,data):
        if self.current:self.current[1]+=data
    def handle_endtag(self,tag):
        if tag=='a' and self.current:
            href,label=self.current
            if any(x in href for x in ('honor.php','pointzone.php')) or any(x in label.casefold() for x in ('we run together','인사이트','명예의 전당','point zone')):self.links.append([href.split('?')[0],label.strip()[:80]])
            self.current=None
def audit(s):
    root=remote.ROOT+'/theme/UXC_Flarumix'
    remote.directory(s,root)
    count=0
    for folder in ('','/mobile','/lib','/skin','/include','/inc','/layout','/js','/extend'):
        p=root+folder
        try:remote.directory(s,p);items=s.listdir_attr(p)
        except FileNotFoundError:continue
        for f in items:
            if not f.filename.endswith(('.php','.js')):continue
            rel=folder+'/'+f.filename
            data=remote.read(s,root+rel,1500000)
            if not data:continue
            body=data.decode('utf-8','replace')
            hits=[]
            for i,line in enumerate(body.splitlines(),1):
                if re.search(r'get_menu_db|menu_table|me_order|me_code|menu_cache|We Run Together|OpenAI 인사이트|명예의 전당|POINT ZONE|menu_list_update|menuData|menu_data|sidebar_menu|gnb_menu',line,re.I):
                    # Output only matched navigation expressions from source files, not config or account values.
                    hits.append([i,line.strip()[:230]])
            if hits:print('BUSAN_NAV_SOURCE',json.dumps({'path':rel,'sha':remote.blob(data),'hits':hits[:40]},ensure_ascii=False),flush=True)
            count+=1
    for path in ('','?device=pc','?device=mobile'):
        req=Request('https://skhnslu-busan.com/'+path,headers={'User-Agent':'Busan-navigation-audit/1.0','Cache-Control':'no-cache'})
        with urlopen(req,timeout=15) as r:
            p=Links();p.feed(r.read(1500000).decode('utf-8','replace'))
            print('BUSAN_NAV_RENDER',json.dumps({'route':path or '/','status':r.status,'links':p.links[:40]},ensure_ascii=False),flush=True)
    print('BUSAN_NAV_AUDIT_OK',count,flush=True)
if __name__=='__main__':
    host,user,password,pin=remote.configuration(remote.os.environ)
    with remote.socket.create_connection((host,remote.PORT),timeout=15) as sock,remote.paramiko.Transport(sock) as t:
        t.get_security_options().key_types=('ssh-ed25519',);t.start_client(timeout=20)
        if not hmac.compare_digest(remote.fingerprint(t.get_remote_server_key()),pin):raise RuntimeError('host identity mismatch')
        t.auth_password(user,password,fallback=False)
        with remote.paramiko.SFTPClient.from_transport(t) as s:
            s.get_channel().settimeout(35);audit(s)
