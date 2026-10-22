import pathlib,sys,unittest
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'scripts'))
from noa_deploy_hosts import HostProfile
from noa_deploy_plan import plan_release

class PlanIsolationTest(unittest.TestCase):
 def setUp(self):
  self.profiles={'noa-studio':HostProfile('noa-studio','/hosting/noastudio/html','/hosting/noastudio/private')}
  self.manifest={'schema':1,'host_id':'noa-studio','activate':False,'files':[{'path':'noa-app/home.php','sha256':'a'*64}]}
 def test_diff_only(self):
  p=plan_release(self.profiles,'noa-studio',self.manifest,{'noa-app/home.php':'b'*64})
  self.assertEqual(p['change_count'],1)
  self.assertFalse(p['activation_allowed'])
 def test_host_mismatch(self):
  self.manifest['host_id']='busan-union'
  with self.assertRaises(ValueError):plan_release(self.profiles,'noa-studio',self.manifest,{})
 def test_duplicate_file(self):
  self.manifest['files']*=2
  with self.assertRaises(ValueError):plan_release(self.profiles,'noa-studio',self.manifest,{})
if __name__=='__main__':unittest.main()
