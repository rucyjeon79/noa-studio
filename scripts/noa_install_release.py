"""Scoped launch and installation UI release; no member, media or APK writes."""
import noa_ainoa_deploy as release
release.FILES={
 'noa-install.css':'deploy/noa-install.css','noa-install.js':'deploy/noa-install.js','noa-install.php':'deploy/noa-install.php',
 'noa-launch.js':'deploy/noa-launch.js','noa-brand.js':'deploy/noa-brand.js',
 'noa-bridge/member-access.php':'bridge/member-access.php','extend/noa.access.php':'deploy/noa-access.extend.php','extend/noa.design.php':'deploy/noa-design.extend.php',
 'noa-ui.js':'deploy/noa-ui.js','noa-my.php':'deploy/noa-my.php','noa-sitemap.php':'deploy/noa-sitemap.php','noa-account.js':'deploy/noa-account.js','noa-account.css':'deploy/noa-account.css','noa-download.php':'deploy/noa-download.php'}
release.NEW={'noa-install.css','noa-install.js','noa-install.php'}
release.PROTECTED+=['index.php','noa-app/home.php','noa-youtube.php','noa-browse.js','noa-community.js','noa-bridge/community-core.php','noa-manifest.json','noa-sw.js','noa-android-release.json']
if __name__=='__main__':
 release.main()
 if 'rollback'not in release.sys.argv:
  from pathlib import Path
  import shutil
  Path('install-proof/live').mkdir(parents=True,exist_ok=True);shutil.copy('ainoa-proof/deployment.json','install-proof/live/deployment.json')
