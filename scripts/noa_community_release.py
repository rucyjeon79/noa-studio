"""Scoped additive native community and home source release. No database writes here."""
import noa_ainoa_deploy as release
release.FILES={'noa-bridge/community-core.php':'bridge/community-core.php','noa-bridge/community.php':'bridge/community.php','noa-bridge/community-install.php':'bridge/community-install.php','extend/noa.01-community.php':'deploy/noa-community.extend.php','noa-community.css':'deploy/noa-community.css','noa-community.js':'deploy/noa-community.js','noa-app/home.php':'deploy/noa-app/home.php','noa-launch.js':'deploy/noa-launch.js','extend/noa.design.php':'deploy/noa-design.extend.php'}
release.NEW=set(list(release.FILES)[:6])
release.PROTECTED+=['noa-youtube.php','noa-browse.js','bbs/write_update.php','bbs/write_comment_update.php','noa-bridge/notices.php','noa-account.js','noa-account.css']
if __name__=='__main__':
 release.main()
 if 'rollback'not in release.sys.argv:
  from pathlib import Path
  import shutil
  Path('community-proof').mkdir(exist_ok=True);shutil.copy('ainoa-proof/deployment.json','community-proof/deployment.json')
