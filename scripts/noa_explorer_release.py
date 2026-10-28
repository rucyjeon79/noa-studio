"""Owner channel explorer release; source-only, exact preimage guards and rollback."""
import noa_ainoa_deploy as release
release.FILES={}
for p in ['creator-core.php','member-access.php','sound-core.php','music-readmodel.php','creator-ai-core.php','creator.php']:
 release.FILES['noa-bridge/'+p]='bridge/'+p
for p in ['noa-channel-explorer.js','noa-channel-controls.js','noa-channel-rules.js','noa-creator.css','noa-creator.js','noa-browse-edit.js','noa-channel-menu.php','noa-channel-rules.php','noa-creator.php','noa-channel-workspace.php','noa-editor.php','noa-music.php','noa-workspace.php','noa-sitemap.php','noa-app/taxonomy/index.php']:
 release.FILES[p]='deploy/'+p
release.NEW={'noa-channel-explorer.js','noa-channel-controls.js','noa-channel-rules.js','noa-channel-rules.php'}
release.PROTECTED=[p for p in release.PROTECTED if p not in release.FILES]
if __name__=='__main__':release.main()
