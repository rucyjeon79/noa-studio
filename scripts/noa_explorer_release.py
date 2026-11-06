"""Owner channel explorer release; source-only, exact preimage guards and rollback."""
import os, subprocess
import noa_ainoa_deploy as release
release.FILES={}
for p in ['creator-core.php','member-access.php','sound-core.php','music-readmodel.php','creator-ai-core.php','creator.php']:
 release.FILES['noa-bridge/'+p]='bridge/'+p
for p in ['noa-channel-explorer.js','noa-channel-controls.js','noa-channel-rules.js','noa-member-badges.css','noa-creator.css','noa-creator.js','noa-creator-ai.js','noa-browse-edit.js','noa-channel-menu.php','noa-channel-rules.php','noa-creator.php','noa-channel-workspace.php','noa-editor.php','noa-music.php','noa-workspace.php','noa-sitemap.php','noa-app/taxonomy/index.php']:
 release.FILES[p]='deploy/'+p
release.NEW={'noa-channel-explorer.js','noa-channel-controls.js','noa-channel-rules.js','noa-channel-rules.php'}
before=os.environ.get('NOA_PUSH_BASE')
if before and before.strip('0'):
 changed=set(subprocess.check_output(['git','diff','--name-only','--no-renames',before,os.environ['GITHUB_SHA'],'--'],text=True).splitlines())
 scoped={remote:local for remote,local in release.FILES.items() if local in changed}
 if scoped: release.FILES=scoped
release.PROTECTED=[p for p in release.PROTECTED if p not in release.FILES]
if __name__=='__main__':release.main()
