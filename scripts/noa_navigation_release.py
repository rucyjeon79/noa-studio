"""Scoped account navigation and shared category presentation. No data/auth/media changes."""
import noa_ainoa_deploy as release
release.FILES={name:'deploy/'+name for name in ['noa-account.css','noa-account.js','noa-ui.js','noa-my.php','noa-browse-order.js','noa-browse.js']}
release.NEW=set()
release.PROTECTED+=['index.php','noa-app/home.php','noa-youtube.php','noa-youtube.js','noa-community.js','noa-bridge/community-core.php','noa-manifest.json','noa-sw.js','noa-android-release.json','noa-launch.js','noa-install.php','noa-bridge/member-access.php','extend/noa.access.php']
if __name__=='__main__':
 release.main()
 if 'rollback'not in release.sys.argv:
  from pathlib import Path
  import shutil
  Path('navigation-proof/live').mkdir(parents=True,exist_ok=True);shutil.copy('ainoa-proof/deployment.json','navigation-proof/live/deployment.json')
