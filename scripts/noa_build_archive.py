"""Preserve source bytes separately from active music documents and settings."""
import base64
import gzip
import hashlib
import json
from pathlib import Path

root = Path('deploy/noastudio/noa/data/live')
allowed = {'곡', '앱관리', '번역', '사용자설정', '올려준곡', '원곡정보'}
files = []
for path in sorted(root.rglob('*')):
    if not path.is_file() or path.relative_to(root).parts[0] not in allowed:
        continue
    raw = path.read_bytes()
    files.append({'path': str(path.relative_to(root)), 'sha256': hashlib.sha256(raw).hexdigest(),
                  'base64': base64.b64encode(raw).decode()})
if len(files) != 731:
    raise ValueError('Unexpected archive size; review source inventory')
raw = json.dumps({'files': files}, ensure_ascii=False, separators=(',', ':')).encode()
encoded = base64.b64encode(gzip.compress(raw, mtime=0)).decode()
Path('bridge/source-archive.php').write_text("<?php\nif (!defined('_GNUBOARD_')) { http_response_code(403); exit; }\nreturn json_decode(gzdecode(base64_decode('" + encoded + "')),true,512,JSON_THROW_ON_ERROR);\n")
print('Byte-preserving archive:', len(files), 'source files')
