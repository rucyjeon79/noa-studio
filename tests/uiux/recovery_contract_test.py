"""Acceptance rules and immutable Work_Music integration regions, without a database."""
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
 def test_no_design_changes_to_owner_processing_files(self):
  import subprocess
  paths=subprocess.check_output(['git','diff','--name-only','7aec9e7691eda0299979d960f688857f0b489838','HEAD'],cwd=ROOT,text=True).splitlines()
  self.assertFalse(any(p.startswith(('deploy/noa-app/jukebox/','bridge/','scripts/noa_jukebox'))for p in paths))
if __name__=='__main__':unittest.main()
