"""Build a deterministic music-only source bundle; never changes source files."""
from pathlib import Path
import base64,gzip,hashlib,json,collections
ROOT=Path(__file__).resolve().parents[1]
def collect():
 sources=[]
 for name in ['data/live','data/backup-save-lock/live','deploy/noastudio/noa/data/live']:
  root=ROOT/name
  for path in sorted(root.rglob('*.json')):
   rel=str(path.relative_to(root));section=rel.split('/')[0]
   if section not in {'곡','원곡정보','올려준곡','genres','songs','playlists','stories','사연','커버'}:continue
   raw=path.read_bytes();value=json.loads(raw)
   if not isinstance(value,dict):raise ValueError('Unexpected music document '+str(path))
   sources.append({'namespace':name,'path':rel,'sha256':hashlib.sha256(raw).hexdigest(),'raw':base64.b64encode(raw).decode()})
 for path in sorted((ROOT/'src/data/originals').glob('*.json')):
  raw=path.read_bytes();sources.append({'namespace':'src/data','path':'originals/'+path.name,'sha256':hashlib.sha256(raw).hexdigest(),'raw':base64.b64encode(raw).decode()})
 # src/data/encyclopedia.json has no music rows in this snapshot; do not include private settings.
 empty=json.loads((ROOT/'src/data/encyclopedia.json').read_text())
 for section in ['packages','playlists','stories','originals']:
  for key,value in sorted(empty.get(section,{}).items()):
   raw=json.dumps(value,ensure_ascii=False,separators=(',',':')).encode();sources.append({'namespace':'src/data/encyclopedia:'+section,'path':key,'sha256':hashlib.sha256(raw).hexdigest(),'raw':base64.b64encode(raw).decode()})
 return sources
if __name__=='__main__':
 sources=collect();blobs={s['sha256']:s['raw'] for s in sources};refs=[{k:v for k,v in s.items() if k!='raw'} for s in sources];raw=json.dumps({'schema':1,'sources':refs,'blobs':blobs,'limits':['기존 Grok 화면에는 원본 PostgreSQL 전체 내보내기 기능이 없어 SQL 전용 데이터의 전체 수집은 아직 확인되지 않았습니다.','저장소의 PostgreSQL 저장본 2곳은 체크포인트 오류로 열리지 않습니다. 초기화·복구 없이 원본을 보존했습니다.']},ensure_ascii=False,separators=(',',':')).encode();encoded=base64.b64encode(gzip.compress(raw,mtime=0)).decode();target=ROOT/'bridge/catalog-seed.php';target.write_text("<?php\nif(!defined('_GNUBOARD_')){http_response_code(403);exit;}\nreturn json_decode(gzdecode(base64_decode('"+encoded+"')),true,512,JSON_THROW_ON_ERROR);\n");print('Music source occurrences:',len(sources),'unique content hashes:',len({s['sha256'] for s in sources}),'bundle SHA256:',hashlib.sha256(raw).hexdigest())
