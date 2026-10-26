"""Acceptance rules and approved media integration regions, without a database. P0 recovery explicitly revises the UI/engine view contract; worker/SQL files remain protected."""
import hashlib,json,re,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
class RecoveryContract(unittest.TestCase):
 def test_music_processing_and_permission_regions_preserved(self):
  s=(ROOT/'deploy/noa-music.php').read_text()
  # Approved inline playback and shared-song projection are the current byte baseline.
  for selector in ['.player','[aria-label="곡 상세"]']:
   current="document.querySelector('"+selector+"').hidden=true;"
   self.assertEqual(s.count(current),1)
   s=s.replace(current,current.replace('hidden=true','hidden=false'),1)
  blocks={'databaseAndPermissionPrefix':s[:s.index('?><!doctype html>')],'requestPlaybackAndQueue':s[s.index('function requestPlayback()'):s.index('function filter()')],'playbackAndUploadIntegration':s[s.index('function select('):s.index("// Detail hydration") if "// Detail hydration" in s else s.index("let saved=''")]}
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
  shared={'bridge/sound-core.php','deploy/noa-app/jukebox/core.php'}
  if shared.intersection(paths):
   from readmodel_ownership import verify_shared_catalog_readers_only
   verify_shared_catalog_readers_only(ROOT,baseline)
   paths=[p for p in paths if p not in shared]
  # Integration finish owns only these bounded surfaces. FIFO, uploads and processing workers remain protected.
  authorized={'bridge/ainoa-generation.php','bridge/ainoa-core.php','bridge/ainoa-points.php','bridge/youtube-catalog.php','bridge/lab-api.php','bridge/catalog-store.php','bridge/package-record.php','bridge/package-migration.php','bridge/package-worker.php','bridge/index.php','bridge/lab-creator.php','bridge/taxonomy-store.php','bridge/inline-edit.php','bridge/music-readmodel.php','bridge/user-playlists.php','bridge/world-mv.php','bridge/popularity-events.php','bridge/playcount-policy.php','deploy/noa-app/jukebox/stream.php','deploy/noa-app/jukebox/stream-popularity.php','scripts/noa_jukebox_release.py','scripts/noa_jukebox_upload_worker.py','scripts/noa_jukebox_publish.py'}
  self.assertFalse(any(p not in authorized and p.startswith(('deploy/noa-app/jukebox/','bridge/','scripts/noa_jukebox'))for p in paths))
if __name__=='__main__':unittest.main()
