import sys,time,unittest,tempfile,io
from pathlib import Path
from unittest.mock import patch
from PIL import Image
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'scripts'))
import noa_suno_card_auto as auto
import noa_jukebox_worker as worker
class CardAuto(unittest.TestCase):
 def test_retry_and_new_source(self):
  r={'key':'song-a','sunoUrl':'https://suno.com/s/abc'}
  state={}
  auto.failed_attempt(state,r,100)
  self.assertEqual(auto.due_rows([r],state,999),[])
  self.assertEqual(auto.due_rows([r],state,1000),[r])
  self.assertEqual(auto.due_rows([{**r,'sunoUrl':'https://suno.com/s/new'}],state,101)[0]['sunoUrl'],'https://suno.com/s/new')
  for _ in range(20):auto.failed_attempt(state,r,100)
  self.assertEqual(state[auto.retry_key(r)]['next'],86500)
 def test_batch_does_not_starve_other_rows(self):
  rows=[{'key':str(i),'sunoUrl':'https://suno.com/s/abc'} for i in range(50)]
  state={}
  self.assertEqual(len(auto.due_rows(rows,state,0)),20)
  for r in rows[:20]:auto.failed_attempt(state,r,0)
  self.assertEqual(auto.due_rows(rows,state,0),rows[20:40])
 def test_public_metadata_to_verified_webp(self):
  sid='12345678-1234-1234-1234-123456789abc'
  page=('<meta property="og:title" content="Song"><meta property="og:image" content="https://cdn2.suno.ai/card.png">').encode()
  b=io.BytesIO();Image.new('RGB',(64,64),'blue').save(b,'PNG')
  with tempfile.TemporaryDirectory() as tmp:
   with patch.object(worker,'fetch',return_value=(page,'https://suno.com/song/'+sid)):
    m=worker.metadata('https://suno.com/s/share')
   self.assertEqual(m['suno_id'],sid)
   with patch.object(worker,'fetch',return_value=(b.getvalue(),m['image_url'])):
    p=Path(tmp)/'cover.webp';info=worker.cover(p,m['image_url'])
   self.assertEqual(worker.digest(p),info['cover_sha256'])
   self.assertEqual(Image.open(p).format,'WEBP')
