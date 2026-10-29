"""Transparent profile and public channel release; source-only with rollback."""
import noa_ainoa_deploy as release
release.FILES={}
for p in ['creator-core.php','creator-enrollment-core.php','channel-view.php']:
 release.FILES['noa-bridge/'+p]='bridge/'+p
for p in ['noa-creator-symbol.php','noa-channel-view.css','noa-channel-view.js','noa-creator.css','noa-creator.js']:
 release.FILES[p]='deploy/'+p
release.FILES['noa-bridge/creator.php']='bridge/creator.php'
for p in ['noa-creator.php','noa-channel.php']:
 release.FILES[p]='deploy/'+p
release.NEW={'noa-bridge/channel-view.php','noa-channel-view.css','noa-channel-view.js'}
release.PROTECTED=[p for p in release.PROTECTED if p not in release.FILES]
if __name__=='__main__':release.main()
