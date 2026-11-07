import os
import re
import urllib.request
from html.parser import HTMLParser
from pathlib import Path
import noa_ainoa_deploy as release

release.FILES={'extend/noa.design.php':'deploy/noa-design.extend.php','noa-app/home.php':'deploy/noa-app/home.php'}
release.NEW=set()
home_link_only = os.environ.get('NOA_HOME_LINK_ONLY') == 'true'
if home_link_only:
    release.FILES = {'noa-app/home.php': 'deploy/noa-app/home.php'}

def verify_home_link():
    expected = re.search(r"'amt'=>\['([^']+)'", Path('deploy/noa-app/home.php').read_text()).group(1)
    class BannerParser(HTMLParser):
        def __init__(self):
            super().__init__()
            self.links = []
        def handle_starttag(self, tag, attrs):
            attrs = dict(attrs)
            if tag == 'a' and attrs.get('data-home-banner') == 'amt':
                self.links.append(attrs.get('href'))
    parser = BannerParser()
    request = urllib.request.Request(
        'https://noastudio.ai.kr/?audit=' + os.environ['GITHUB_SHA'][:12],
        headers={'Cache-Control': 'no-cache'})
    with urllib.request.urlopen(request, timeout=30) as response:
        parser.feed(response.read().decode('utf-8'))
    if parser.links != [expected]:
        raise RuntimeError('home_amt_link_not_activated')
    print('HOME_AMT_LINK_VERIFIED', expected)

if __name__=='__main__':
    release.main()
    if home_link_only:
        verify_home_link()
