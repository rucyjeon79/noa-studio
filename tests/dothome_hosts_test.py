import pathlib,sys,unittest
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'scripts'))
from noa_deploy_hosts import HostProfile,resolve_host

class MultiHostIsolationTest(unittest.TestCase):
 def setUp(self):
  self.a=HostProfile('noa-studio','/hosting/noastudio/html','/hosting/noastudio/noa-deploy-private')
  self.b=HostProfile('busan-union','/hosting/busan/html','/hosting/busan/noa-deploy-private')
  self.profiles={'noa-studio':self.a,'busan-union':self.b}
 def test_explicit_selection(self):
  with self.assertRaises(ValueError):resolve_host(self.profiles,None)
  with self.assertRaises(ValueError):resolve_host(self.profiles,'unknown')
  self.assertIs(resolve_host(self.profiles,'busan-union'),self.b)
 def test_isolated_state_and_lock(self):
  self.assertNotEqual(self.a.state_file,self.b.state_file)
  self.assertNotEqual(self.a.lock_key,self.b.lock_key)
 def test_reject_web_accessible_private_state(self):
  with self.assertRaises(ValueError):HostProfile('bad-host','/hosting/noastudio/html','/hosting/noastudio/html/data')
 def test_reject_cross_account_backup(self):
  with self.assertRaises(ValueError):HostProfile('wrong-host','/hosting/noastudio/html','/hosting/other-account/private')
 def test_reject_traversal(self):
  with self.assertRaises(ValueError):HostProfile('bad-host','/hosting/../html','/hosting/noastudio/private')
if __name__=='__main__':unittest.main()
