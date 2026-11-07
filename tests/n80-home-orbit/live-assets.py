"""Read-only production verification, including the homepage's content-hashed bundles."""
import hashlib
import os
import sys
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

BASE = 'https://noastudio.ai.kr/'
ROOT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('deploy')
OWNED = ('noa-ui.js', 'noa-starlight.css', 'noa-browse-edit.js',
         'noa-channel-batch.js', 'noa-muvy.js', 'noa-ai-lab.js',
         'noa-creator-ai.js', 'noa-app/jukebox/upload.js')


def fetch(url):
    assert urllib.parse.urlsplit(url).netloc == 'noastudio.ai.kr', 'Unexpected asset host'
    with urllib.request.urlopen(url, timeout=30) as response:
        return response.read(), response.headers


class Assets(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'script' and attrs.get('src'):
            self.urls.append(attrs['src'])
        elif tag == 'link' and attrs.get('rel') == 'stylesheet' and attrs.get('href'):
            self.urls.append(attrs['href'])


revision = urllib.parse.quote(os.environ.get('GITHUB_SHA', 'n80-home-orbit'), safe='')
for name in OWNED:
    body, _ = fetch(BASE + name + '?n80-orbit=' + revision)
    assert body == (ROOT / name).read_bytes(), 'Public source mismatch: ' + name

html, _ = fetch(BASE + '?n80-orbit=' + revision)
assert b'Fatal error' not in html, 'Homepage PHP error'
assets = Assets()
assets.feed(html.decode())
for name in ('noa-ui.js', 'noa-starlight.css'):
    expected = (ROOT / name).read_bytes()
    matched = False
    for url in assets.urls:
        parsed = urllib.parse.urlsplit(url)
        query = urllib.parse.parse_qs(parsed.query)
        files = query.get('files', [''])[0].split(',')
        if parsed.path == '/' + name:
            assert query.get('v') == [hashlib.sha256(expected).hexdigest()], 'Stale asset URL: ' + name
            body, _ = fetch(urllib.parse.urljoin(BASE, url))
            assert body == expected, 'Homepage asset mismatch: ' + name
        elif parsed.path == '/noa-home-assets.php' and name in files:
            body, headers = fetch(urllib.parse.urljoin(BASE, url))
            version = query.get('v', [''])[0]
            assert len(version) == 64 and all(c in '0123456789abcdef' for c in version), 'Missing bundle revision'
            # The bundle endpoint only marks the URL immutable when its version
            # matches every constituent source's current SHA-256 digest.
            assert headers.get('ETag') == '"' + version + '-identity"', 'Stale homepage bundle ETag'
            assert 'immutable' in headers.get('Cache-Control', ''), 'Stale homepage bundle URL'
            part = ('/* ' + name + ' */\n').encode() + expected + b'\n'
            assert part in body, 'Homepage bundle source mismatch: ' + name
        else:
            continue
        matched = True
        print('HOMEPAGE_ASSET_OK', name, flush=True)
    assert matched, 'Homepage does not load ' + name
print('N80_HOME_ORBIT_LIVE_ASSETS_OK')
