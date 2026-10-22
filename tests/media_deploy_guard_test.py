"""Offline deployment guard checks; never connect to hosting."""
import contextlib, hashlib, importlib.util, io, os, sys, tempfile, types, unittest
from pathlib import Path
from unittest.mock import patch
SOURCE=Path(__file__).resolve().parents[1]/'scripts/noa_p0_media_release.py'

class FakeSFTP:
 def __init__(self):
  self.files={};self.renames=[];self.closed=False;self.edit_after_first=False
 def close(self): self.closed=True
 def posix_rename(self,src,dest):
  self.files[dest]=self.files.pop(src);self.renames.append(dest)
  if self.edit_after_first and len(self.renames)==1:
   self.files['/root/noa-app/p0-player.js']=b'concurrent'
 def remove(self,p): del self.files[p]

class MediaDeployGuardTest(unittest.TestCase):
 def run_case(self,unknown=False,concurrent=False):
  s=FakeSFTP();s.edit_after_first=concurrent;counter=[0]
  def read(_,p):
   if p not in s.files: raise FileNotFoundError(p)
   return s.files[p]
  def atomic(_,p,b,label):
   counter[0]+=1;k='/stage/'+str(counter[0]);s.files[k]=b;return k
  @contextlib.contextmanager
  def preflight(*args): yield '/backup'
  ui=types.ModuleType('noa_uiux_release')
  for k,v in dict(connect=lambda:(s,s),read=read,sha=lambda b:hashlib.sha256(b).hexdigest(),atomic=atomic,mkdir=lambda *a:None,ROOT='/root',PROTECTED=[]).items():setattr(ui,k,v)
  guard=types.ModuleType('noa_deploy_guard');guard.deployment_preflight=preflight;guard.verified_backup=lambda _,p,b:s.files.__setitem__(p,b)
  with tempfile.TemporaryDirectory() as temp,patch.dict(sys.modules,{'noa_uiux_release':ui,'noa_deploy_guard':guard}),patch.dict(os.environ,{'GITHUB_SHA':'test','GITHUB_RUN_ID':'test','GITHUB_RUN_ATTEMPT':'1'}):
   cwd=os.getcwd();os.chdir(temp)
   try:
    spec=importlib.util.spec_from_file_location('media_under_test',SOURCE);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
    for p in m.FILES:
     f=Path('deploy')/p;f.parent.mkdir(parents=True,exist_ok=True);f.write_bytes(b'new')
     s.files['/root/'+p]=b'old'
    if unknown:s.files['/root/noa-app/p0-player.js']=b'unknown'
    with patch.object(m.subprocess,'check_output',return_value=b'old'),contextlib.redirect_stdout(io.StringIO()):
     error=None
     try:m.main()
     except RuntimeError as e:error=str(e)
    return s,error,m.FILES
   finally:os.chdir(cwd)
 def test_known_previous_asset_can_upgrade(self):
  s,error,files=self.run_case();self.assertIsNone(error)
  self.assertTrue(all(s.files['/root/'+p]==b'new' for p in files))
  self.assertTrue(s.closed)
 def test_unknown_asset_aborts_before_activation(self):
  s,error,_=self.run_case(unknown=True);self.assertIn('Unknown new asset',error)
  self.assertEqual(s.renames,[]);self.assertEqual(s.files['/root/noa-app/p0-player.js'],b'unknown')
 def test_concurrent_edit_between_activations_is_preserved(self):
  s,error,_=self.run_case(concurrent=True);self.assertIn('Concurrent activation change',error)
  self.assertEqual(s.files['/root/noa-app/p0-player.js'],b'concurrent')
  self.assertEqual(s.files['/root/noa-app/p0-media.css'],b'old')
  self.assertNotIn('/root/noa-app/p0-player.js',s.renames)
if __name__=='__main__':unittest.main()
