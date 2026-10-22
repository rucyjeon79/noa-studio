"""Exercise the real activation transaction with an in-memory SFTP server."""
import hashlib, io, pathlib, stat, sys, unittest
from types import SimpleNamespace
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'scripts'))
from noa_deploy_hosts import HostProfile
from noa_dothome_lock import HostLock
from noa_dothome_activate import activate_transaction

def sha(data):return hashlib.sha256(data).hexdigest()
class Writer(io.BytesIO):
 def __init__(self,fs,path):super().__init__();self.fs=fs;self.path=path
 def close(self):self.fs.files[self.path]=self.getvalue();super().close()
class SFTP:
 def __init__(self):
  self.files={};self.dirs=set();self.fail_after_first=False
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
 def posix_rename(self,source,target):
  self.files[target]=self.files.pop(source)
  if self.fail_after_first:
   self.files[target]=b'corrupt'
class TransactionTest(unittest.TestCase):
 def setUp(self):
  self.hosts={'noa-studio':HostProfile('noa-studio','/hosting/noastudio/html','/hosting/noastudio/private')}
  self.fs=SFTP();self.release='a'*40;self.path='noa-app/home.php'
  self.live='/hosting/noastudio/html/'+self.path
  self.stage='/hosting/noastudio/private/staging/'+self.release+'/'+sha(self.path.encode())+'.stage'
  self.backup='/hosting/noastudio/private/backups/'+self.release+'/'+sha(self.path.encode())+'.bak'
  self.fs.files.update({self.live:b'old',self.stage:b'new',self.backup:b'old'})
  self.plan={'host_id':'noa-studio','release':self.release,'activation_allowed':False,'change_count':1,'changes':[{'path':self.path,'before_sha256':sha(b'old'),'after_sha256':sha(b'new')}]}
  self.staged={'host_id':'noa-studio','release':self.release,'activated':False,'staged':[{'path':self.path,'sha256':sha(b'new'),'staged':self.stage}]}
  self.backups={'host_id':'noa-studio','release':self.release,'verified':True,'backups':[{'path':self.path,'sha256':sha(b'old'),'backup':self.backup}]}
 def test_atomic_activation(self):
  with HostLock(self.hosts,'noa-studio',self.fs) as lock:
   result=activate_transaction(self.hosts,'noa-studio',self.plan,self.staged,self.backups,self.fs,lock=lock)
   self.assertTrue(result['postflight_required'])
  self.assertEqual(self.fs.files[self.live],b'new')
  self.assertEqual(self.fs.files[self.backup],b'old')
 def test_wrong_backup_prevents_write(self):
  self.backups['backups'][0]['sha256']=sha(b'bad')
  with HostLock(self.hosts,'noa-studio',self.fs) as lock:
   with self.assertRaises(RuntimeError):activate_transaction(self.hosts,'noa-studio',self.plan,self.staged,self.backups,self.fs,lock=lock)
  self.assertEqual(self.fs.files[self.live],b'old')
if __name__=='__main__':unittest.main()
