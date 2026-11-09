"""Acceptance rules and approved media integration regions, without a database. P0 recovery explicitly revises the UI/engine view contract; worker/SQL files remain protected."""
import hashlib,json,re,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
class RecoveryContract(unittest.TestCase):
 def test_music_processing_and_permission_regions_preserved(self):
  s=(ROOT/'deploy/noa-music.php').read_text()
  # The approved N80 extraction moved playback out of the PHP view. Keep the
  # database/permission prefix byte-protected; exercise the actual module behavior.
  import subprocess
  subprocess.run(['node','--test','scripts/noa_player_regression.test.mjs','tests/pwa/launch_test.cjs','tests/jukebox/playback_recovery.test.cjs','tests/engine/jukebox_media.test.cjs'],cwd=ROOT,check=True,capture_output=True)
  contract=json.loads((ROOT/'tests/uiux/music-processing-contract.json').read_text())
  prefix=s[:s.index('?><!doctype html>')]
  self.assertEqual(hashlib.sha256(prefix.encode()).hexdigest(),contract['databaseAndPermissionPrefix'])
  self.assertNotIn('function requestPlayback()',s)
  self.assertEqual(s.count('src="/noa-app/jukebox/player.js?'),1)
  player=(ROOT/'deploy/noa-app/jukebox/player.js').read_text()
  for selector in ['.player','[aria-label="곡 상세"]']:
   self.assertEqual(player.count("document.querySelector('"+selector+"').hidden=true;"),1)
  self.assertIn('if(window.N80JukeBox)return;',player)
  self.assertIn('window.NoaMusic=window.N80JukeBox;',player)

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
  # The 2026-10-26 directives authorize SQL ordering and N80 text-only automation.
  # Keep this exact-file authorization; FIFO and processing workers remain protected.
  # The 2026-10-27 correction removes title-derived playlist classification.
  authorized={'bridge/catalog-recovery.php','bridge/record-quality.php','bridge/creator-core.php','bridge/catalog.php','bridge/library-records.php','bridge/record-trash.php','bridge/notices.php','bridge/ainoa-automation.php','bridge/lab-worker.php','bridge/category-order-store.php','bridge/ainoa-generation.php','bridge/ainoa-core.php','bridge/ainoa-points.php','bridge/youtube-catalog.php','bridge/lab-api.php','bridge/catalog-store.php','bridge/package-record.php','bridge/package-migration.php','bridge/package-worker.php','bridge/index.php','bridge/lab-creator.php','bridge/taxonomy-store.php','bridge/inline-edit.php','bridge/music-readmodel.php','bridge/user-playlists.php','bridge/world-mv.php','bridge/popularity-events.php','bridge/playcount-policy.php','deploy/noa-app/jukebox/stream.php','deploy/noa-app/jukebox/stream-popularity.php','scripts/noa_jukebox_release.py','scripts/noa_jukebox_upload_worker.py','scripts/noa_jukebox_publish.py'}
  # 2026-11-08: authorized N80 playback integration. Processing/stream writers remain protected.
  authorized.update({'deploy/noa-app/jukebox/player.js','deploy/noa-app/jukebox/presentation.js','deploy/noa-app/jukebox/navigation-policy.js','deploy/noa-app/jukebox/system-media.js'})
  # 2026-11-09 KST: requested Korean subtitles in the existing N80 movie agent.
  # Keep exact-file scope; native audio processing and other writers stay protected.
  authorized.update({'bridge/session-agent.php','bridge/session-agent-media.php','bridge/session-subtitles.php'})
  # 2026-11-09 KST: user explicitly requested daily Shorts owned by N80 on the existing host.
  # These campaign handlers use the existing media:worker gate and leased campaign store.
  authorized.update({'bridge/session-shorts.php','bridge/session-shorts-prepare.php','bridge/session-shorts-subtitles.php','bridge/worker-shorts.php'})
  # 2026-11-09: user requires N80 automatic production with no manual file handoff.
  # Automatic editing shares that campaign, its media:worker authorization and existing job.
  authorized.add('bridge/session-shorts-assemble.php')
  # 2026-11-09: explicitly approved generated-media Drive storage under N80.
  # Exact media:worker handler only; source audio and unrelated writers remain protected.
  authorized.update({'bridge/session-shorts-storage.php','bridge/session-shorts-github.php'})
  # Approved host-owned Drive OAuth using the existing callback; no new scheduler.
  authorized.update({'bridge/lab-oauth.php','bridge/session-shorts-drive.php','bridge/session-shorts-drive-view.php'})
  # The 2026-10-27 request explicitly adds post likes/comments to popularity.
  # Limit this authorization to the new reaction service and score calculation;
  # native member/board writers and music processing remain protected.
  authorized.update({'bridge/engagement-core.php','bridge/engagement-targets.php','bridge/engagement.php','bridge/popularity-core.php','bridge/popularity-store.php'})
  # The personal activity notification request authorizes this additive service only.
  authorized.update({'bridge/notifications-core.php','bridge/notifications-sources.php','bridge/notifications.php','bridge/notification-worker.php'})
  # 2026-10-28: user authorized direct push delivery to prevent scheduler delays.
  authorized.add('bridge/notifications-inline.php')
  # 2026-10-28: public sitemap discovery; individual destination ACLs remain unchanged.
  authorized.add('bridge/member-access.php')
  # 2026-10-28 explicit premium download revenue and in-card progress request.
  authorized.update({'bridge/music-download-core.php','deploy/noa-app/jukebox/download.php','deploy/noa-app/jukebox/upload.js','deploy/noa-app/jukebox/upload.css','deploy/noa-app/jukebox/upload-core.php','deploy/noa-app/jukebox/index.php'})
  # 2026-10-28: user requested mixed home discovery; these readers never write scores or points.
  authorized.update({'bridge/home.php','bridge/home-core.php','bridge/home-discovery.php'})
  # 2026-10-28: explicit monthly 10x login/write/comment/like point policy.
  # Existing native transaction and per-member receipts remain mandatory.
  authorized.update({'bridge/membership-core.php','bridge/monthly-rewards.php'})
  # 2026-10-28: user authorized Toss card/Kakao checkout; native balance writers remain unchanged.
  authorized.update({'bridge/toss-config.php','bridge/toss-core.php','bridge/toss.php','bridge/toss-webhook.php'})
  # 2026-10-28: explicit Drive spool, FIFO recovery, cancellation and concurrent playback request.
  authorized.update({'deploy/noa-app/jukebox/drive-core.php','deploy/noa-app/jukebox/operations.php','deploy/noa-app/jukebox/queue-core.php','deploy/noa-app/jukebox/recovery-core.php','deploy/noa-app/jukebox/upload-transport.js','deploy/noa-app/jukebox/upload.php'})
  # 2026-10-28: explicit post author nickname and inline comment/reply request.
  authorized.add('bridge/community-core.php')
  # 2026-10-29: explicit stable channel ownership and existing library binding request.
  authorized.update({'bridge/channel-ownership.php','bridge/creator.php','bridge/creator-enrollment-core.php','bridge/creator-enrollment.php','bridge/creator-ai-core.php','bridge/creator-ai.php','bridge/member-badges.php'})
  # 2026-10-29: explicit category-based channel viewing; this projection only reads.
  authorized.add('bridge/channel-view.php')
  # 2026-10-29: user authorized administrator-only KCP test window; no balance writes.
  authorized.update({'bridge/kcp-test-core.php','bridge/kcp-test-cert.php'})
  # 2026-10-29: explicit certificate-file separation; HTTP denial tested in tests/kcp/http_test.py.
  # 2026-10-30: user requested one dark theme and music-first WORLD.
  authorized.update({'bridge/ui-preferences.php','bridge/world-story.php'})
  story=(ROOT/'bridge/world-story.php').read_text()
  self.assertNotRegex(story, r'(?i)\b(?:INSERT\s+INTO|UPDATE\s+noa_|DELETE\s+FROM|CREATE\s+TABLE|ALTER\s+TABLE)\b')
  # Only normalize retired presentation settings on read; preserve the write/auth path.
  prefs=(ROOT/'bridge/ui-preferences.php').read_text()
  old_prefs=subprocess.check_output(['git','show',baseline+':bridge/ui-preferences.php'],cwd=ROOT,text=True)
  marker=" if(!$logged)noa_ui_reply(401"
  self.assertEqual(prefs[prefs.index(marker):],old_prefs[old_prefs.index(marker):])
  channel_view=(ROOT/'bridge/channel-view.php').read_text()
  self.assertNotRegex(channel_view, r'(?i)\b(?:INSERT\s+INTO|UPDATE\s+noa_|DELETE\s+FROM|CREATE\s+TABLE|ALTER\s+TABLE|nc_store\s*\()')
  discovery=(ROOT/'bridge/home-discovery.php').read_text()
  self.assertNotRegex(discovery, r'(?i)\b(?:INSERT\s+INTO|UPDATE\s+noa_|DELETE\s+FROM|CREATE\s+TABLE|ALTER\s+TABLE)\b')
  self.assertFalse(any(p not in authorized and p.startswith(('deploy/noa-app/jukebox/','bridge/','scripts/noa_jukebox'))for p in paths))
if __name__=='__main__':unittest.main()
