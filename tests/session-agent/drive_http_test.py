import http.cookiejar
import re
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from drive_fixture import create


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


with tempfile.TemporaryDirectory(prefix='n80-drive-http-') as root:
    html = create(root)
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0)); port = sock.getsockname()[1]
    process = subprocess.Popen(['php', '-S', f'127.0.0.1:{port}', '-t', str(html)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    base = f'http://127.0.0.1:{port}'
    cookies = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(NoRedirect(), urllib.request.HTTPCookieProcessor(cookies))
    path = '/noa-bridge/lab-oauth.php?action=drive'
    def request(url=path, role='admin', data=None, origin=None):
        cookies.set_cookie(http.cookiejar.Cookie(0, 'qa_role', role, None, False, '127.0.0.1', False, False, '/', True, False, None, True, None, None, {}))
        headers = {}
        if origin: headers['Origin'] = origin
        req = urllib.request.Request(base+url, data=None if data is None else urllib.parse.urlencode(data).encode(), headers=headers)
        try: response = opener.open(req, timeout=3)
        except urllib.error.HTTPError as error: response = error
        return response.status, response.headers, response.read().decode()
    try:
        for attempt in range(50):
            try:
                status, headers, body = request(); break
            except urllib.error.URLError: time.sleep(.05)
        else: raise AssertionError('fixture did not start')
        assert status == 200 and 'Google Drive 연결' in body
        assert headers['Cache-Control'] == 'no-store' and headers['Referrer-Policy'] == 'no-referrer', (dict(headers), body[:2000])
        assert headers['X-Frame-Options'] == 'DENY' and 'DUMMY_NOT_REAL_SECRET' not in body
        csrf = re.search(r'name="csrf" value="([a-f0-9]+)"', body).group(1)
        before = (Path(root)/'noa-ai-lab/state.json').read_bytes()
        assert request(role='member')[0] == 403
        assert request(role='guest')[0] == 302
        for origin, value in [('https://noastudio.ai.kr', 'wrong'), ('https://other.test', csrf), (None, csrf)]:
            assert request(data={'csrf': value, 'operation': 'connect'}, origin=origin)[0] == 200
            assert (Path(root)/'noa-ai-lab/state.json').read_bytes() == before
        status, headers, body = request(data={'csrf': csrf, 'operation': 'connect'}, origin='https://noastudio.ai.kr')
        assert status == 302, body
        location = urllib.parse.urlparse(headers['Location']); query = urllib.parse.parse_qs(location.query)
        assert location.netloc == 'accounts.google.com'
        assert query['scope'] == ['https://www.googleapis.com/auth/drive']
        assert query['redirect_uri'] == ['https://noastudio.ai.kr/noa-bridge/lab-oauth.php']
        assert query['code_challenge_method'] == ['S256'] and query['access_type'] == ['offline']
        # Provider cancellation is sanitized and redirected to a clean URL.
        status, headers, body = request('/noa-bridge/lab-oauth.php?state='+query['state'][0]+'&error=access_denied')
        assert status == 302 and headers['Location'] == path
        assert 'Google 연결 승인이 취소' in request()[2]
        assert (Path(root)/'noa-ai-lab/state.json').read_bytes() == before
        # Existing YouTube route still requests only its existing permissions.
        status, headers, body = request('/noa-bridge/lab-oauth.php?action=start')
        assert status == 302 and 'youtube.upload' in headers['Location'] and 'auth%2Fdrive' not in headers['Location']
        print('Drive HTTP: admin gate, CSRF/origin, no secret exposure, clean cancellation, unchanged YouTube route passed; no provider requests.')
    finally:
        process.terminate(); process.wait(timeout=5)
