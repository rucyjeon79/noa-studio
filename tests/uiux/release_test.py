"""No-network checks for UI rollback leases and backup integrity."""
import io,os,stat,sys,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'scripts'))
import noa_uiux_release as release
class FakeSFTP:
 def __init__(self,files):self.files=dict(files);self.modes={p:stat.S_IFREG|0o600 for p in files}
 def lstat(self,p):return type('S',(),{'st_mode':self.modes[p]})()
 def open(self,p,mode):
  if mode=='rb':return io.BytesIO(self.files[p])
  if p in self.files:raise FileExistsError(p)
  host=self
  class Output(io.BytesIO):
   def close(self):host.files[p]=self.getvalue();host.modes[p]=stat.S_IFREG|0o600;super().close()
  return Output()
 def chmod(self,p,mode):self.modes[p]=stat.S_IFREG|mode
 def posix_rename(self,a,b):self.files[b]=self.files.pop(a);self.modes[b]=self.modes.pop(a)
class ReleaseTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.statefile=Path(self.temp.name)/'state.json';self.patch=patch.object(release,'STATE',self.statefile);self.patch.start();self.env=patch.dict(os.environ,{'GITHUB_RUN_ID':'unit'});self.env.start()
  self.remote=release.ROOT+'/noa-ui.css';self.backup='/private/backup/noa-ui.css';self.state={'changed':['noa-ui.css'],'backup':'/private/backup','files':{'noa-ui.css':{'before':release.sha(b'old'),'after':release.sha(b'new')}}}
 def tearDown(self):self.env.stop();self.patch.stop();self.temp.cleanup()
 def test_restores_verified_original(self):
  s=FakeSFTP({self.remote:b'new',self.backup:b'old'});release.rollback(s,self.state);self.assertEqual(s.files[self.remote],b'old');self.assertEqual(self.state['rolledBack'],['noa-ui.css'])
 def test_never_overwrites_newer_concurrent_code(self):
  s=FakeSFTP({self.remote:b'other work',self.backup:b'old'})
  with self.assertRaisesRegex(RuntimeError,'concurrent'):release.rollback(s,self.state)
  self.assertEqual(s.files[self.remote],b'other work')
 def test_bad_backup_cannot_replace_current_code(self):
  s=FakeSFTP({self.remote:b'new',self.backup:b'corrupted'})
  with self.assertRaisesRegex(RuntimeError,'integrity'):release.rollback(s,self.state)
  self.assertEqual(s.files[self.remote],b'new')
 def test_second_rollback_is_idempotent(self):
  s=FakeSFTP({self.remote:b'old',self.backup:b'old'});release.rollback(s,self.state);self.assertEqual(self.state['rolledBack'],[])
 def test_symlink_read_is_refused(self):
  s=FakeSFTP({self.remote:b'new'});s.modes[self.remote]=stat.S_IFLNK|0o777
  with self.assertRaisesRegex(RuntimeError,'Nonregular'):release.read(s,self.remote)
 def test_only_audited_world_history_is_accepted(self):
  import subprocess
  examples=[('noa-app/world-view.php','deploy/noa-app/world-view.php','e8053579e9f74b37362816355c70115e35968f81'),('noa-world.js','deploy/noa-world.js','2e543c62af90a2716f94a29a067e253c8f7462e9')]
  self.assertEqual(set(release.REVIEWED_WORLD_PREVIOUS),{x[0]for x in examples})
  for remote,source,commit in examples:
   observed=subprocess.check_output(['git','show',commit+':'+source])
   self.assertTrue(release.reviewed_world_previous(remote,observed))
   self.assertFalse(release.reviewed_world_previous(remote,observed+b'concurrent change'))
   self.assertFalse(release.reviewed_world_previous('noa-music.php',observed))
if __name__=='__main__':unittest.main()
