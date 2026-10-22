import hashlib,io,pathlib,stat,sys,unittest
from types import SimpleNamespace
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'scripts'))
from noa_deploy_hosts import HostProfile
from noa_dothome_backup import prepare_backups
class Writer(io.BytesIO):
 def __init__(self,fs,path):super().__init__();self.fs=fs;self.path=path
 def close(self):self.fs[self.path]=self.getvalue();super().close()
class Fake:
 def __init__(self):
  self.files={'/hosting/noastudio/html/noa-app/home.php':b'old'}
  self.directory='/hosting/noastudio/private/backups/'+'a'*40
 def lstat(self,path):
  if path==self.directory:return SimpleNamespace(st_mode=stat.S_IFDIR|0o700)
  if path not in self.files:raise FileNotFoundError(path)
  return SimpleNamespace(st_mode=stat.S_IFREG|0o600)
 def open(self,path,mode):
  if mode=='xb':return Writer(self.files,path)
  return io.BytesIO(self.files[path])
class BackupTest(unittest.TestCase):
 def setUp(self):
  self.hosts={'noa-studio':HostProfile('noa-studio','/hosting/noastudio/html','/hosting/noastudio/private')}
  self.plan={'host_id':'noa-studio','release':'a'*40,'activation_allowed':False,'change_count':1,'changes':[{'path':'noa-app/home.php','before_sha256':hashlib.sha256(b'old').hexdigest(),'after_sha256':hashlib.sha256(b'new').hexdigest()}]}
 def test_verified_private_backup(self):
  fs=Fake();result=prepare_backups(self.hosts,'noa-studio',self.plan,fs,lock_held=True)
  self.assertTrue(result['verified'])
  self.assertEqual(fs.files[fs.directory+'/'+hashlib.sha256(b'noa-app/home.php').hexdigest()+'.bak'],b'old')
  self.assertEqual(fs.files['/hosting/noastudio/html/noa-app/home.php'],b'old')
 def test_requires_lock(self):
  with self.assertRaises(ValueError):prepare_backups(self.hosts,'noa-studio',self.plan,Fake())
 def test_changed_source_blocks_backup(self):
  fs=Fake();fs.files['/hosting/noastudio/html/noa-app/home.php']=b'changed'
  with self.assertRaises(RuntimeError):prepare_backups(self.hosts,'noa-studio',self.plan,fs,lock_held=True)
if __name__=='__main__':unittest.main()
