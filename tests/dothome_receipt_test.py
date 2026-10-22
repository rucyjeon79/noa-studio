import pathlib,sys,unittest
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'scripts'))
from noa_deploy_hosts import HostProfile
from noa_dothome_receipt import make_receipt
class ReceiptTest(unittest.TestCase):
 def setUp(self):
  self.hosts={'noa-studio':HostProfile('noa-studio','/hosting/noastudio/html','/hosting/noastudio/private')}
  self.transaction={'host_id':'noa-studio','release':'a'*40,'activated':True,'postflight_required':True,'installed':['noa-app/home.php']}
  self.postflight={'ok':True,'routes':[{'path':'/','ok':True}]}
  self.files={'noa-app/home.php':'b'*64}
 def test_receipt_is_not_written(self):
  result=make_receipt(self.hosts,'noa-studio',self.transaction,self.postflight,self.files,'2026-10-22T10:00:00Z')
  self.assertEqual(result['record']['status'],'verified')
  self.assertFalse(result['persisted'])
  self.assertTrue(result['private_destination'].startswith('/hosting/noastudio/private/'))
 def test_postflight_failure_blocks_receipt(self):
  self.postflight['ok']=False
  with self.assertRaises(ValueError):make_receipt(self.hosts,'noa-studio',self.transaction,self.postflight,self.files,'2026-10-22T10:00:00Z')
 def test_missing_file_blocks_receipt(self):
  with self.assertRaises(ValueError):make_receipt(self.hosts,'noa-studio',self.transaction,self.postflight,{},'2026-10-22T10:00:00Z')
if __name__=='__main__':unittest.main()
