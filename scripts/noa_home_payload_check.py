"""Read the guest homepage feed twice with the same transfer settings."""
import gzip
import json
import sys
import time
import urllib.request

for sample in range(2):
    request = urllib.request.Request('https://noastudio.ai.kr/noa-bridge/home.php',
                                     headers={'Accept-Encoding': 'gzip', 'Cache-Control': 'no-cache'})
    start = time.monotonic()
    with urllib.request.urlopen(request, timeout=45) as response:
        data = response.read()
        encoding = response.headers.get('Content-Encoding', 'identity')
    decoded = gzip.decompress(data) if encoding == 'gzip' else data
    feed = json.loads(decoded)
    assert feed['ok'] and feed['genreFeatured'] and 'discovery' in feed
    print(f'{encoding=} bytes={len(data)} decoded={len(decoded)} elapsed={time.monotonic()-start:.3f}s', flush=True)
    if sys.argv[-1] == 'after':
        assert encoding == 'gzip' and len(data) < len(decoded)
