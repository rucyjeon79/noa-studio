"""Build a server-only import from existing repository music JSON, preserving every source file."""
import base64
import gzip
import hashlib
import json
import re
from pathlib import Path
root = Path('deploy/noastudio/noa/data/live/곡')
items, seen = [], set()
digest = hashlib.sha256()
for path in sorted(root.rglob('*.json')):
    relative = path.relative_to(root)
    document = json.loads(path.read_text())
    genre = relative.parts[0]
    if not re.fullmatch('[a-z0-9-]+', genre):
        raise ValueError('Invalid genre')
    if re.fullmatch('act-[0-9]+', path.stem):
        kind, key = 'playlist', f'playlist:{genre}:{path.stem}'
    elif path.parent.name == 'ep' and re.fullmatch('[0-9]+', path.stem):
        kind, key = 'single', f'single:{genre}:{path.stem}'
    else:
        kind, key = 'story', f'story:{genre}:' + hashlib.sha256(str(relative).encode()).hexdigest()[:24]
    if key in seen:
        raise ValueError('Duplicate source key')
    seen.add(key)
    digest.update(str(relative).encode())
    digest.update(path.read_bytes())
    payload = {'genreId':genre,'title':document.get('title',''),'ep':document.get('ep'),
        'act':document.get('act'),'confirmed':document.get('confirmed') is True,
        'body':document['pkg'],'sourcePath':str(relative)}
    items.append({'key':key,'kind':kind,'payload':payload})
if len(items) != 653:
    raise ValueError('Source snapshot count changed; review migration before deployment')
raw = json.dumps({'source':'repository-music-snapshot','sha256':digest.hexdigest(),'items':items},
    ensure_ascii=False,separators=(',',':')).encode()
encoded = base64.b64encode(gzip.compress(raw,mtime=0)).decode()
Path('bridge/seed.php').write_text("<?php\nif (!defined('_GNUBOARD_')) { http_response_code(403); exit; }\nreturn json_decode(gzdecode(base64_decode('" + encoded + "')),true,512,JSON_THROW_ON_ERROR);\n")
print('Verified source documents:',len(items),'sha256:',digest.hexdigest())
