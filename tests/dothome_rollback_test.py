import hashlib,io,pathlib,stat,sys,unittest
from types import SimpleNamespace
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'scripts'))
from noa_deploy_hosts import HostProfile
from noa_dothome_rollback import rollback_release
class Writer(io.BytesIO):
 def __init__(self,fs,path):super().__init__();self.fs=fs;self.path=path
 def close(self):self.fs[self.path]=self.getvalue();super().close()
class Fake:
 def __init__(self):
  self.live='/hosting/noastudio/html/noa-app/home.php'
  self.backup='/hosting/noastudio/private/backups/'+'a'*40+'/home.bak'
  self.files={self.live:b'new',self.backup:b'old'}
 def lstat(self,path):
  if path not in self.files:raise FileNotFoundError(path)
  return SimpleNamespace(st_mode=stat.S_IFREG|0o600)
 def open(self,path,mode):
  if mode=='xb':return Writer(self.files,path)
  return io.BytesIO(self.files[path])
 def posix_rename(self,source,target):self.files[target]=self.files.pop(source)
 def remove(self,path):del self.files[path]
class RollbackTest(unittest.TestCase):
 def setUp(self):
  self.hosts={'noa-studio':HostProfile('noa-studio','/hosting/noastudio/html','/hosting/noastudio/private')}
  self.plan={'host_id':'noa-studio','release':'a'*40,'changes':[{'path':'noa-app/home.php','after_sha256':hashlib.sha256(b'new').hexdigest()}]}
 def test_restore_old_bytes(self):
  fs=Fake()
  backups={'host_id':'noa-studio','release':'a'*40,'verified':True,'backups':[{'path':'noa-app/home.php','sha256':hashlib.sha256(b'old').hexdigest(),'backup':fs.backup}]}
  result=rollback_release(self.hosts,'noa-studio',self.plan,backups,fs,['noa-app/home.php'],lock_held=True)
  self.assertTrue(result['success'])
  self.assertEqual(fs.files[fs.live],b'old')
  self.assertEqual(fs.files[fs.backup],b'old')
 def test_concurrent_edit_blocks_rollback(self):
  fs=Fake();fs.files[fs.live]=b'other'
  with self.assertRaises(RuntimeError):rollback_release(self.hosts,'noa-studio',self.plan,{'host_id':'noa-studio','release':'a'*40,'verified':True,'backups':[{'path':'noa-app/home.php','sha256':None,'backup':None}]},fs,['noa-app/home.php'],lock_held=True)
if __name__=='__main__':unittest.main()
