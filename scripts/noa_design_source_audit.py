"""Inspect original public design sources without exposing administrative state."""
from pathlib import Path
import hashlib,json,re
root=Path('data/live');common=json.loads((root/'사용자설정/공통.json').read_text());genre_dir=root/'사용자설정/장르'
print('Common setting fields:',len(common),'design rule lines:',len(common.get('designRule','').splitlines()),'list rule lines:',len(common.get('listRule','').splitlines()))
for path in sorted(genre_dir.glob('*.json')):
 data=json.loads(path.read_text());print(json.dumps({'genre':path.stem,'fields':len(data),'source_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'language':data.get('lang'),'designRulePresent':bool(data.get('designRule')),'thumbSettings':[k for k in data if k.lower().startswith('thumb')]},ensure_ascii=False))
found=[]
def scan(value,path):
 if isinstance(value,dict):
  for key,child in value.items():
   if key.lower() in ('theme','themeid','theme_id','themename','themes','palette','radius','design'):
    # Only design keys: do not print unrelated account, device, gate or API settings.
    found.append({'path':path,'field':key,'type':type(child).__name__,'value':child if isinstance(child,(str,int,bool)) and len(str(child))<120 else None})
   scan(child,path)
 elif isinstance(value,list):
  for child in value:scan(child,path)
for path in sorted((root/'사용자설정').rglob('*.json')):scan(json.loads(path.read_text()),str(path.relative_to(root)))
state=root/'앱관리/상태.json'
if state.is_file():
 data=json.loads(state.read_text());scan(data.get('ui',{}),'앱관리/상태.json:ui')
print('Original stored theme identifiers:',json.dumps(found,ensure_ascii=False))
for p in Path('src').rglob('*'):
 if p.suffix not in ('.ts','.tsx','.css'):continue
 for i,line in enumerate(p.read_text().splitlines()):
  if any(key in line for key in ['data-theme','themeId','theme_id','themeName','noa-theme','noa-view-lang']):print('Original theme/language reference',str(p),i+1,line.strip()[:250])
print('Original common theme keys:',[k for k in common if 'theme' in k.lower() or '테마' in k])
print('No source preference or music files changed.')
