import io,pathlib,stat,sys,unittest
from types import SimpleNamespace
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'scripts'))
from noa_deploy_hosts import HostProfile
from noa_dothome_lock import HostLock
class Writer(io.BytesIO):
 def __init__(self,fs,path):super().__init__();self.fs=fs;self.path=path
 def close(self):self.fs.files[self.path]=self.getvalue();super().close()
class Fake:
 def __init__(self):self.dirs=set();self.files={}
 def mkdir(self,path,mode):
  if path in self.dirs:raise FileExistsError(path)
  self.dirs.add(path)
 def lstat(self,path):
  if path not in self.dirs:raise FileNotFoundError(path)
  return SimpleNamespace(st_mode=stat.S_IFDIR|0o700)
 def open(self,path,mode):
  if mode=='xb':
   if path in self.files:raise FileExistsError(path)
   return Writer(self,path)
  return io.BytesIO(self.files[path])
 def remove(self,path):del self.files[path]
 def rmdir(self,path):self.dirs.remove(path)
class LockTest(unittest.TestCase):
 def setUp(self):self.hosts={'noa-studio':HostProfile('noa-studio','/hosting/noastudio/html','/hosting/noastudio/private')}
 def test_exclusive_and_release(self):
  fs=Fake()
  with HostLock(self.hosts,'noa-studio',fs) as lock:
   self.assertTrue(lock.verify())
   with self.assertRaises(RuntimeError):HostLock(self.hosts,'noa-studio',fs).acquire()
  self.assertFalse(fs.dirs)
 def test_owner_change_blocks_release(self):
  fs=Fake();lock=HostLock(self.hosts,'noa-studio',fs).acquire()
  fs.files[lock.path+'/owner']=b'other'
  self.assertFalse(lock.verify())
  with self.assertRaises(RuntimeError):lock.release()
if __name__=='__main__':unittest.main()
