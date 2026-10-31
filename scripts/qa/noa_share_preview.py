"""Check the public metadata and exact JPEG bytes as an unauthenticated preview fetch."""
import hashlib
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request, urlopen

class Metadata(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags = {}

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == 'meta' and 'property' in values:
            self.tags.setdefault(values['property'], []).append(values.get('content'))

for query, variant in [('', 'studio'), ('?invite=' + '0'*48 + '&card=2', 'invite')]:
    parser = Metadata()
    with urlopen(Request('https://noastudio.ai.kr/'+query, headers={'User-Agent':'facebookexternalhit/1.1; kakaotalk-scrap/1.0'}), timeout=40) as page:
        parser.feed(page.read().decode())
    name = 'starlight-'+variant+'-v1.jpg'
    assert parser.tags['og:image'] == ['https://noastudio.ai.kr/noa-assets/'+name]
    assert parser.tags['og:image:width'] == ['1200'] and parser.tags['og:image:height'] == ['630']
    if variant == 'invite': assert '500P' in parser.tags['og:title'][0]
    with urlopen(parser.tags['og:image'][0], timeout=40) as image:
        assert image.headers.get_content_type() == 'image/jpeg'
        assert hashlib.sha256(image.read()).digest() == hashlib.sha256(Path('deploy/noa-assets/share',name).read_bytes()).digest()
    print('VERIFIED_PUBLIC_SHARE_PREVIEW',variant,name)
