import json, pathlib, sys, tempfile, unittest
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'scripts'))
from noa_dothome_registry import load_host_registry, selected_host

class RegistryTest(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory()
  self.path=pathlib.Path(self.temp.name)/'hosts.json'
  self.host={'host_id':'noa-studio','remote_root':'/hosting/noastudio/html','private_root':'/hosting/noastudio/noa-deploy-private'}
 def tearDown(self):self.temp.cleanup()
 def write(self,hosts):self.path.write_text(json.dumps({'schema':1,'hosts':hosts}))
 def test_explicit_selection(self):
  self.write([self.host])
  self.assertEqual(selected_host(self.path,'noa-studio').host_id,'noa-studio')
  with self.assertRaises(ValueError):selected_host(self.path,'other-host')
 def test_duplicate_hosts_rejected(self):
  self.write([self.host,self.host])
  with self.assertRaises(ValueError):load_host_registry(self.path)
 def test_credentials_rejected(self):
  self.write([{**self.host,'password':'must-not-store'}])
  with self.assertRaises(ValueError):load_host_registry(self.path)
if __name__=='__main__':unittest.main()
