import hashlib,io,pathlib,stat,sys,unittest
from types import SimpleNamespace
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'scripts'))
from noa_deploy_hosts import HostProfile
from noa_dothome_prepare import prepare_release

class Writer(io.BytesIO):
 def __init__(self,fs,path):super().__init__();self.fs=fs;self.path=path
 def close(self):self.fs.files[self.path]=self.getvalue();super().close()

class Fake:
 def __init__(self):
  self.root='/hosting/noastudio'
  self.live=self.root+'/html/noa-app/home.php'
  self.release='a'*40
  self.files={self.live:b'old'}
  self.dirs={self.root+'/private/staging/'+self.release,self.root+'/private/backups/'+self.release}
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
  if mode=='xb':
   if path in self.files:raise FileExistsError(path)
   return Writer(self,path)
  return io.BytesIO(self.files[path])

class PrepareTest(unittest.TestCase):
 def setUp(self):
  self.hosts={'noa-studio':HostProfile('noa-studio','/hosting/noastudio/html','/hosting/noastudio/private')}
  self.new=b'new'
  self.manifest={'schema':1,'host_id':'noa-studio','release':'a'*40,'activate':False,'files':[{'path':'noa-app/home.php','sha256':hashlib.sha256(self.new).hexdigest(),'bytes':len(self.new)}]}
 def test_prepares_but_never_activates(self):
  fs=Fake()
  result=prepare_release(self.hosts,'noa-studio',self.manifest,{'noa-app/home.php':self.new},fs)
  self.assertEqual(result['status'],'prepared_only')
  self.assertEqual(result['backup_count'],1)
  self.assertFalse(result['ready_for_activation'])
  self.assertEqual(fs.files[fs.live],b'old')
  self.assertFalse(any('noa-deploy-lock' in x for x in fs.dirs))
 def test_wrong_host_no_write(self):
  fs=Fake()
  with self.assertRaises(ValueError):prepare_release(self.hosts,'other-host',self.manifest,{'noa-app/home.php':self.new},fs)
  self.assertEqual(fs.files,{fs.live:b'old'})
if __name__=='__main__':unittest.main()
