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
if __name__=='__main__':unittest.main()
