"""Acceptance rules and approved media integration regions, without a database. P0 recovery explicitly revises the UI/engine view contract; worker/SQL files remain protected."""
import hashlib,json,re,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
class RecoveryContract(unittest.TestCase):
 def test_music_processing_and_permission_regions_preserved(self):
  s=(ROOT/'deploy/noa-music.php').read_text()
  blocks={'databaseAndPermissionPrefix':s[:s.index('?><!doctype html>')],'requestPlaybackAndQueue':s[s.index('function requestPlayback()'):s.index('function filter()')],'playbackAndUploadIntegration':s[s.index('function select('):s.index("let saved=''")]}
  actual={k:hashlib.sha256(v.encode()).hexdigest()for k,v in blocks.items()}
  self.assertEqual(actual,json.loads((ROOT/'tests/uiux/music-processing-contract.json').read_text()))
 def test_removed_music_controls_are_not_rendered_or_loaded(self):
  s=(ROOT/'deploy/noa-music.php').read_text()
  self.assertNotRegex(s,r'id="(?:noa-taxonomy-browse|search|genre|type)"|class="filters"|noa-taxonomy-browse\.js|NoaTaxonomyFilter')
  self.assertNotRegex(s,r'(?:search|genre|type)\.addEventListener')
 def test_hero_control_is_absent_at_source_and_legacy_replay_is_retired(self):
  home=(ROOT/'deploy/noa-app/home.php').read_text();js=(ROOT/'deploy/noa-hero.js').read_text()
  self.assertNotIn('noa-hero-toggle',home+js)
  self.assertNotRegex(js,r'\.onclick|loop\s*=\s*true|currentTime\s*=\s*0')
 def test_legacy_entry_cannot_render_another_home(self):
  s=(ROOT/'deploy/noa2.php').read_text();self.assertIn("header('Location: /'",s);self.assertNotIn('<html',s);self.assertNotIn('common.php',s)
 def test_shared_theme_loaders_use_the_same_current_revision(self):
  for p in ['theme/noa_studio/head.php','theme/noa_studio/mobile/head.php','theme/noa_studio/skin-bridge.php','noa-theme-admin.php','noa-design.extend.php']:
   s=(ROOT/'deploy'/p).read_text()
   self.assertNotRegex(s,r'noa-ui\.(?:css|js)\?v=20261021')
   self.assertIn('noa-ui.css?v=20261022-recovery2',s)
 def test_extension_uses_the_installed_path_and_stages_outside_extend(self):
  s=(ROOT/'scripts/noa_uiux_release.py').read_text()
  self.assertIn("FILES['extend/noa.design.php']='deploy/noa-design.extend.php'",s)
  self.assertIn("tmp=ROOT+'/noa-bridge/.uiux-'",s)
 def test_no_design_changes_to_owner_processing_files(self):
  import subprocess
  import os
  event_path=os.environ.get('GITHUB_EVENT_PATH')
  event=json.loads(Path(event_path).read_text())if event_path else{}
  baseline=event.get('pull_request',{}).get('base',{}).get('sha')or event.get('before')or'b1aadc60f448dcd2f9a99b93161e06f92b76da2c'
  paths=subprocess.check_output(['git','diff','--name-only',baseline,'HEAD'],cwd=ROOT,text=True).splitlines()
  if 'bridge/youtube-store.php'in paths:
   from readmodel_ownership import verify_youtube_reader_only
   verify_youtube_reader_only(ROOT,baseline)
   paths.remove('bridge/youtube-store.php')
  self.assertFalse(any(p.startswith(('deploy/noa-app/jukebox/','bridge/','scripts/noa_jukebox'))for p in paths))
if __name__=='__main__':unittest.main()
