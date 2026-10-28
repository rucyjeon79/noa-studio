"""Scoped personal notification release; native writers and all music data are protected."""
import sys
from pathlib import Path
import noa_ainoa_deploy as release

release.FILES={
 'noa-bridge/notifications-inline.php':'bridge/notifications-inline.php',
 'noa-bridge/notifications-core.php':'bridge/notifications-core.php',
 'noa-bridge/notifications-sources.php':'bridge/notifications-sources.php',
 'noa-bridge/notifications.php':'bridge/notifications.php',
 'noa-bridge/notification-worker.php':'bridge/notification-worker.php',
 'noa-notifications.css':'deploy/noa-notifications.css',
 'noa-notifications.js':'deploy/noa-notifications.js',
 'noa-notifications.php':'deploy/noa-notifications.php',
 'noa-sw.js':'deploy/noa-sw.js',
 'noa-sitemap.php':'deploy/noa-sitemap.php',
 'extend/noa.design.php':'deploy/noa-design.extend.php',
 'extend/zz.noa-notifications.php':'deploy/noa-notifications.extend.php',
}
release.FILES.update({'noa-bridge/ainoa-core.php':'bridge/ainoa-core.php','noa-bridge/ainoa-automation.php':'bridge/ainoa-automation.php','noa-ainoa.php':'deploy/noa-ainoa.php','noa-voice.js':'deploy/noa-voice.js'})
release.NEW=set(release.FILES)-{'noa-sw.js','noa-sitemap.php','extend/noa.design.php'}
release.PROTECTED+=['bbs/write_comment_update.php','bbs/delete_comment.php','bbs/good.php','noa-bridge/community-core.php','noa-bridge/engagement-core.php','noa-bridge/popularity-core.php']
if __name__=='__main__':
 release.main()
 if 'rollback' not in sys.argv:
  Path('notifications-proof').mkdir(exist_ok=True)
  Path('notifications-proof/deployment.json').write_bytes(Path('ainoa-proof/deployment.json').read_bytes())
