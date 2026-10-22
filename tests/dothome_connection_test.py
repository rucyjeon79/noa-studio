import pathlib,sys,unittest
from unittest.mock import patch,MagicMock
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'scripts'))
from noa_deploy_hosts import HostProfile
from noa_dothome_connection import check_connection
class ConnectionTest(unittest.TestCase):
 def setUp(self):self.hosts={'noa-studio':HostProfile('noa-studio','/hosting/noastudio/html','/hosting/noastudio/private')}
 def test_missing_credentials_rejected_before_network(self):
  with patch('paramiko.Transport') as transport:
   with self.assertRaises(ValueError):
    check_connection(self.hosts,'noa-studio',address='',username='',password='',expected_fingerprint='')
   transport.assert_not_called()
 def test_wrong_host_rejected_before_network(self):
  with patch('paramiko.Transport') as transport:
   with self.assertRaises(ValueError):
    check_connection(self.hosts,'other-host',address='host',username='user',password='pass',expected_fingerprint='SHA256:abc')
   transport.assert_not_called()
if __name__=='__main__':unittest.main()
