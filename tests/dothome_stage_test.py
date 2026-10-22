import hashlib,io,pathlib,stat,sys,unittest
from types import SimpleNamespace
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'scripts'))
from noa_deploy_hosts import HostProfile
from noa_dothome_stage import stage_release

class Writable(io.BytesIO):
 def __init__(self,fs,key):super().__init__();self.fs=fs;self.key=key
 def close(self):self.fs[self.key]=self.getvalue();super().close()
class FakeSFTP:
 def __init__(self):self.files={};self.directory='/hosting/noastudio/private/staging/'+'a'*40
 def lstat(self,path):
  if path==self.directory:return SimpleNamespace(st_mode=stat.S_IFDIR|0o700)
  if path not in self.files:raise FileNotFoundError(path)
  return SimpleNamespace(st_mode=stat.S_IFREG|0o600,st_size=len(self.files[path]))
 def open(self,path,mode):
  if mode=='xb':return Writable(self.files,path)
  return io.BytesIO(self.files[path])
class StageTest(unittest.TestCase):
 def setUp(self):
  self.hosts={'noa-studio':HostProfile('noa-studio','/hosting/noastudio/html','/hosting/noastudio/private')}
  self.data=b'<?php echo 1;'
  self.manifest={'schema':1,'host_id':'noa-studio','release':'a'*40,'activate':False,'files':[{'path':'noa-app/home.php','sha256':hashlib.sha256(self.data).hexdigest(),'bytes':len(self.data)}]}
 def test_stages_without_activation(self):
  fs=FakeSFTP()
  result=stage_release(self.hosts,'noa-studio',self.manifest,{'noa-app/home.php':self.data},fs)
  self.assertFalse(result['activated'])
  self.assertEqual(len(fs.files),1)
  self.assertTrue(next(iter(fs.files)).startswith(fs.directory))
 def test_reject_bad_hash_without_write(self):
  fs=FakeSFTP()
  with self.assertRaises(ValueError):stage_release(self.hosts,'noa-studio',self.manifest,{'noa-app/home.php':b'bad'},fs)
  self.assertFalse(fs.files)
 def test_cross_host_rejected(self):
  fs=FakeSFTP();self.manifest['host_id']='other-host'
  with self.assertRaises(ValueError):stage_release(self.hosts,'noa-studio',self.manifest,{'noa-app/home.php':self.data},fs)
  self.assertFalse(fs.files)
if __name__=='__main__':unittest.main()
