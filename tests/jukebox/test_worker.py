import importlib.util, tempfile, unittest, subprocess
from pathlib import Path
s=importlib.util.spec_from_file_location('worker',Path(__file__).resolve().parents[2]/'scripts/noa_jukebox_worker.py')
w=importlib.util.module_from_spec(s);s.loader.exec_module(w)
class WorkerTests(unittest.TestCase):
 def test_paths(self):
  self.assertEqual(str(w.folder({'genre':'kpop-original','title':'별/빛','ep':'1'})),'K-POP/EP.01 별_빛')
  self.assertEqual(str(w.folder({'genre':'your-story','title':'우리'})),'사연곡/우리')
  with self.assertRaises(ValueError):w.folder({'genre':'cover-reborn','title':'우리'})
 def test_url_boundary(self):
  for u in ['https://suno.com.evil.test/a','https://suno.com@localhost/a','file:///etc/passwd','https://cdn2.suno.ai:123/a']:
   with self.assertRaises(ValueError):w.allowed(u)
  self.assertEqual(w.allowed('https://cdn2.suno.ai/a'),'https://cdn2.suno.ai/a')
 def test_real_codec_and_peak(self):
  with tempfile.TemporaryDirectory() as t:
   p=Path(t);source=p/'owned.mp3';out=p/'out.mp3'
   subprocess.run(['ffmpeg','-v','error','-f','lavfi','-i','sine=frequency=440:duration=2','-af','volume=0.15','-ac','2','-c:a','libmp3lame','-b:a','192k',str(source)],check=True)
   before,settings,after=w.optimize(source,out)
   self.assertEqual(after['codec'],'mp3');self.assertEqual(after['channels'],2);self.assertLessEqual(after['true_peak'],-1)
   self.assertGreater(after['duration'],1.9);self.assertFalse(after['decode_errors']);self.assertGreater(settings['applied_gain'],0)
 def test_corrupt_decode_rejected(self):
  with tempfile.TemporaryDirectory() as t:
   p=Path(t)/'bad.mp3';p.write_bytes(b'not music')
   with self.assertRaises(ValueError):w.analyze(p)

class PublishedAudioTests(unittest.TestCase):
 def test_public_sources_are_inventory_not_download_authorization(self):
  import json
  sid='12345678-1234-1234-1234-123456789abc'
  clip={'id':sid,'is_public':True,'handle':'artist','ownership':{'ownership_reason':'subscribed'},'audio_url':'https://studio-api.prod.suno.com/api/forbidden','video_url':'https://cdn1.suno.ai/provided.mp4','media_urls':[]}
  flight='1:'+json.dumps({'data':clip})
  page='<script>self.__next_f.push('+json.dumps([1,flight])+')</script>'
  result=w.published_audio(page,sid)
  self.assertTrue(result['metadata_found']);self.assertFalse(result['download_authorized'])
  self.assertEqual(result['sources'][1]['url'],clip['video_url'])
  self.assertTrue(result['sources'][0]['restricted'])
 def test_missing_media_never_generates_cdn_addresses(self):
  result=w.published_audio('<html></html>','12345678-1234-1234-1234-123456789abc')
  self.assertFalse(result['metadata_found']);self.assertEqual(result['sources'],[])

class OwnedInputTests(unittest.TestCase):
 def test_missing_and_unsafe_entries_do_not_block_valid_owned_file(self):
  import json
  spec=importlib.util.spec_from_file_location('owned',Path(__file__).resolve().parents[2]/'scripts/noa_jukebox_owned.py')
  owned=importlib.util.module_from_spec(spec);spec.loader.exec_module(owned)
  with tempfile.TemporaryDirectory() as t:
   root=Path(t);registry=root/'registry';registry.mkdir();(registry/'good.mp3').write_bytes(b'owned-file')
   mapping={'unsafe':{'authorization':'user_owned_download','file':'../secret.mp3'},'missing':{'authorization':'user_owned_download','file':'missing.mp3'},'valid':{'authorization':'user_owned_download','file':'good.mp3','suno_id':'known-id'}}
   (registry/'sources.json').write_text(json.dumps(mapping))
   class SFTP:
    def open(self,path,mode):return (registry/Path(path).name).open(mode)
    def lstat(self,path):return (registry/Path(path).name).lstat()
    def normalize(self,path):return path
   out,folder=owned.stage(SFTP(),[{'key':x} for x in mapping],root/'work')
   self.assertIn('error',out['unsafe']);self.assertIn('error',out['missing'])
   self.assertEqual(Path(out['valid']['path']).read_bytes(),b'owned-file')
   owned.cleanup(folder);self.assertFalse(folder.exists())

if __name__=='__main__':unittest.main()
