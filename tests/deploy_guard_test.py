import sys,unittest,stat,errno
from types import SimpleNamespace
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from noa_deploy_guard import DeployBlocked,create_directory,deployment_preflight,verified_backup
class Fake:
 def __init__(self,error=None):self.error=error;self.calls=[]
 def mkdir(self,p,m):
  self.calls.append(('mkdir',p))
  if self.error:raise self.error
 def lstat(self,p):
  if p.endswith('new')or p.endswith('.work-deploy-lock'):raise FileNotFoundError(p)
  return SimpleNamespace(st_mode=stat.S_IFDIR|0o700)
 def normalize(self,p):return p
class TestGuard(unittest.TestCase):
 def test_generic_sftp_failure_keeps_primary_error(self):
  with self.assertRaises(DeployBlocked)as c:create_directory(Fake(OSError('Failure')),'/backup/new')
  self.assertEqual(c.exception.code,'BACKUP_MKDIR_FAILED')
 def test_quota_has_distinct_code(self):
  with self.assertRaises(DeployBlocked)as c:create_directory(Fake(OSError(errno.EDQUOT,'Disk quota exceeded')),'/backup/new')
  self.assertEqual(c.exception.code,'STORAGE_QUOTA')
 def test_low_capacity_prevents_any_write(self):
  s=Fake()
  with self.assertRaises(DeployBlocked)as c:
   with deployment_preflight(s,'/backup','123',100,0):self.fail('must not activate')
  self.assertEqual(c.exception.code,'STORAGE_INSUFFICIENT');self.assertEqual(s.calls,[])
 def test_failed_lock_never_enters_or_retries(self):
  s=Fake(OSError('Failure'))
  with self.assertRaises(DeployBlocked)as c:
   with deployment_preflight(s,'/backup','123',100,100000000):self.fail('must not activate')
  self.assertEqual(c.exception.code,'BACKUP_LOCK_CREATE_FAILED');self.assertEqual(len(s.calls),1)
if __name__=='__main__':unittest.main()
