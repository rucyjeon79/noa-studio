"""Pin the official Google Fonts Korean face for disposable QA runners; no apt locks."""
import hashlib,subprocess,urllib.request
from pathlib import Path
COMMIT='b38c5c93af322c45f633e17ac440ec1e6c94d489'
BLOB='b386890ba945e1f39448a6b59f20c5d194f58808'
SIZE=10414588
URL='https://raw.githubusercontent.com/google/fonts/'+COMMIT+'/ofl/notosanskr/NotoSansKR%5Bwght%5D.ttf'
root=Path.home()/'.local/share/fonts/noa-studio-qa';root.mkdir(parents=True,exist_ok=True);target=root/'NotoSansKR.ttf'
def valid(data):return len(data)==SIZE and hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()==BLOB
if not target.is_file()or not valid(target.read_bytes()):
 with urllib.request.urlopen(urllib.request.Request(URL,headers={'User-Agent':'NOA-browser-QA'}),timeout=45)as r:data=r.read(SIZE+1)
 if not valid(data):raise RuntimeError('official_font_integrity_mismatch')
 temp=root/'NotoSansKR.tmp';temp.write_bytes(data);temp.replace(target)
subprocess.run(['fc-cache','-f',str(root)],check=True,timeout=30)
print('PINNED_OFFICIAL_NOTO_SANS_KR_READY')
