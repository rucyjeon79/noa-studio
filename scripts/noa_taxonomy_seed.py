"""Initial import package only. Runtime never reloads GitHub over edited SQL rules."""
from pathlib import Path
import hashlib,json
sources=[Path('src/data/unified-master.md'),*sorted(Path('src/data/guides').glob('*.md')),*sorted(Path('src/data/suno').glob('*.txt'))]
rows=[]
for p in sources:
 b=p.read_bytes();kind='unified' if p.name=='unified-master.md' else p.parent.name
 genre=None if kind=='unified' else p.stem
 rows.append(dict(rule_id='common:unified' if not genre else 'genre:'+genre+':'+kind,scope='common' if not genre else 'genre',genre_id=genre,format='text',body=b.decode(),source_path=str(p),source_sha256=hashlib.sha256(b).hexdigest()))
Path('bridge/taxonomy-rule-seed.php').write_text("<?php\nif(!defined('_GNUBOARD_')){http_response_code(403);exit;}\nreturn json_decode(base64_decode('"+__import__('base64').b64encode(json.dumps(rows,ensure_ascii=False).encode()).decode()+"'),true,512,JSON_THROW_ON_ERROR);\n")
print('Production rule source files:',len(rows))
