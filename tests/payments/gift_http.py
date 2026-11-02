"""Exercise the real gift page with two authenticated users in isolated MySQL."""
from html.parser import HTMLParser
import http.cookiejar
from pathlib import Path
import shutil
import subprocess
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import build_opener, HTTPCookieProcessor, Request

# The MY account boxes rely on the gift stylesheet being linked by the page itself.
class Stylesheets(HTMLParser):
    def __init__(self):
        super().__init__()
        self.paths = []
    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == 'link' and values.get('rel') == 'stylesheet':
            self.paths.append(values.get('href', '').split('?')[0])

head = Stylesheets()
head.feed(Path('deploy/noa-my.php').read_text().split('</head>')[0])
assert '/noa-gifts.css' in head.paths, 'MY must request the stylesheet for account actions'

site = Path('/tmp/noa-toss-http/site')
assert (site / 'common.php').exists()
for name in ('special-invite.php','gift-core.php', 'vip-store-core.php', 'toss-core.php'):
    shutil.copyfile('bridge/' + name, site / 'noa-bridge' / name)
shutil.copyfile('deploy/noa-special-invite.php', site / 'noa-special-invite.php')
shutil.copyfile('deploy/noa-gifts.css',site/'noa-gifts.css')
shutil.copyfile('deploy/noa-gifts.php', site / 'noa-gifts.php')
base = 'http://127.0.0.1:18090'
server = subprocess.Popen(['php', '-S', '127.0.0.1:18090', '-t', str(site)],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

class Fields(HTMLParser):
    def __init__(self):
        super().__init__()
        self.data = {}
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'input' and a.get('type') == 'hidden':
            self.data[a['name']] = a['value']

def fetch(client, user, query, data=None):
    opener, jar = client
    cookies = ['qa_toss_user=' + user] + [c.name+'='+c.value for c in jar]
    request = Request(base+'/noa-gifts.php?'+query, data=urlencode(data).encode() if data else None,
                      headers={'Cookie':'; '.join(cookies),'Origin':base})
    try:
        with opener.open(request) as response:
            return response.status, response.read().decode()
    except HTTPError as exc:
        return exc.code, exc.read().decode()

def session():
    jar = http.cookiejar.CookieJar()
    return build_opener(HTTPCookieProcessor(jar)), jar

try:
    sender, receiver = session(), session()
    query = urlencode({'product':'vip30','q':'g_other'})
    for attempt in range(40):
        try:
            code, page = fetch(sender,'g_sender',query)
            break
        except URLError:
            if attempt == 39: raise
            time.sleep(.1)
    assert code == 200 and 'name="recipient" required value="g_other"' in page
    form = Fields()
    form.feed(page)
    form.data['recipient']='g_other'
    assert fetch(sender,'g_sender',query,{**form.data,'csrf':'wrong'})[0] == 403
    assert fetch(sender,'g_sender',query,form.data)[0] == 200
    assert fetch(sender,'g_sender',query,form.data)[0] == 200
    code, page = fetch(receiver,'g_other','box=received')
    assert code == 200 and '지금 사용' in page and '1년 연장' in page
    claim = Fields()
    claim.feed(page)
    assert claim.data['id'] == form.data['id']
    assert fetch(receiver,'g_other','box=received',{**claim.data,'action':'extend'})[0] == 200
    assert fetch(receiver,'g_other','box=received',{**claim.data,'action':'use'})[0] == 200
    code, sent = fetch(sender,'g_sender','box=sent')
    assert code == 200 and '사용 완료' in sent and 'g_other' in sent
    # A messaging preview GET does not claim. The guest explicitly opts in
    # before login. Simulate an identity-provider session rotation on return.
    from urllib.request import HTTPRedirectHandler
    class NoRedirect(HTTPRedirectHandler):
        def redirect_request(self,*args): return None
    def invite_http(user, query, jar, form=None, extra_cookie=''):
        client=build_opener(HTTPCookieProcessor(jar),NoRedirect())
        cookies=['qa_toss_user='+user]+[c.name+'='+c.value for c in jar if c.name!='qa_toss_user']
        if extra_cookie:cookies.append(extra_cookie)
        req=Request(base+'/noa-special-invite.php?'+query,data=urlencode(form).encode() if form else None,
                    headers={'Cookie':'; '.join(cookies),'Origin':base})
        try: result=client.open(req)
        except HTTPError as e:result=e
        return result.code,result.headers,result.read().decode()
    token='e'*64
    guestjar=http.cookiejar.CookieJar()
    status,_,landing=invite_http('','t='+token,guestjar)
    assert status==200 and '초대장 받기' in landing
    accept=Fields();accept.feed(landing)
    status,h,_=invite_http('','t='+token,guestjar,accept.data)
    assert status==303 and h['Location'].startswith('/noa-login.php?') and 'resume' in h['Location']
    assert '__Host-noa_invite='+token in str(h)
    memberjar=http.cookiejar.CookieJar()
    status,_,landing=invite_http('invite_b','resume=1',memberjar,extra_cookie='__Host-noa_invite='+token)
    assert status==200 and 'requestSubmit()' in landing
    claim=Fields();claim.feed(landing)
    status,h,_=invite_http('invite_b','resume=1',memberjar,claim.data,'__Host-noa_invite='+token)
    assert status==303 and 'box=received' in h['Location']
    status,_,_=invite_http('invite_a','t='+token,http.cookiejar.CookieJar())
    assert status==409
    print('GUEST_INVITE_PREVIEW_AUTH_RETURN_AND_PRIVATE_GIFT_OK')
    print('GIFT_HTTP_MEMBER_SEARCH_SEND_RECEIVE_EXTEND_USE_SENT_HISTORY_OK')
finally:
    server.terminate()
    server.wait()
