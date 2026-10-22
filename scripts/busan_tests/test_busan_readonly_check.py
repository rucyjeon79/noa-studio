import importlib.util
from pathlib import Path
import stat
import types
import unittest
from unittest.mock import Mock

spec = importlib.util.spec_from_file_location('busan_check', Path(__file__).parents[1]/'busan_readonly_check.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class Tests(unittest.TestCase):
    def fixtures(self):
        key = Mock()
        key.asbytes.return_value = b'busan-test-public-key'
        env = {'BUSAN_SSH_HOST': m.HOST, 'BUSAN_SSH_USER': m.USER,
               'BUSAN_SSH_PASSWORD': 'unit-test-placeholder',
               'BUSAN_SSH_HOST_FINGERPRINT': m.fingerprint(key)}
        transport = Mock()
        transport.get_remote_server_key.return_value = key
        transport.is_authenticated.return_value = True
        sftp = Mock(spec=['get_channel','normalize','lstat','listdir_attr','close'])
        sftp.normalize.return_value = m.ROOT
        sftp.lstat.return_value = types.SimpleNamespace(st_mode=stat.S_IFDIR)
        sftp.listdir_attr.return_value = [types.SimpleNamespace(filename='index.php', st_mode=stat.S_IFREG)]
        module = types.SimpleNamespace(Transport=Mock(return_value=transport),
                                      SFTPClient=types.SimpleNamespace(from_transport=Mock(return_value=sftp)))
        return env, transport, sftp, module, Mock(return_value=Mock())

    def test_missing_configuration_no_network(self):
        connect = Mock()
        with self.assertRaises(m.CheckError): m.perform({}, None, connect)
        connect.assert_not_called()

    def test_noa_configuration_not_used(self):
        with self.assertRaises(m.CheckError): m.configuration({'NOA_SSH_HOST':'112.175.184.84'})

    def test_wrong_host_rejected_before_network(self):
        env,t,s,p,c = self.fixtures()
        env['BUSAN_SSH_HOST']='112.175.184.84'
        with self.assertRaises(m.CheckError): m.perform(env,p,c)
        c.assert_not_called()

    def test_wrong_account_rejected(self):
        env,t,s,p,c = self.fixtures()
        env['BUSAN_SSH_USER']='noastudio'
        with self.assertRaises(m.CheckError): m.perform(env,p,c)
        c.assert_not_called()

    def test_unverified_key_prevents_authentication(self):
        env,t,s,p,c = self.fixtures()
        env['BUSAN_SSH_HOST_FINGERPRINT']='SHA256:'+'A'*43
        result = m.perform(env,p,c)
        self.assertEqual(result['error'],'host_key_mismatch')
        t.auth_password.assert_not_called()
        p.SFTPClient.from_transport.assert_not_called()
        t.close.assert_called_once()

    def test_authentication_failure_no_sftp(self):
        env,t,s,p,c = self.fixtures()
        t.auth_password.side_effect=RuntimeError(env['BUSAN_SSH_PASSWORD'])
        result=m.perform(env,p,c)
        self.assertEqual(result['failed_stage'],'authentication')
        self.assertNotIn(env['BUSAN_SSH_PASSWORD'],str(result))
        p.SFTPClient.from_transport.assert_not_called()

    def test_root_mismatch_prevents_listing(self):
        env,t,s,p,c=self.fixtures()
        s.normalize.return_value='/hosting/other/html'
        result=m.perform(env,p,c)
        self.assertEqual(result['error'],'unexpected_root')
        s.listdir_attr.assert_not_called()

    def test_readonly_success(self):
        env,t,s,p,c=self.fixtures()
        result=m.perform(env,p,c)
        self.assertEqual(result['status'],'passed')
        self.assertEqual(result['actual_root'],m.ROOT)
        self.assertEqual(result['remote_files_modified'],0)
        self.assertFalse(result['sql_accessed'])
        s.listdir_attr.assert_called_once_with(m.ROOT)
        t.auth_password.assert_called_once_with(m.USER,env['BUSAN_SSH_PASSWORD'],fallback=False)
        self.assertEqual([x[0] for x in s.method_calls],['get_channel','normalize','lstat','listdir_attr','close'])


if __name__=='__main__': unittest.main()
