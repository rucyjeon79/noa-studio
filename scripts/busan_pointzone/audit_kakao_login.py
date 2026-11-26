"""Read-only Kakao WebView login diagnosis; no real credentials or session impersonation."""
import hmac,json,re,http.cookiejar
from html.parser import HTMLParser
from urllib.parse import urlsplit,urljoin,parse_qs
from urllib.request import Request,build_opener,HTTPCookieProcessor
from urllib.error import HTTPError
import release_submenu_fix as remote
ORIGIN='https://skhnslu-busan.com'
UA={'chrome':'Mozilla/5.0 (Linux; Android 15; SM-S938N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36','kakao':'Mozilla/5.0 (Linux; Android 15; SM-S938N Build/AP3A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.0.0 Mobile Safari/537.36 KAKAOTALK/26.10.0'}
class Forms(HTMLParser):
    def __init__(self):super().__init__();self.forms=[];self.current=None
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=='form':self.current={'id':a.get('id',''),'name':a.get('name',''),'action':a.get('action',''),'method':a.get('method',''),'fields':[]};self.forms.append(self.current)
        if tag=='input' and self.current is not None:self.current['fields'].append({'name':a.get('name',''),'type':a.get('type','text')})
    def handle_endtag(self,tag):
        if tag=='form':self.current=None
def audit(s):
    paths=('common.php','config.php','bbs/login.php','bbs/login_check.php','lib/common.lib.php','theme/UXC_Flarumix/head.sub.php','theme/UXC_Flarumix/head.php','theme/UXC_Flarumix/tail.php')
    patterns=re.compile(r'kakao|webview|in.?app|session_set_cookie_params|session_start|session_name|session.cookie|session_regenerate_id|G5_COOKIE_DOMAIN|G5_HTTPS_DOMAIN|G5_DOMAIN|G5_SESSION_PATH|ss_mb_id|ss_mb_key|set_session\(|get_session\(|set_cookie\(|HTTP_USER_AGENT|HTTP_REFERER|check_url_host|login_check\.php|SameSite|samesite|is_secure|cookie_secure',re.I)
    for path in paths:
        b=remote.read(s,remote.ROOT+'/'+path,800000)
        if not b:continue
        lines=b.decode('utf-8','replace').splitlines()
        hits=[]
        for i,line in enumerate(lines,1):
            if patterns.search(line) and not re.search(r'password|passwd|secret|token|api.?key|authorization|private.?key',line,re.I):
                hits.append([i,line.strip()[:260]])
        print('BUSAN_KAKAO_AUTH_SOURCE',json.dumps({'path':path,'sha':remote.blob(b),'hits':hits[:85]},ensure_ascii=False),flush=True)
    for dirname in ('/extend','/theme/UXC_Flarumix/extend'):
        try:items=s.listdir_attr(remote.ROOT+dirname)
        except OSError:continue
        for f in items:
            if not f.filename.endswith('.php') or f.st_size>250000:continue
            b=remote.read(s,remote.ROOT+dirname+'/'+f.filename,250000)
            if not b:continue
            hits=[]
            for i,line in enumerate(b.decode('utf-8','replace').splitlines(),1):
                if patterns.search(line) and not re.search(r'password|passwd|secret|token|api.?key|authorization|private.?key',line,re.I):hits.append([i,line.strip()[:260]])
            if hits:print('BUSAN_KAKAO_AUTH_EXTEND',json.dumps({'path':dirname+'/'+f.filename,'sha':remote.blob(b),'hits':hits[:45]},ensure_ascii=False),flush=True)
    for label,ua in UA.items():
        jar=http.cookiejar.CookieJar();opener=build_opener(HTTPCookieProcessor(jar))
        for path in ('/theme/Busan_PointZone/honor.php','/bbs/login.php?url=%2Ftheme%2FBusan_PointZone%2Fhonor.php'):
            try:
                with opener.open(Request(ORIGIN+path,headers={'User-Agent':ua,'Referer':'https://talk.kakao.com/','Cache-Control':'no-cache'}),timeout=20) as r:
                    body=r.read(500000).decode('utf-8','replace');forms=Forms();forms.feed(body)
                    cookies=[{'name':c.name,'domain':c.domain,'path':c.path,'secure':c.secure,'samesite':c.get_nonstandard_attr('SameSite'),'httponly':c.has_nonstandard_attr('HttpOnly')} for c in jar]
                    p=urlsplit(r.url)
                    fs=[]
                    for f in forms.forms:
                        if any(x['name'] in ('mb_id','mb_password') for x in f['fields']):
                            a=urlsplit(urljoin(r.url,f['action']));fs.append({'id':f['id'],'method':f['method'],'action_host':a.hostname,'action_path':a.path,'fields':f['fields']})
                    print('BUSAN_KAKAO_HTTP',json.dumps({'client':label,'request':path,'status':r.status,'host':p.hostname,'path':p.path,'cookies':cookies,'login_forms':fs,'login_prompt':'로그인' in body,'redirect_script':bool(re.search(r'location\.(?:href|replace)',body))},ensure_ascii=False),flush=True)
            except HTTPError as e:print('BUSAN_KAKAO_HTTP_ERROR',label,path,e.code,flush=True)
    print('BUSAN_KAKAO_AUTH_AUDIT_OK',{'credentials_submitted':0,'production_changes':0,'actual_webview':'not_tested'},flush=True)
if __name__=='__main__':
    host,user,password,pin=remote.configuration(remote.os.environ)
    with remote.socket.create_connection((host,remote.PORT),timeout=15) as sock,remote.paramiko.Transport(sock) as t:
        t.get_security_options().key_types=('ssh-ed25519',);t.start_client(timeout=20)
        if not hmac.compare_digest(remote.fingerprint(t.get_remote_server_key()),pin):raise RuntimeError('host identity mismatch')
        t.auth_password(user,password,fallback=False)
        with remote.paramiko.SFTPClient.from_transport(t) as s:
            s.get_channel().settimeout(35);audit(s)
