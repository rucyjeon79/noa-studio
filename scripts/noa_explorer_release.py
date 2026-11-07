"""Owner channel explorer release; source-only, exact preimage guards and rollback."""
import os, subprocess
import noa_ainoa_deploy as release
from noa_explorer_assets import DEPENDENCIES
WORKSPACE_DEPENDENCIES={p:'deploy/'+p for p in ['noa-app/engine/ai-lab.php','noa-app/engine/workspaces.php','noa-app/engine/lab-home.php','noa-app/engine/registry.php','noa-lab-router.js']}
release.FILES={**DEPENDENCIES,**WORKSPACE_DEPENDENCIES,'noa-app/jukebox/queue-core.php':'deploy/noa-app/jukebox/queue-core.php'}
for p in ['catalog.php','creator-core.php','member-access.php','sound-core.php','music-readmodel.php','creator-ai-core.php','creator.php','channel-batch-ai.php','channel-batch-audio.php','channel-batch.php','lab-worker.php','ainoa-core.php','community-music.php','ecosystem.php','youtube-api.php']:
 release.FILES['noa-bridge/'+p]='bridge/'+p
for p in ['noa-gpt.php','noa-channel-batch.js','noa-channel-explorer.js','noa-channel-controls.js','noa-channel-rules.js','noa-member-badges.css','noa-creator.css','noa-creator.js','noa-creator-ai.js','noa-ai-lab.js','noa-browse-edit.js','noa-channel-menu.php','noa-channel-rules.php','noa-creator.php','noa-creator-ai.php','noa-lab-song.php','noa-ai-lab.php','noa-app/engine/health.php','noa-channel-workspace.php','noa-editor.php','noa-music.php','noa-workspace.php','noa-sitemap.php','noa-app/taxonomy/index.php','noa-app/taxonomy/ui.js','noa-app/jukebox/explorer.js','noa-app/jukebox/index.php','noa-ainoa.js','noa-catalog.js','noa-catalog.php','noa-community.js','noa-ecosystem.js','noa-playlists.js','noa-browse-order.js','noa-browse.js','noa-youtube.js','noa-youtube-admin.php','noa-library.php','noa-my.php','noa-desktop.js','noa-ui.js','noa-ai-lab.css','noa-lab-chat.php','noa-app/ecosystem-view.php','noa-ecosystem-links.js']:
 release.FILES[p]='deploy/'+p
release.NEW=set(DEPENDENCIES)|set(WORKSPACE_DEPENDENCIES)|{'noa-app/jukebox/explorer.js','noa-bridge/channel-batch-ai.php','noa-bridge/channel-batch-audio.php','noa-bridge/channel-batch.php','noa-channel-batch.js','noa-channel-explorer.js','noa-channel-controls.js','noa-channel-rules.js','noa-channel-rules.php'}
before=os.environ.get('NOA_PUSH_BASE')
if before and before.strip('0'):
 changed=set(subprocess.check_output(['git','diff','--name-only','--no-renames',before,os.environ['GITHUB_SHA'],'--'],text=True).splitlines())
 # A previous pending production job can be superseded by a later change to
 # a single batch asset. Verify and reconcile the complete runtime together.
 batch_triggers={'scripts/noa_explorer_release.py','deploy/noa-channel-batch.js',
                 'bridge/channel-batch-ai.php','bridge/channel-batch-audio.php','bridge/channel-batch.php'}
 if changed & batch_triggers:
  changed.update(batch_triggers | {'bridge/lab-worker.php','deploy/noa-gpt.php',
      'deploy/noa-app/jukebox/queue-core.php','deploy/noa-channel-explorer.js',
      'deploy/noa-creator.php','deploy/noa-creator.js','deploy/noa-creator.css','deploy/noa-music.php'})
 # This migration completes the previously blocked integration release as one guarded source set.
 if 'scripts/noa_explorer_release.py' in changed: changed.update(release.FILES.values())
 scoped={remote:local for remote,local in release.FILES.items() if local in changed}
 release.FILES={**DEPENDENCIES,**WORKSPACE_DEPENDENCIES,**scoped} if scoped else {}
release.PROTECTED=[p for p in release.PROTECTED if p not in release.FILES]
if __name__=='__main__':
 if release.FILES: release.main()
 else: print('No changed explorer sources to deploy')
