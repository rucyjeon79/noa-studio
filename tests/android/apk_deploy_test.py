"""Exercise publication ordering and conflict protection against an in-memory host."""
import hashlib
import io
import json
import os
from pathlib import Path
import runpy
import stat
import tempfile
import types
import unittest
from unittest.mock import patch
import zipfile

REPO = Path(__file__).resolve().parents[2]
ROOT = '/hosting/noastudio/html'


class DeploymentTest(unittest.TestCase):
    def deploy(self, previous=13, conflict=False, corrupt_http=False):
        files = {ROOT+'/'+p: b'protected' for p in ['index.php','common.php','config.php','data/dbconfig.php']}
        facade = (REPO/'deploy/noa-app/engine/n80.php').read_bytes()
        files[ROOT+'/noa-app/engine/n80.php'] = b'unknown-change' if conflict else facade
        release = ROOT+'/noa-android-release.json'
        files[release] = json.dumps({'app':'NOA STUDIO','file':f'noa-studio-android-build-{previous}.apk','build':str(previous),'sha256':'old'}).encode()
        old = files[release]
        class Handle(io.BytesIO):
            def __init__(self, path, mode):
                self.path, self.mode = path, mode
                if 'x' in mode and path in files: raise FileExistsError(path)
                super().__init__(b'' if 'w' in mode else files[path])
            def close(self):
                if 'w' in self.mode: files[self.path] = self.getvalue()
                super().close()
            def prefetch(self, **kwargs): pass
            def set_pipelined(self, value): pass
        class Sftp:
            def lstat(self, path):
                if path not in files: raise FileNotFoundError(path)
                return types.SimpleNamespace(st_mode=stat.S_IFREG|0o644,st_size=len(files[path]))
            stat = lstat
            def normalize(self, path): return path
            def open(self, path, mode): return Handle(path,mode)
            def chmod(self, *args): pass
            def rename(self, a,b):
                if b in files: raise FileExistsError(b)
                files[b]=files.pop(a)
            def posix_rename(self,a,b): files[b]=files.pop(a)
            def get_channel(self): return types.SimpleNamespace(settimeout=lambda t: None)
            def close(self): pass
        sftp = Sftp()
        class Transport:
            def __init__(self,*args): pass
            def get_security_options(self): return types.SimpleNamespace()
            def start_client(self,**kwargs): pass
            def get_remote_server_key(self): return types.SimpleNamespace(asbytes=lambda:b'host')
            def auth_password(self,*args): pass
            def close(self): pass
        def fetch(url,**kwargs):
            path=ROOT+'/'+url.split('https://noastudio.ai.kr/')[1].split('?')[0]
            data=files[path]
            if corrupt_http and path.endswith('.apk'): data=b'corrupt'
            response=io.BytesIO(data);response.status=200
            return response
        import base64
        env={'GITHUB_RUN_NUMBER':'42','GITHUB_SHA':'a'*40,'GITHUB_RUN_ID':'123',
             'NOA_SSH_HOST':'example','NOA_SSH_USER':'user','NOA_SSH_PASSWORD':'test',
             'NOA_SSH_ROOT':ROOT,'NOA_SSH_HOST_FINGERPRINT':'SHA256:'+base64.b64encode(hashlib.sha256(b'host').digest()).decode().rstrip('=')}
        with tempfile.TemporaryDirectory() as tmp:
            cwd=os.getcwd()
            try:
                os.chdir(tmp);Path('artifact').mkdir();Path('deploy/noa-app/engine').mkdir(parents=True)
                Path('deploy/noa-app/engine/n80.php').write_bytes(facade)
                with zipfile.ZipFile('artifact/app-debug.apk','w') as z:
                    z.writestr('AndroidManifest.xml',b'manifest');z.writestr('classes.dex',b'dex')
                with patch.dict(os.environ,env), patch.dict('sys.modules',{'paramiko':types.SimpleNamespace(Transport=Transport,SFTPClient=types.SimpleNamespace(from_transport=lambda t:sftp))}), patch('urllib.request.urlopen',fetch):
                    try: runpy.run_path(str(REPO/'scripts/noa_apk_deploy.py'))
                    except RuntimeError:
                        self.assertEqual(files[release],old)
                        raise
                self.assertTrue(Path('artifact/n80-android-release.json').exists())
            finally: os.chdir(cwd)
        return json.loads(files[release])

    def test_verified_publication(self):
        self.assertEqual(self.deploy()['versionCode'],42)
    def test_rejects_downgrade(self):
        with self.assertRaisesRegex(RuntimeError,'stale'): self.deploy(previous=43)
    def test_protects_unknown_facade(self):
        with self.assertRaisesRegex(RuntimeError,'conflict'): self.deploy(conflict=True)
    def test_http_hash_failure_preserves_pointer(self):
        with self.assertRaisesRegex(RuntimeError,'HTTP APK'): self.deploy(corrupt_http=True)

if __name__=='__main__': unittest.main()
