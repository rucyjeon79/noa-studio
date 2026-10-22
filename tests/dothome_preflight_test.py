import io,pathlib,stat,sys,unittest
from types import SimpleNamespace
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'scripts'))
from noa_deploy_hosts import HostProfile
from noa_dothome_preflight import inspect_and_plan

class Fake:
 def __init__(self):self.files={'/hosting/noastudio/html/noa-app/home.php':b'old'}
 def lstat(self,path):
  if path not in self.files:raise FileNotFoundError(path)
  return SimpleNamespace(st_mode=stat.S_IFREG|0o644)
 def open(self,path,mode):return io.BytesIO(self.files[path])
class PreflightTest(unittest.TestCase):
 def setUp(self):
  self.hosts={'noa-studio':HostProfile('noa-studio','/hosting/noastudio/html','/hosting/noastudio/private')}
  self.manifest={'schema':1,'host_id':'noa-studio','activate':False,'files':[{'path':'noa-app/home.php','sha256':'a'*64}]}
 def test_plan_reads_server_without_writing(self):
  result=inspect_and_plan(self.hosts,'noa-studio',self.manifest,Fake())
  self.assertEqual(result['change_count'],1)
  self.assertFalse(result['activation_allowed'])
  self.assertEqual(result['mode'],'read_only')
 def test_wrong_host_rejected(self):
  self.manifest['host_id']='other-host'
  with self.assertRaises(ValueError):inspect_and_plan(self.hosts,'noa-studio',self.manifest,Fake())
if __name__=='__main__':unittest.main()
