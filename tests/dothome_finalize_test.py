import hashlib,io,pathlib,stat,sys,unittest
from types import SimpleNamespace
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'scripts'))
from noa_deploy_hosts import HostProfile
from noa_dothome_lock import HostLock
from noa_dothome_finalize import finalize_release
class Writer(io.BytesIO):
 def __init__(self,fs,path):super().__init__();self.fs=fs;self.path=path
 def close(self):self.fs.files[self.path]=self.getvalue();super().close()
class Fake:
 def __init__(self):self.files={};self.dirs=set()
 def mkdir(self,path,mode):
  if path in self.dirs:raise FileExistsError(path)
  self.dirs.add(path)
 def rmdir(self,path):self.dirs.remove(path)
 def remove(self,path):del self.files[path]
 def lstat(self,path):
  if path in self.dirs:return SimpleNamespace(st_mode=stat.S_IFDIR|0o700)
  if path not in self.files:raise FileNotFoundError(path)
  return SimpleNamespace(st_mode=stat.S_IFREG|0o600,st_size=len(self.files[path]))
 def open(self,path,mode):
  if mode=='xb':return Writer(self,path)
  return io.BytesIO(self.files[path])
 def posix_rename(self,a,b):self.files[b]=self.files.pop(a)
class Response:
 status=200
 def __init__(self,url):self.url=url
 def geturl(self):return self.url
 def __enter__(self):return self
 def __exit__(self,*args):pass
class FinalizeTest(unittest.TestCase):
 def setUp(self):
  self.host=HostProfile('noa-studio','/hosting/noastudio/html','/hosting/noastudio/noa-deploy-private')
  self.hosts={'noa-studio':self.host}
  self.fs=Fake();self.fs.files[self.host.remote_root+'/noa-app/home.php']=b'new'
  self.transaction={'host_id':'noa-studio','release':'a'*40,'activated':True,'postflight_required':True,'installed':['noa-app/home.php']}
  self.plan={'host_id':'noa-studio','release':'a'*40,'changes':[{'path':'noa-app/home.php','after_sha256':hashlib.sha256(b'new').hexdigest()}]}
 def test_finalize_writes_receipt(self):
  with HostLock(self.hosts,'noa-studio',self.fs) as lock:
   result=finalize_release(self.hosts,'noa-studio',self.transaction,self.plan,self.fs,lock,'https://noastudio.ai.kr',['/'],opener=lambda req,timeout:Response(req.full_url))
  self.assertTrue(result['persisted'])
  self.assertIn(self.host.state_file,self.fs.files)
 def test_hash_mismatch_blocks_receipt(self):
  self.plan['changes'][0]['after_sha256']='0'*64
  with HostLock(self.hosts,'noa-studio',self.fs) as lock:
   with self.assertRaises(RuntimeError):finalize_release(self.hosts,'noa-studio',self.transaction,self.plan,self.fs,lock,'https://noastudio.ai.kr',['/'],opener=lambda req,timeout:Response(req.full_url))
  self.assertNotIn(self.host.state_file,self.fs.files)
if __name__=='__main__':unittest.main()
