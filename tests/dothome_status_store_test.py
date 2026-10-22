import hashlib, io, json, pathlib, stat, sys, unittest
from types import SimpleNamespace
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'scripts'))
from noa_deploy_hosts import HostProfile
from noa_dothome_lock import HostLock
from noa_dothome_status_store import persist_receipt

class Buffer(io.BytesIO):
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
  if mode=='xb':return Buffer(self,path)
  return io.BytesIO(self.files[path])
 def posix_rename(self,a,b):self.files[b]=self.files.pop(a)
class StoreTest(unittest.TestCase):
 def test_verified_receipt_and_conflict(self):
  host=HostProfile('noa-studio','/hosting/noastudio/html','/hosting/noastudio/noa-deploy-private')
  fs=Fake();record={'host_id':'noa-studio','release':'a'*40,'status':'verified'}
  digest=hashlib.sha256(json.dumps(record,sort_keys=True,separators=(',',':')).encode()).hexdigest()
  receipt={'record':record,'receipt_sha256':digest,'private_destination':host.state_file,'persisted':False}
  with HostLock({'noa-studio':host},'noa-studio',fs) as lock:
   result=persist_receipt({'noa-studio':host},'noa-studio',receipt,fs,lock)
  self.assertTrue(result['persisted'])
  self.assertEqual(json.loads(fs.files[host.state_file]),record)
  with HostLock({'noa-studio':host},'noa-studio',fs) as lock:
   with self.assertRaisesRegex(RuntimeError,'concurrent_status_change'):
    persist_receipt({'noa-studio':host},'noa-studio',receipt,fs,lock)
if __name__=='__main__':unittest.main()
