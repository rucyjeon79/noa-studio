"""Owner channel explorer release; source-only, exact preimage guards and rollback."""
import os, subprocess
import noa_ainoa_deploy as release
release.FILES={'noa-app/jukebox/queue-core.php':'deploy/noa-app/jukebox/queue-core.php'}
for p in ['creator-core.php','member-access.php','sound-core.php','music-readmodel.php','creator-ai-core.php','creator.php','channel-batch-ai.php','channel-batch-audio.php','channel-batch.php','lab-worker.php']:
 release.FILES['noa-bridge/'+p]='bridge/'+p
for p in ['noa-gpt.php','noa-channel-batch.js','noa-channel-explorer.js','noa-channel-controls.js','noa-channel-rules.js','noa-member-badges.css','noa-creator.css','noa-creator.js','noa-creator-ai.js','noa-browse-edit.js','noa-channel-menu.php','noa-channel-rules.php','noa-creator.php','noa-channel-workspace.php','noa-editor.php','noa-music.php','noa-workspace.php','noa-sitemap.php','noa-app/taxonomy/index.php']:
 release.FILES[p]='deploy/'+p
release.NEW={'noa-bridge/channel-batch-ai.php','noa-bridge/channel-batch-audio.php','noa-bridge/channel-batch.php','noa-channel-batch.js','noa-channel-explorer.js','noa-channel-controls.js','noa-channel-rules.js','noa-channel-rules.php'}
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
 scoped={remote:local for remote,local in release.FILES.items() if local in changed}
 release.FILES=scoped
release.PROTECTED=[p for p in release.PROTECTED if p not in release.FILES]
if __name__=='__main__':
 if release.FILES: release.main()
 else: print('No changed explorer sources to deploy')
