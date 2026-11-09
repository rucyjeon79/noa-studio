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
import sys

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / 'scripts'))
from noa_android_host_bridge import NODE_SHA
ROOT = '/hosting/noastudio/html'


class DeploymentTest(unittest.TestCase):
    def deploy(self, previous=13, conflict=False, corrupt_http=False, missing_host_proof=False, corrupt_aab=False, wrong_owner=False):
        files = {ROOT+'/'+p: b'protected' for p in ['index.php','common.php','config.php','data/dbconfig.php']}
        facade = (REPO/'deploy/noa-app/engine/n80.php').read_bytes()
        files[ROOT+'/noa-app/engine/n80.php'] = b'unknown-change' if conflict else facade
        release = ROOT+'/noa-android-release.json'
        files[release] = json.dumps({'app':'NOA STUDIO','file':f'noa-studio-android-build-{previous}.apk','build':str(previous),'sha256':'old'}).encode()
        old = files[release]
        download=(REPO/'deploy/noa-download.php').read_bytes()
        files[ROOT+'/noa-download.php']=download
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
        directories = {}
        class Sftp:
            def lstat(self, path):
                if path in directories: return types.SimpleNamespace(st_mode=stat.S_IFDIR|directories[path],st_size=0)
                if path not in files: raise FileNotFoundError(path)
                return types.SimpleNamespace(st_mode=stat.S_IFREG|0o644,st_size=len(files[path]))
            stat = lstat
            def normalize(self, path): return path
            def open(self, path, mode): return Handle(path,mode)
            def chmod(self, *args): pass
            def mkdir(self, path, mode): directories[path] = mode
            def remove(self, path):
                if path not in files: raise FileNotFoundError(path)
                del files[path]
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
        env={'GITHUB_REPOSITORY':'rucyjeon79/noa-studio','GITHUB_WORKFLOW_REF':'rucyjeon79/noa-studio/.github/workflows/'+('other.yml' if wrong_owner else 'noa-android.yml')+'@refs/heads/main','GITHUB_RUN_NUMBER':'42','GITHUB_SHA':'a'*40,'GITHUB_RUN_ID':'123',
             'NOA_SSH_HOST':'example','NOA_SSH_USER':'user','NOA_SSH_PASSWORD':'test',
             'NOA_SSH_ROOT':ROOT,'NOA_SSH_HOST_FINGERPRINT':'SHA256:'+base64.b64encode(hashlib.sha256(b'host').digest()).decode().rstrip('=')}
        with tempfile.TemporaryDirectory() as tmp:
            cwd=os.getcwd()
            try:
                os.chdir(tmp);Path('artifact').mkdir();Path('deploy/noa-app/engine').mkdir(parents=True)
                Path('deploy/noa-app/engine/n80.php').write_bytes(facade)
                Path('deploy/noa-download.php').write_bytes(download)
                host_proof = {'schemaVersion':1,'authority':'N80 Engine','module':'jukebox',
                    'operation':'jukebox.android_bridge','executionTarget':'existing_noa_host',
                    'sourceCommit':env['GITHUB_SHA'],'nodeVersion':'v24.22.2','nodeSha256':NODE_SHA,
                    'bridgeSha256':hashlib.sha256(b'bridge').hexdigest(),'passed':True,
                    'tests':{'tests':16,'pass':16,'fail':0,'cancelled':0,'skipped':0,'todo':0}}
                with zipfile.ZipFile('artifact/app-debug.apk','w') as z:
                    z.writestr('AndroidManifest.xml',b'manifest');z.writestr('classes.dex',b'dex')
                    z.writestr('assets/noa-native-bridge.js',b'bridge')
                    z.writestr('assets/n80-android-bridge.json',json.dumps(host_proof))
                with zipfile.ZipFile('artifact/noa-studio-release.aab','w') as z:
                    z.writestr('BundleConfig.pb',b'config');z.writestr('base/manifest/AndroidManifest.xml',b'manifest')
                aab=Path('artifact/noa-studio-release.aab').read_bytes()
                Path('artifact/verification.json').write_text(json.dumps({'versionCode':42,'certificateSha256':'f77427fe2f2e174aeac75e6734875b9106ee13072c49cfc8146b43075764271b','debuggable':False,'hostNode':None if missing_host_proof else host_proof,'files':{'noa-studio-release.aab':{'sha256':'0'*64 if corrupt_aab else hashlib.sha256(aab).hexdigest(),'bytes':len(aab)},'noa-studio-release.apk':{'sha256':hashlib.sha256(Path('artifact/app-debug.apk').read_bytes()).hexdigest()}}}))
                with patch.dict(os.environ,env), patch.dict('sys.modules',{'paramiko':types.SimpleNamespace(Transport=Transport,SFTPClient=types.SimpleNamespace(from_transport=lambda t:sftp))}), patch('urllib.request.urlopen',fetch):
                    try: runpy.run_path(str(REPO/'scripts/noa_apk_deploy.py'))
                    except (RuntimeError,ValueError):
                        self.assertEqual(files[release],old)
                        raise
                self.assertTrue(Path('artifact/n80-android-release.json').exists())
                self.assertEqual(files['/hosting/noastudio/noa-android-builds/noa-studio-android-build-42.aab'], aab)
            finally: os.chdir(cwd)
        return json.loads(files[release])

    def test_verified_publication(self):
        result=self.deploy()
        self.assertEqual(result['versionCode'],42)
        self.assertEqual(result['hostBuild']['state'],'verified_on_host')
        self.assertEqual(result['operation'],'jukebox.android_publish')
    def test_rejects_downgrade(self):
        with self.assertRaisesRegex(RuntimeError,'stale'): self.deploy(previous=43)
    def test_protects_unknown_facade(self):
        with self.assertRaisesRegex(RuntimeError,'conflict'): self.deploy(conflict=True)
    def test_http_hash_failure_preserves_pointer(self):
        with self.assertRaisesRegex(RuntimeError,'HTTP APK'): self.deploy(corrupt_http=True)
    def test_missing_host_proof_preserves_pointer(self):
        with self.assertRaisesRegex(ValueError,'host_node_proof'): self.deploy(missing_host_proof=True)

    def test_mismatched_play_bundle_preserves_pointer(self):
        with self.assertRaisesRegex(RuntimeError,'Play bundle proof'): self.deploy(corrupt_aab=True)
    def test_unregistered_publisher_is_rejected(self):
        with self.assertRaisesRegex(RuntimeError,'owner_mismatch'): self.deploy(wrong_owner=True)

if __name__=='__main__': unittest.main()
