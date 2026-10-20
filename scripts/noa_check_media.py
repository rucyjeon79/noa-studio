"""Read-only public URL checks. No stream extraction, private access or retries."""
import collections
import concurrent.futures
import datetime
import json
from pathlib import Path
import re
import threading
import urllib.error
import urllib.parse
import urllib.request

root=Path('deploy/noastudio/noa/data/live/곡')
videos=set(); malformed=0; thumbnails=set()
for path in root.rglob('*.json'):
    body=json.loads(path.read_text())['pkg'];url=body.get('youtubeUrl','')
    if url:
        parsed=urllib.parse.urlparse(url)
        vid=parsed.path.strip('/') if parsed.hostname in ('youtu.be','www.youtu.be') else urllib.parse.parse_qs(parsed.query).get('v',[''])[0]
        if not vid:
            match=re.match(r'^/(?:embed|shorts)/([A-Za-z0-9_-]{11})',parsed.path)
            if match:vid=match[1]
        if re.fullmatch(r'[A-Za-z0-9_-]{11}',vid):videos.add(vid)
        else:malformed+=1
    thumb=body.get('thumbUrl','')
    if isinstance(thumb,str) and thumb.startswith('https://'):thumbnails.add(thumb)

stop=threading.Event()
def check_video(vid):
    if stop.is_set():return vid,{'status':'not_checked_rate_limit'}
    url='https://www.youtube.com/oembed?'+urllib.parse.urlencode({'url':'https://www.youtube.com/watch?v='+vid,'format':'json'})
    request=urllib.request.Request(url,headers={'User-Agent':'NOA-STUDIO-Migration-Verification'})
    try:
        with urllib.request.urlopen(request,timeout=15) as response:
            body=json.load(response)
            return vid,{'status':'public' if body.get('type')=='video' else 'unexpected_response','http':response.status}
    except urllib.error.HTTPError as exc:
        if exc.code==429:stop.set()
        return vid,{'status':'not_public_or_unavailable','http':exc.code}
    except Exception as exc:
        return vid,{'status':'unverified','reason':type(exc).__name__}

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    results=dict(pool.map(check_video,sorted(videos)))
report={'method':'YouTube oEmbed',
        'source_video_ids':len(videos),'malformed_source_urls':malformed,'videos':results,
        'source_thumbnail_urls':len(thumbnails),'local_audio_files':0}
raw=json.dumps(report,ensure_ascii=False,separators=(',',':'))
# Server-only seed; never expose unavailable/private identifiers through a public endpoint.
Path('bridge/media-status.php').write_text("<?php\nif (!defined('_GNUBOARD_')) { http_response_code(403); exit; }\nreturn json_decode("+json.dumps(raw,ensure_ascii=False)+",true,512,JSON_THROW_ON_ERROR);\n")
print('Media URL availability (not a playback guarantee):',json.dumps(collections.Counter(r['status'] for r in results.values())),
      'malformed:',malformed,'source thumbnail URLs:',len(thumbnails),'local audio files:',0)
