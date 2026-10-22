import hashlib,io,pathlib,stat,sys,unittest
from types import SimpleNamespace
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'scripts'))
from noa_deploy_hosts import HostProfile
from noa_dothome_activate import activate_release
class Fake:
 def __init__(self):
  self.live='/hosting/noastudio/html/noa-app/home.php'
  self.stage='/hosting/noastudio/private/staging/'+'a'*40+'/'+hashlib.sha256(b'noa-app/home.php').hexdigest()+'.stage'
  self.files={self.live:b'old',self.stage:b'new'}
 def lstat(self,path):
  if path not in self.files:raise FileNotFoundError(path)
  return SimpleNamespace(st_mode=stat.S_IFREG|0o600)
 def open(self,path,mode):return io.BytesIO(self.files[path])
class ActivationTest(unittest.TestCase):
 def setUp(self):
  self.hosts={'noa-studio':HostProfile('noa-studio','/hosting/noastudio/html','/hosting/noastudio/private')}
  self.plan={'host_id':'noa-studio','activation_allowed':False,'release':'a'*40,'change_count':1,'changes':[{'path':'noa-app/home.php','before_sha256':hashlib.sha256(b'old').hexdigest(),'after_sha256':hashlib.sha256(b'new').hexdigest()}]}
  self.stage={'host_id':'noa-studio','release':'a'*40,'activated':False,'staged':[{'path':'noa-app/home.php','sha256':hashlib.sha256(b'new').hexdigest(),'staged':Fake().stage}]}
 def test_no_lock_rejected(self):
  with self.assertRaises(ValueError):activate_release(self.hosts,'noa-studio',self.plan,self.stage,Fake())
 def test_no_backup_never_activates(self):
  fs=Fake()
  with self.assertRaisesRegex(RuntimeError,'backup_and_rollback_transaction_required'):
   activate_release(self.hosts,'noa-studio',self.plan,self.stage,fs,lock_held=True)
  self.assertEqual(fs.files[fs.live],b'old')
 def test_verified_backup_required_before_atomic_swap(self):
  fs=Fake()
  backup=fs.stage.replace('/staging/','/backups/').replace('/file.stage','/file.bak')
  fs.files[backup]=b'old'
  records={'host_id':'noa-studio','release':'a'*40,'verified':True,'backups':[{'path':'noa-app/home.php','backup':backup,'sha256':hashlib.sha256(b'old').hexdigest()}]}
  self.plan['release']='a'*40
  with self.assertRaisesRegex(RuntimeError,'host_lock_and_atomic_transaction_required'):
   activate_release(self.hosts,'noa-studio',self.plan,self.stage,fs,lock_held=True,backups=records)
  self.assertEqual(fs.files[fs.live],b'old')
 def test_incomplete_backup_rejected(self):
  self.plan['release']='a'*40
  with self.assertRaisesRegex(RuntimeError,'backup_coverage_incomplete'):
   activate_release(self.hosts,'noa-studio',self.plan,self.stage,Fake(),lock_held=True,backups={'host_id':'noa-studio','release':'a'*40,'verified':True,'backups':[]})
 def test_cross_host_staging_path_rejected(self):
  fs=Fake()
  self.stage['staged'][0]['staged']='/hosting/other/private/staging/'+'a'*40+'/file.stage'
  with self.assertRaisesRegex(ValueError,'cross_host_staging_path'):
   activate_release(self.hosts,'noa-studio',self.plan,self.stage,fs,lock_held=True)
 def test_wrong_host_rejected(self):
  with self.assertRaises(ValueError):activate_release(self.hosts,'other-host',self.plan,self.stage,Fake(),lock_held=True)
if __name__=='__main__':unittest.main()
