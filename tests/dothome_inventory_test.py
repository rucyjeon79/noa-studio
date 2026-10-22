import hashlib,io,pathlib,stat,sys,unittest
from types import SimpleNamespace
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'scripts'))
from noa_deploy_hosts import HostProfile
from noa_dothome_inventory import inspect_targets

class FakeSFTP:
 def __init__(self):self.files={'/hosting/noastudio/html/noa-app/home.php':b'home'}
 def lstat(self,path):
  if path not in self.files:raise FileNotFoundError(path)
  return SimpleNamespace(st_mode=stat.S_IFREG|0o644)
 def open(self,path,mode):
  return io.BytesIO(self.files[path])
class InventoryTest(unittest.TestCase):
 def setUp(self):self.profiles={'noa-studio':HostProfile('noa-studio','/hosting/noastudio/html','/hosting/noastudio/private')}
 def test_hash_and_missing(self):
  result=inspect_targets(self.profiles,'noa-studio',['noa-app/home.php','noa-app/missing.php'],FakeSFTP())
  self.assertEqual(result['noa-app/home.php'],hashlib.sha256(b'home').hexdigest())
  self.assertIsNone(result['noa-app/missing.php'])
 def test_no_cross_host_access(self):
  with self.assertRaises(ValueError):inspect_targets(self.profiles,'other-host',['noa-app/home.php'],FakeSFTP())
 def test_no_core(self):
  with self.assertRaises(ValueError):inspect_targets(self.profiles,'noa-studio',['data/dbconfig.php'],FakeSFTP())
if __name__=='__main__':unittest.main()
