import importlib.util, tempfile, unittest, subprocess
from unittest.mock import patch
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
 def test_encoder_peak_retry_uses_original_and_records_total_gain(self):
  with tempfile.TemporaryDirectory() as t:
   root=Path(t);source=root/'owned.mp3';out=root/'out.mp3'
   subprocess.run(['ffmpeg','-v','error','-f','lavfi','-i','sine=frequency=1000:duration=2','-ac','2','-c:a','libmp3lame',str(source)],check=True)
   real_analyze=w.analyze;checks=[]
   def measured(path):
    result=real_analyze(path)
    if path==out:
     checks.append(path)
     if len(checks)==1:result['true_peak']=0.2
    return result
   with patch.object(w,'analyze',side_effect=measured),patch.object(w,'run',wraps=w.run) as calls:
    before,settings,after=w.optimize(source,out)
   encodes=[c.args[0] for c in calls.call_args_list if 'libmp3lame' in c.args[0]]
   self.assertEqual(len(encodes),2)
   self.assertTrue(all(args[args.index('-i')+1]==str(source) for args in encodes))
   self.assertAlmostEqual(settings['applied_gain'],settings['planned_gain']-1.4)
   self.assertLessEqual(after['true_peak'],-1);self.assertTrue(settings['source_unchanged'])
 def test_owned_mp4_becomes_verified_mp3_beside_reused_cover(self):
  with tempfile.TemporaryDirectory() as t:
   root=Path(t)/'catalog';root.mkdir();source=Path(t)/'owned.mp4'
   subprocess.run(['ffmpeg','-v','error','-f','lavfi','-i','sine=frequency=660:duration=2','-ac','2','-c:a','aac',str(source)],check=True)
   row={'key':'test:owned','sunoUrl':'https://suno.com/song/12345678-1234-1234-1234-123456789abc','title':'검증곡','genre':'kpop-original','ep':'1'}
   directory='K-POP/EP.01 검증곡';cover=root/directory/'cover.webp';cover.parent.mkdir(parents=True)
   w.Image.new('RGB',(32,32),'blue').save(cover,'WEBP')
   row['existing_cover']={'suno_id':'known-id','suno_title':'원본제목','cover_path':directory+'/cover.webp','cover_bytes':cover.stat().st_size,'cover_sha256':w.digest(cover)}
   inputs={row['key']:{'path':str(source),'authorization':'user_owned_download','suno_id':'known-id'}}
   result=w.process(row,root,{row['key']:directory},inputs)
   self.assertEqual(result['status'],'ready');self.assertEqual(result['errors'],[])
   self.assertEqual((root/result['audio_path']).parent,cover.parent)
   self.assertEqual(Path(result['audio_path']).name,'원본제목.mp3')
   self.assertEqual(result['source_analysis']['codec'],'aac');self.assertEqual(result['final_analysis']['codec'],'mp3')
   self.assertTrue(result['audio_discovery']['download_authorized']);self.assertLessEqual(result['final_analysis']['true_peak'],-1)
   self.assertEqual(result['cover_sha256'],w.digest(cover));self.assertFalse(list(root.rglob('*.wav')))

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

class UploadPublicationTests(unittest.TestCase):
 def test_cardless_upload_fetches_only_card_and_publishes_beside_real_mp3(self):
  import sys,hashlib
  sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'scripts'))
  import noa_jukebox_upload_worker as upload
  with tempfile.TemporaryDirectory() as t:
   root=Path(t);incoming=root/'incoming'/'abc';incoming.mkdir(parents=True)
   source=incoming/'input.audio'
   subprocess.run(['ffmpeg','-v','error','-f','lavfi','-i','sine=frequency=440:duration=2','-ac','2','-c:a','pcm_s16le','-f','wav',str(source)],check=True)
   job={'job_id':1,'id':'abc','key':'test:upload','lease':'lease','extension':'wav','bytes':source.stat().st_size,'sha256':w.digest(source),'context':{'title':'등록곡','genre':'kpop-original','ep':'1','suno_id':'known'},'source_url':'https://suno.com/song/known','cover_path':None,'previous_sha256':None}
   class RemoteFile:
    def __init__(self,f):self.f=f
    def __enter__(self):return self
    def __exit__(self,*args):self.f.close()
    def prefetch(self,**args):self.prefetch_args=args
    def read(self,*args):return self.f.read(*args)
    def write(self,*args):return self.f.write(*args)
    def set_pipelined(self,*args):pass
   class SFTP:
    def path(self,p):return root/Path(p).relative_to(upload.PRIVATE)
    def lstat(self,p):return self.path(p).lstat()
    def normalize(self,p):return p
    def open(self,p,m):return RemoteFile(self.path(p).open(m))
    def chmod(self,p,m):self.path(p).chmod(m)
    def rename(self,p,q):self.path(p).rename(self.path(q))
   sftp=SFTP();events=[];pending=[job|{'id':'missing','job_id':0},job]
   def call(action,payload=None):
    events.append((action,payload))
    if action=='upload_claim':return {'uploads':[pending.pop(0)] if pending else []}
    if action=='upload_cleanup':return {'input_removed':not source.exists()}
    if action=='upload_commit':
     r=payload['result'];audio=root/'media'/r['audio_path'];cover=root/'media'/r['cover_path']
     self.assertEqual(audio.parent,cover.parent);self.assertEqual(audio.name,'Suno 등록 제목.mp3')
     self.assertEqual(w.digest(audio),r['audio_sha256']);self.assertEqual(w.digest(cover),r['cover_sha256'])
     self.assertEqual(w.analyze(audio)['codec'],'mp3');source.unlink()
     return {'ready':True,'input_removed':True}
    return {}
   def cover(path,url):
    self.assertEqual(url,'https://cdn2.suno.ai/card.jpeg');w.Image.new('RGB',(32,32),'blue').save(path,'WEBP')
    return {'cover_bytes':path.stat().st_size,'cover_sha256':w.digest(path)}
   with patch.object(upload.media,'metadata',return_value={'suno_id':'known','suno_title':'Suno 등록 제목','image_url':'https://cdn2.suno.ai/card.jpeg'}),patch.object(upload.media,'cover',side_effect=cover):
    def source_reader(job,dest):
     dest.write_bytes(source.read_bytes());return True
    result=upload.process_uploads(sftp,call,lambda p,m:sftp.path(p).mkdir(exist_ok=True),source_reader if getattr(self,'stream_source',False) else None)
   self.assertFalse(result[0]['ready']);self.assertTrue(result[1]['ready']);self.assertFalse(source.exists());self.assertFalse(list((root/'media').rglob('*.wav')))
   self.assertEqual([e[0] for e in events],['upload_claim','upload_reconcile','upload_fail','upload_claim','upload_state','upload_state','upload_heartbeat','upload_heartbeat','upload_commit','upload_cleanup','upload_claim'])
 def test_streamed_owned_source_still_requires_hash_decode_and_verified_publication(self):
  self.stream_source=True
  self.test_cardless_upload_fetches_only_card_and_publishes_beside_real_mp3()
